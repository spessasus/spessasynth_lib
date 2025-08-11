// The core audio engine for the worker synthesizer.
import { type SampleEncodingFunction } from "spessasynth_core";
import type { BasicSynthesizerMessage } from "../types.ts";
import { renderAudioWorker } from "./render_audio_worker.ts";
import {
    BasicSynthesizerCore,
    type PostMessageSynthCore
} from "../basic/basic_synthesizer_core.ts";

const BLOCK_SIZE = 128;

type AudioChunk = [Float32Array, Float32Array];
type AudioChunks = AudioChunk[];

export class WorkerSynthesizerCore extends BasicSynthesizerCore {
    /**
     * The message port to the playback audio worklet.
     */
    protected workletMessagePort: MessagePort;

    protected readonly compressionFunction?: SampleEncodingFunction;

    public constructor(
        synthesizerConfiguration: {
            sampleRate: number;
            initialTime: number;
        },
        workletMessagePort: MessagePort,
        mainThreadCallback: typeof Worker.prototype.postMessage,
        compressionFunction?: SampleEncodingFunction
    ) {
        super(
            synthesizerConfiguration.sampleRate,
            {
                enableEventSystem: true,
                effectsEnabled: true,
                initialTime: synthesizerConfiguration.initialTime
            },
            mainThreadCallback as PostMessageSynthCore
        );

        this.workletMessagePort = workletMessagePort;
        this.workletMessagePort.onmessage = this.renderAndSendChunk.bind(this);
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
            case "renderAudio":
                const rendered = renderAudioWorker.call(
                    this,
                    m.data.sampleRate,
                    m.data.options
                );
                const transferable: Transferable[] = [];
                rendered.reverb.forEach((r) => transferable.push(r.buffer));
                rendered.chorus.forEach((c) => transferable.push(c.buffer));
                rendered.dry.forEach((d) =>
                    transferable.push(...d.map((c) => c.buffer))
                );
                this.postReady("renderAudio", rendered, transferable);
                break;

            default:
                super.handleMessage(m);
        }
    }

    protected stopAudioLoop() {
        this.synthesizer.stopAllChannels(true);
        this.sequencer.pause();
        this.alive = false;
    }

    protected startAudioLoop() {
        this.alive = true;
        this.renderAndSendChunk();
    }

    protected destroy() {
        // Null indicates end of life
        this.workletMessagePort.postMessage(null);
        this.stopAudioLoop();
        super.destroy();
    }

    protected renderAndSendChunk() {
        if (!this.alive) {
            return;
        }
        // Data is encoded into a single f32 array as follows
        // RevL, revR
        // ChrL, chrR,
        // Dry1L, dry1R
        // DryNL, dryNR
        // Dry16L, dry16R
        // To improve performance
        const byteStep = BLOCK_SIZE * Float32Array.BYTES_PER_ELEMENT;
        const data = new Float32Array(BLOCK_SIZE * 36);
        let byteOffset = 0;
        const revR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        byteOffset += byteStep;
        const revL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        const rev = [revL, revR];
        byteOffset += byteStep;
        const chrL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        byteOffset += byteStep;
        const chrR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        const chr = [chrL, chrR];
        const dry: AudioChunks = [];
        for (let i = 0; i < 16; i++) {
            byteOffset += byteStep;
            const dryL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
            byteOffset += byteStep;
            const dryR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
            dry.push([dryL, dryR]);
        }
        this.sequencer.processTick();
        this.synthesizer.renderAudioSplit(rev, chr, dry);
        this.workletMessagePort.postMessage(data, [data.buffer]);
    }
}
