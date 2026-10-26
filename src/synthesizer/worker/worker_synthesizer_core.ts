import {
    type BasicSoundBank,
    SoundBankLoader,
    SpessaLog
} from "spessasynth_core";
import type {
    BasicSynthesizerMessage,
    SynthesizerReturn,
    WorkerBankWriteOptions,
    WorkerSampleEncodingFunction
} from "../types";
import { renderAudioWorker } from "./render_audio_worker";
import {
    BasicSynthesizerCore,
    type PostMessageSynthCore
} from "../basic/basic_synthesizer_core";
import { writeDLSWorker, writeSF2Worker } from "./write_sf_worker";
import { writeRMIDIWorker } from "./write_rmi_worker";
import type { SynthCoreConfig } from "../basic/types";
import {
    TOTAL_OUTPUT_COUNT,
    VISUAL_CHANNEL_OUTPUTS_START
} from "../basic/synth_config";

const BLOCK_SIZE = 128;

/**
 * Creates the views into the render data, in the order described in {@link WorkerSynthesizerCore.renderData}.
 * @param renderData The render data.
 */
function createRenderViews(renderData: Float32Array) {
    let offset = 0;
    const next = () => {
        const view = renderData.subarray(offset, offset + BLOCK_SIZE);
        offset += BLOCK_SIZE;
        return view;
    };
    const outL = next();
    const outR = next();
    const convolverL = next();
    const convolverR = next();
    const visual = new Array<Float32Array[]>();
    for (let i = 0; i < TOTAL_OUTPUT_COUNT - VISUAL_CHANNEL_OUTPUTS_START; i++)
        visual.push([next(), next()]);
    return { outL, outR, convolverL, convolverR, visual };
}

/**
 * The core audio engine for the worker synthesizer.
 *
 * This part of the synthesizer runs in the Web Worker and contains the actual audio engine.
 *
 * @group Synthesizer.Worker
 */
export class WorkerSynthesizerCore extends BasicSynthesizerCore {
    /**
     * The message port to the playback audio worklet.
     * @internal
     */
    protected readonly workletMessagePort: MessagePort;

    protected readonly compressionFunction?: WorkerSampleEncodingFunction;

    /**
     * If the audio loop is running. It is stopped while rendering or writing files.
     */
    private audioLoopRunning = false;

    /**
     * The rendered block, encoded into a single array as follows, each part being `BLOCK_SIZE` long:
     * - OutLeft, OutRight
     * - ConvolverL, ConvolverR
     * - Dry1L, Dry1R ... Dry16L, Dry16R
     *
     * It is copied into a transferable buffer after rendering.
     */
    private readonly renderData = new Float32Array(
        BLOCK_SIZE * 2 * TOTAL_OUTPUT_COUNT
    );

    /**
     * The views into {@link renderData} that the synthesizer renders to.
     */
    private readonly renderViews = createRenderViews(this.renderData);

    /**
     * Buffers returned by the playback worklet, ready to be reused.
     */
    private readonly freeBuffers = new Array<Float32Array>();

    /**
     * Creates a new worker synthesizer core: the synthesizer that runs in the worker.
     * Most parameters here are provided with the first message that is posted to the worker by the {@link WorkerSynthesizer}.
     *
     * > **Tip**
     * >
     * > For an example of setting up a worker synthesizer, see the [Worker Synthesizer Example](../../../docs/getting-started/worker-synth-example.md).
     *
     * @param synthCoreConfig The data from the first message sent from {@link WorkerSynthesizer}.
     * Listen for the first event and use its data to initialize this class.
     * @param workletMessagePort The first port from the first message sent from {@link WorkerSynthesizer}.
     * @param mainThreadCallback The function to post a message back to the main thread. Usually `postMessage`.
     * @param compressionFunction Optional function for compressing SF3 banks.
     */
    public constructor(
        synthCoreConfig: SynthCoreConfig,
        workletMessagePort: MessagePort,
        mainThreadCallback: typeof Worker.prototype.postMessage,
        compressionFunction?: WorkerSampleEncodingFunction
    ) {
        super(synthCoreConfig, mainThreadCallback as PostMessageSynthCore);

        this.workletMessagePort = workletMessagePort;
        this.workletMessagePort.onmessage = (e: MessageEvent<unknown>) => {
            // The worklet returns the buffers it played with its requests
            if (e.data instanceof Float32Array) this.freeBuffers.push(e.data);
            this.process();
        };
        this.compressionFunction = compressionFunction;
        void this.synthesizer.ready.then(() => {
            this.postReady("sf3Decoder", null);
            this.startAudioLoop();
        });
    }

    /**
     * Handles a message received from the main thread.
     *
     * > **Tip**
     * >
     * > For an example of setting up a worker synthesizer, see the [Worker Synthesizer Example](../../../docs/getting-started/worker-synth-example.md).
     *
     * @param m The message received.
     */
    public handleMessage(m: BasicSynthesizerMessage) {
        if (this.destroyed) return;
        switch (m.type) {
            case "renderAudio": {
                const { sampleRate, options } = m.data;
                void this.runOffline("renderAudio", () => {
                    const rendered = renderAudioWorker.call(
                        this,
                        sampleRate,
                        options
                    );
                    const transferable: Transferable[] = [];
                    for (const r of rendered.output)
                        transferable.push(r.buffer);
                    for (const d of rendered.visual)
                        transferable.push(...d.map((c) => c.buffer));
                    if (rendered.convolver)
                        for (const c of rendered.convolver)
                            transferable.push(c.buffer);
                    this.postReady("renderAudio", rendered, transferable);
                });
                break;
            }

            case "writeRMIDI": {
                const opts = m.data;
                void this.runOffline("workerSynthWriteFile", async () => {
                    const data = await writeRMIDIWorker.call(this, opts);
                    this.postReady(
                        "workerSynthWriteFile",
                        {
                            binary: data,
                            fileName: ""
                        },
                        [data]
                    );
                });
                break;
            }

            case "writeSF2": {
                const opts = m.data;
                void this.runOffline("workerSynthWriteFile", async () => {
                    const data = await writeSF2Worker.call(this, opts);
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
                });
                break;
            }

            case "writeDLS": {
                const opts = m.data;
                void this.runOffline("workerSynthWriteFile", () => {
                    const data = writeDLSWorker.call(this, opts);
                    this.postReady(
                        "workerSynthWriteFile",
                        {
                            binary: data.binary,
                            fileName: data.bank.soundBankInfo.name + ".dls"
                        },
                        [data.binary]
                    );
                });
                break;
            }

            default: {
                super.handleMessage(m);
            }
        }
    }

    protected getBank(opts: WorkerBankWriteOptions): BasicSoundBank {
        const embedded =
            this.sequencers[opts.sequencerID]?.midiData?.embeddedSoundBank;
        const sf =
            opts.writeEmbeddedSoundBank && embedded
                ? SoundBankLoader.fromArrayBuffer(embedded)
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
                currentTime: this.synthesizer.currentTime
            });
            throw e;
        }
        return sf;
    }

    /**
     * Runs an offline operation with the audio loop stopped.
     * The loop is always restarted, and a failure rejects the main thread promise waiting for the response.
     * @param responseType The response type the main thread is waiting for.
     * @param operation The operation, which posts the response itself on success.
     */
    protected async runOffline(
        responseType: keyof SynthesizerReturn,
        operation: () => unknown
    ) {
        this.stopAudioLoop();
        try {
            await operation();
        } catch (error) {
            SpessaLog.warn(error);
            this.postError(responseType, error as Error);
        } finally {
            this.startAudioLoop();
        }
    }

    protected stopAudioLoop() {
        this.synthesizer.stopAll(true);
        for (const seq of this.sequencers) {
            seq.pause();
        }
        this.audioLoopRunning = false;
    }

    protected startAudioLoop() {
        if (this.destroyed) return;
        this.audioLoopRunning = true;
        this.process();
    }

    protected destroy() {
        // Null indicates end of life
        this.workletMessagePort.postMessage(null);
        this.stopAudioLoop();
        super.destroy();
    }

    protected process() {
        if (!this.audioLoopRunning) {
            return;
        }
        this.startBlock();

        // The core mixes into the outputs, so they must be cleared first
        this.renderData.fill(0);
        const { outL, outR, convolverL, convolverR, visual } = this.renderViews;
        this.synthesizer.process(outL, outR, undefined, undefined, visual);
        // Extract reverb capture data
        this.reverbCapture?.moveCapturedData(
            convolverL,
            convolverR,
            0,
            BLOCK_SIZE
        );
        // Reuse a buffer returned by the worklet if possible
        const data =
            this.freeBuffers.pop() ?? new Float32Array(this.renderData.length);
        data.set(this.renderData);
        this.workletMessagePort.postMessage(data, [data.buffer]);

        this.finishBlock();
    }
}
