import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import { BasicSynthesizer } from "../basic/basic_synthesizer.ts";
import { DEFAULT_SYNTH_CONFIG } from "../basic/synth_config.ts";
import type { SynthConfig } from "../basic/types.ts";
import type {
    BasicSynthesizerMessage,
    BasicSynthesizerReturnMessage,
    SynthesizerProgress,
    SynthesizerReturn,
    WorkerBankWriteOptions,
    WorkerDLSWriteOptions,
    WorkerRMIDIWriteOptions,
    WorkerSoundFont2WriteOptions
} from "../types.ts";
import {
    getPlaybackWorkletURL,
    PLAYBACK_WORKLET_PROCESSOR_NAME
} from "./playback_worklet.ts";
import {
    DEFAULT_WORKER_RENDER_AUDIO_OPTIONS,
    type WorkerRenderAudioOptions
} from "./render_audio_worker.ts";
import { resampleAudioBuffer } from "../../utils/resample_audio_buffer.ts";

const DEFAULT_BANK_WRITE_OPTIONS: WorkerBankWriteOptions = {
    trim: true,
    bankID: "",
    writeEmbeddedSoundBank: true,
    sequencerID: 0
};

const DEFAULT_SF2_WRITE_OPTIONS: WorkerSoundFont2WriteOptions = {
    ...DEFAULT_BANK_WRITE_OPTIONS,
    writeDefaultModulators: true,
    writeExtendedLimits: true,
    compressionAction: "keep",
    compressionQuality: 1,
    software: "SpessaSynth"
};

const DEFAULT_RMIDI_WRITE_OPTIONS: WorkerRMIDIWriteOptions = {
    ...DEFAULT_BANK_WRITE_OPTIONS,
    applySnapshot: false,
    bankOffset: 0,
    correctBankOffset: true,
    metadata: {},
    format: "sf2",
    ...DEFAULT_SF2_WRITE_OPTIONS
};

const DEFAULT_DLS_WRITE_OPTIONS: WorkerDLSWriteOptions = {
    ...DEFAULT_BANK_WRITE_OPTIONS,
    software: "SpessaSynth"
};

type WorkerSynthWriteOptions<K> = K & {
    progressFunction?: (
        args: SynthesizerProgress["workerSynthWriteFile"]
    ) => unknown;
};

interface RenderAudioResult {
    effects?: AudioBuffer;
    channels: AudioBuffer[];
}

interface RenderAudioInternalResult {
    dry: AudioBuffer[];
    effects?: AudioBuffer;
}

type RenderAudioOptions = Omit<
    Partial<WorkerRenderAudioOptions>,
    "separateChannels"
>;

type StereoAudioChunk = [Float32Array, Float32Array];

function makeAudioBuffer(
    pair: StereoAudioChunk,
    sampleRate: number
): AudioBuffer {
    const buffer = new AudioBuffer({
        sampleRate,
        numberOfChannels: 2,
        length: pair[0].length
    });
    buffer.copyToChannel(pair[0] as Float32Array<ArrayBuffer>, 0);
    buffer.copyToChannel(pair[1] as Float32Array<ArrayBuffer>, 1);
    return buffer;
}

function mergeStereoAudioBuffer(into: AudioBuffer, from: AudioBuffer): void {
    const channelCount = Math.min(into.numberOfChannels, from.numberOfChannels);
    for (let ch = 0; ch < channelCount; ch++) {
        const data = into.getChannelData(ch);
        const src = from.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
            data[i] += src[i];
        }
    }
}

/**
 * This synthesizer uses a Worker containing the processor and an audio worklet node for playback.
 */
export class WorkerSynthesizer extends BasicSynthesizer {
    /**
     * Time offset for syncing with the synth
     * @private
     */
    private timeOffset = 0;

    /**
     * Creates a new instance of a Worker-based synthesizer.
     * @param context The audio context.
     * @param workerPostMessage The postMessage for the worker containing the synthesizer core.
     * @param config Optional configuration for the synthesizer.
     */
    public constructor(
        // Disallow the use of OfflineAudioContext here
        context: AudioContext,
        workerPostMessage: typeof Worker.prototype.postMessage,
        config: Partial<SynthConfig> = DEFAULT_SYNTH_CONFIG
    ) {
        const synthConfig = fillWithDefaults(config, DEFAULT_SYNTH_CONFIG);
        // Ensure default values for options
        super(
            context,
            PLAYBACK_WORKLET_PROCESSOR_NAME,
            synthConfig,
            workerPostMessage as (
                data: BasicSynthesizerMessage,
                transfer?: Transferable[]
            ) => unknown
        );

        // Create a message channel for communication between the worker and the worklet
        const messageChannel = new MessageChannel();
        const workerPort = messageChannel.port1;
        const workletPort = messageChannel.port2;
        // Post the channel to worklet
        this.worklet.port.postMessage(null, [workletPort]);
        // Post the channel and init worker
        workerPostMessage(
            {
                initialTime: this.context.currentTime,
                sampleRate: this.context.sampleRate,
                convolverMode: synthConfig.convolverMode,
                processorConfig: {
                    eventsEnabled: synthConfig.eventsEnabled
                }
            },
            [workerPort]
        );
    }

    public get currentTime() {
        return this.context.currentTime + this.timeOffset;
    }

    /**
     * Registers an audio worklet for the WorkerSynthesizer.
     * @param context The context to register the worklet for.
     * @param maxQueueSize The maximum amount of 128-sample chunks to store in the worklet. Higher values result in less breakups but higher latency.
     */
    public static async registerPlaybackWorklet(
        context: BaseAudioContext,
        maxQueueSize = 20
    ) {
        if (!context?.audioWorklet.addModule) {
            throw new Error("Audio worklet is not supported.");
        }
        return context.audioWorklet.addModule(
            getPlaybackWorkletURL(maxQueueSize)
        );
    }

    /**
     * Handles a return message from the Worker.
     * @param events The events received from the Worker.
     */
    public handleWorkerMessage(events: BasicSynthesizerReturnMessage[]) {
        if (events.length > 0)
            this.timeOffset = events[0].currentTime - this.context.currentTime;
        this.handleMessages(events);
    }

    /**
     * Writes a DLS file directly in the worker.
     * @param options Options for writing the file.
     * @returns The file array buffer and its corresponding name.
     */
    public async writeDLS(
        options: Partial<
            WorkerSynthWriteOptions<WorkerDLSWriteOptions>
        > = DEFAULT_DLS_WRITE_OPTIONS
    ): Promise<SynthesizerReturn["workerSynthWriteFile"]> {
        const writeOptions = fillWithDefaults(
            options,
            DEFAULT_DLS_WRITE_OPTIONS
        );
        return new Promise((resolve) => {
            this.assignProgressTracker("workerSynthWriteFile", (p) => {
                void options.progressFunction?.(p);
            });
            const postOptions = {
                ...writeOptions,
                progressFunction: null
            };
            this.awaitWorkerResponse("workerSynthWriteFile", (data) => {
                this.revokeProgressTracker("workerSynthWriteFile");
                resolve(data);
            });
            this.post({
                type: "writeDLS",
                data: postOptions,
                channelNumber: -1
            });
        });
    }

    /**
     * Writes an SF2/SF3 file directly in the worker.
     * @param options Options for writing the file.
     * @returns The file array buffer and its corresponding name.
     */
    public async writeSF2(
        options: Partial<
            WorkerSynthWriteOptions<WorkerSoundFont2WriteOptions>
        > = DEFAULT_SF2_WRITE_OPTIONS
    ): Promise<SynthesizerReturn["workerSynthWriteFile"]> {
        const writeOptions = fillWithDefaults(
            options,
            DEFAULT_SF2_WRITE_OPTIONS
        );
        return new Promise((resolve) => {
            this.assignProgressTracker("workerSynthWriteFile", (p) => {
                void options.progressFunction?.(p);
            });
            const postOptions = {
                ...writeOptions,
                progressFunction: null
            };
            this.awaitWorkerResponse("workerSynthWriteFile", (data) => {
                this.revokeProgressTracker("workerSynthWriteFile");
                resolve(data);
            });
            this.post({
                type: "writeSF2",
                data: postOptions,
                channelNumber: -1
            });
        });
    }

    /**
     * Writes an embedded MIDI (RMIDI) file directly in the worker.
     * @param options Options for writing the file.
     * @returns The file array buffer.
     */
    public async writeRMIDI(
        options: Partial<
            WorkerSynthWriteOptions<WorkerRMIDIWriteOptions>
        > = DEFAULT_RMIDI_WRITE_OPTIONS
    ): Promise<ArrayBuffer> {
        const writeOptions = fillWithDefaults(
            options,
            DEFAULT_RMIDI_WRITE_OPTIONS
        );
        return new Promise((resolve) => {
            this.assignProgressTracker("workerSynthWriteFile", (p) => {
                void options.progressFunction?.(p);
            });
            const postOptions = {
                ...writeOptions,
                progressFunction: null
            };
            this.awaitWorkerResponse("workerSynthWriteFile", (data) => {
                this.revokeProgressTracker("workerSynthWriteFile");
                resolve(data.binary);
            });
            this.post({
                type: "writeRMIDI",
                data: postOptions,
                channelNumber: -1
            });
        });
    }

    /**
     * Renders the current song to a single stereo AudioBuffer.
     * @param sampleRate The sample rate to use, in Hertz.
     * @param renderOptions Extra options for the render.
     * @returns The dry output merged with the effects and convolver output.
     * @remarks
     * This stops the synthesizer while rendering.
     */
    public async renderAudio(
        sampleRate: number,
        renderOptions: RenderAudioOptions = DEFAULT_WORKER_RENDER_AUDIO_OPTIONS
    ): Promise<AudioBuffer> {
        const options: WorkerRenderAudioOptions = {
            ...fillWithDefaults(
                renderOptions,
                DEFAULT_WORKER_RENDER_AUDIO_OPTIONS
            ),
            separateChannels: false
        };
        const rendered = await this.renderAudioInternal(sampleRate, options);
        const output = rendered.dry[0];
        if (rendered.effects) {
            mergeStereoAudioBuffer(output, rendered.effects);
        }
        return output;
    }

    /**
     * Renders the current song to separate channel buffers plus the effects.
     * @param sampleRate The sample rate to use, in Hertz.
     * @param renderOptions Extra options for the render.
     * @returns The dry channels and the effects if they are enabled.
     * @remarks
     * This stops the synthesizer while rendering.
     */
    public async renderAudioSplit(
        sampleRate: number,
        renderOptions: RenderAudioOptions = DEFAULT_WORKER_RENDER_AUDIO_OPTIONS
    ): Promise<RenderAudioResult> {
        const options: WorkerRenderAudioOptions = {
            ...fillWithDefaults(
                renderOptions,
                DEFAULT_WORKER_RENDER_AUDIO_OPTIONS
            ),
            separateChannels: true
        };
        const rendered = await this.renderAudioInternal(sampleRate, options);
        return { effects: rendered.effects, channels: rendered.dry };
    }

    private async renderAudioInternal(
        sampleRate: number,
        options: WorkerRenderAudioOptions
    ): Promise<RenderAudioInternalResult> {
        return new Promise((resolve) => {
            // First pass: Worker renders the dry audio
            this.awaitWorkerResponse("renderAudio", async (data) => {
                this.revokeProgressTracker("renderAudio");
                const convolverData = data.convolver;
                const dry = data.dry.map((dryPair) =>
                    makeAudioBuffer(dryPair, sampleRate)
                );
                let effects: AudioBuffer | undefined;
                if (options.enableEffects) {
                    effects = makeAudioBuffer(data.effects, sampleRate);
                    if (convolverData && this.convolverNode?.buffer) {
                        const convolver = await this.renderConvolverBuffer(
                            convolverData,
                            sampleRate
                        );
                        mergeStereoAudioBuffer(effects, convolver);
                    }
                }
                resolve({ dry, effects });
                return;
            });
            // Assign progress tracker and render
            this.assignProgressTracker("renderAudio", (p) => {
                options.progressCallback?.(p, 0);
            });

            // Functions cannot be cloned
            const strippedOptions: WorkerRenderAudioOptions = {
                ...options,
                progressCallback: undefined
            };
            this.post({
                type: "renderAudio",
                data: {
                    sampleRate,
                    options: strippedOptions
                },
                channelNumber: -1
            });
        });
    }

    /**
     * Render the convolver buffer with the current impulse response we have
     * @param convolverData
     * @param sampleRate
     * @private
     */
    private async renderConvolverBuffer(
        convolverData: StereoAudioChunk,
        sampleRate: number
    ) {
        const convolverSource = makeAudioBuffer(convolverData, sampleRate);
        const offline = new OfflineAudioContext({
            numberOfChannels: 2,
            length: convolverData[0].length,
            sampleRate
        });
        const source = offline.createBufferSource();
        source.buffer = convolverSource;
        const convolver = offline.createConvolver();
        // Different sample rates crash the thread
        let impulseResponse = this.convolverNode!.buffer!;
        if (impulseResponse.sampleRate !== sampleRate) {
            impulseResponse = await resampleAudioBuffer(
                impulseResponse,
                sampleRate
            );
        }
        convolver.buffer = impulseResponse;
        source.connect(convolver);
        convolver.connect(offline.destination);
        source.start(0);
        return offline.startRendering();
    }
}
