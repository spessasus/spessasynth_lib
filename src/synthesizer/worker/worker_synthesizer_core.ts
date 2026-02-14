import { type BasicSoundBank, SoundBankLoader } from "spessasynth_core";
import type {
    BasicSynthesizerMessage,
    WorkerBankWriteOptions,
    WorkerSampleEncodingFunction
} from "../types.ts";
import { renderAudioWorker } from "./render_audio_worker.ts";
import {
    BasicSynthesizerCore,
    type PostMessageSynthCore,
    SEQUENCER_SYNC_INTERVAL
} from "../basic/basic_synthesizer_core.ts";
import { writeDLSWorker, writeSF2Worker } from "./write_sf_worker.ts";
import { writeRMIDIWorker } from "./write_rmi_worker.ts";

const BLOCK_SIZE = 128;

type AudioChunk = [Float32Array, Float32Array];
type AudioChunks = AudioChunk[];

// The core audio engine for the worker synthesizer.
export class WorkerSynthesizerCore extends BasicSynthesizerCore {
    /**
     * The message port to the playback audio worklet.
     */
    public readonly workletMessagePort: MessagePort;

    protected readonly compressionFunction?: WorkerSampleEncodingFunction;

    /**
     * Creates a new worker synthesizer core: the synthesizer that runs in the worker.
     * Most parameters here are provided with the first message that is posted to the worker by the WorkerSynthesizer.
     * @param synthesizerConfiguration The data from the first message sent from WorkerSynthesizer.
     * Listen for the first event and use its data to initialize this class.
     * @param workletMessagePort The first port from the first message sent from WorkerSynthesizer.
     * @param mainThreadCallback postMessage function or similar.
     * @param compressionFunction Optional function for compressing SF3 banks.
     */
    public constructor(
        synthesizerConfiguration: {
            sampleRate: number;
            initialTime: number;
        },
        workletMessagePort: MessagePort,
        mainThreadCallback: typeof Worker.prototype.postMessage,
        compressionFunction?: WorkerSampleEncodingFunction
    ) {
        super(
            synthesizerConfiguration.sampleRate,
            {
                enableEventSystem: true,
                enableEffects: true,
                initialTime: synthesizerConfiguration.initialTime
            },
            mainThreadCallback as PostMessageSynthCore
        );

        this.workletMessagePort = workletMessagePort;
        this.workletMessagePort.onmessage = this.process.bind(this);
        this.compressionFunction = compressionFunction;
        void this.synthesizer.processorInitialized.then(() => {
            this.postReady("sf3Decoder", null);
            this.startAudioLoop();
        });
    }

    /**
     * Handles a message received from the main thread.
     * @param m The message received.
     */
    public handleMessage(m: BasicSynthesizerMessage) {
        switch (m.type) {
            case "renderAudio": {
                const rendered = renderAudioWorker.call(
                    this,
                    m.data.sampleRate,
                    m.data.options
                );
                const transferable: Transferable[] = [];
                for (const r of rendered.effects) transferable.push(r.buffer);
                for (const d of rendered.dry)
                    transferable.push(...d.map((c) => c.buffer));
                this.postReady("renderAudio", rendered, transferable);
                break;
            }

            case "writeRMIDI": {
                this.stopAudioLoop();
                void writeRMIDIWorker.call(this, m.data).then((data) => {
                    this.postReady(
                        "workerSynthWriteFile",
                        {
                            binary: data,
                            fileName: ""
                        },
                        [data]
                    );
                    this.startAudioLoop();
                });
                break;
            }

            case "writeSF2": {
                this.stopAudioLoop();
                void writeSF2Worker.call(this, m.data).then((data) => {
                    this.postReady(
                        "workerSynthWriteFile",
                        {
                            binary: data.binary,
                            fileName:
                                data.bank.soundBankInfo.name +
                                (data.bank.soundBankInfo.version.major === 3
                                    ? ".sf3"
                                    : ".sf2")
                        },
                        [data.binary]
                    );
                    this.startAudioLoop();
                });
                break;
            }

            case "writeDLS": {
                this.stopAudioLoop();
                void writeDLSWorker.call(this, m.data).then((data) => {
                    this.postReady(
                        "workerSynthWriteFile",
                        {
                            binary: data.binary,
                            fileName: data.bank.soundBankInfo.name + ".dls"
                        },
                        [data.binary]
                    );
                    this.startAudioLoop();
                });
                break;
            }

            default: {
                super.handleMessage(m);
            }
        }
    }

    protected getBank(opts: WorkerBankWriteOptions): BasicSoundBank {
        const sq = this.sequencers[opts.sequencerID];
        const sf =
            opts.writeEmbeddedSoundBank && sq.midiData?.embeddedSoundBank
                ? SoundBankLoader.fromArrayBuffer(sq.midiData.embeddedSoundBank)
                : this.synthesizer.soundBankManager.soundBankList.find(
                      (b) => b.id === opts.bankID
                  )?.soundBank;
        if (!sf) {
            const e = new Error(
                `${opts.bankID} does not exist in the sound bank list!`
            );
            this.post({
                type: "soundBankError",
                data: e,
                currentTime: this.synthesizer.currentSynthTime
            });
            throw e;
        }
        return sf;
    }

    protected stopAudioLoop() {
        this.synthesizer.stopAllChannels(true);
        for (const seq of this.sequencers) {
            seq.pause();
        }
        this.alive = false;
    }

    protected startAudioLoop() {
        this.alive = true;
        this.process();
    }

    protected destroy() {
        // Null indicates end of life
        this.workletMessagePort.postMessage(null);
        this.stopAudioLoop();
        super.destroy();
    }

    protected process() {
        if (!this.alive) {
            return;
        }
        // Data is encoded into a single f32 array as follows
        // WetL, WetR,
        // Dry1L, dry1R
        // DryNL, dryNR
        // Dry16L, dry16R
        // To improve performance
        const byteStep = BLOCK_SIZE * Float32Array.BYTES_PER_ELEMENT;
        const data = new Float32Array(BLOCK_SIZE * 34);
        let byteOffset = 0;
        const wetR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        byteOffset += byteStep;
        const wetL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        byteOffset += byteStep;
        const dry: AudioChunks = [];
        for (let i = 0; i < 16; i++) {
            const dryL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
            byteOffset += byteStep;

            const dryR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
            byteOffset += byteStep;

            dry.push([dryL, dryR]);
        }
        for (const seq of this.sequencers) {
            seq.processTick();
        }
        this.synthesizer.processSplit(dry, wetL, wetR);
        this.workletMessagePort.postMessage(data, [data.buffer]);

        const t = this.synthesizer.currentSynthTime;
        if (t - this.lastSequencerSync > SEQUENCER_SYNC_INTERVAL) {
            for (let id = 0; id < this.sequencers.length; id++) {
                this.post({
                    type: "sequencerReturn",
                    data: {
                        type: "sync",
                        data: this.sequencers[id].currentTime,
                        id
                    },
                    currentTime: t
                });
            }
            this.lastSequencerSync = t;
        }
    }
}
