import { BasicSynthesizer } from "../basic/basic_synthesizer.ts";
import type { SynthConfig } from "../audio_effects/types.ts";
import { DEFAULT_SYNTH_CONFIG } from "../audio_effects/effects_config.ts";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import {
    getPlaybackWorkletURL,
    PLAYBACK_WORKLET_PROCESSOR_NAME
} from "./playback_worklet.ts";
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
    DEFAULT_WORKER_RENDER_AUDIO_OPTIONS,
    type WorkerRenderAudioOptions
} from "./render_audio_worker.ts";

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
    compress: false,
    compressionQuality: 1,
    decompress: false
};

const DEFAULT_RMIDI_WRITE_OPTIONS: WorkerRMIDIWriteOptions = {
    ...DEFAULT_BANK_WRITE_OPTIONS,
    bankOffset: 0,
    correctBankOffset: true,
    metadata: {},
    format: "sf2",
    ...DEFAULT_SF2_WRITE_OPTIONS
};

const DEFAULT_DLS_WRITE_OPTIONS: WorkerDLSWriteOptions = {
    ...DEFAULT_BANK_WRITE_OPTIONS
};

type WorkerSynthWriteOptions<K> = K & {
    progressFunction?: (
        args: SynthesizerProgress["workerSynthWriteFile"]
    ) => unknown;
};

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
        context: BaseAudioContext,
        workerPostMessage: typeof Worker.prototype.postMessage,
        config: Partial<SynthConfig> = DEFAULT_SYNTH_CONFIG
    ) {
        // Ensure default values for options
        const synthConfig = fillWithDefaults(config, DEFAULT_SYNTH_CONFIG);
        if (synthConfig.oneOutput) {
            throw new Error(
                "One output mode is not supported in the WorkerSynthesizer."
            );
        }

        let worklet: AudioWorkletNode;
        // Create the audio worklet node
        try {
            const workletConstructor =
                synthConfig?.audioNodeCreators?.worklet ??
                ((context, name, options) => {
                    return new AudioWorkletNode(context, name, options);
                });
            worklet = workletConstructor(
                context,
                PLAYBACK_WORKLET_PROCESSOR_NAME,
                {
                    outputChannelCount: new Array<number>(18).fill(2),
                    numberOfOutputs: 18,
                    processorOptions: {
                        oneOutput: synthConfig.oneOutput,
                        enableEventSystem: synthConfig.enableEventSystem
                    }
                }
            );
        } catch (error) {
            console.error(error);
            throw new Error(
                "Could not create the AudioWorkletNode. Did you forget to registerPlaybackWorklet()?"
            );
        }
        super(
            worklet,
            workerPostMessage as (
                data: BasicSynthesizerMessage,
                transfer?: Transferable[]
            ) => unknown,
            synthConfig
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
                sampleRate: this.context.sampleRate
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
     * @param e The event received from the Worker.
     */
    public handleWorkerMessage(e: BasicSynthesizerReturnMessage) {
        this.timeOffset = e.currentTime - this.context.currentTime;
        this.handleMessage(e);
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
            this.awaitWorkerResponse("workerSynthWriteFile", (data) =>
                resolve(data)
            );
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
            this.awaitWorkerResponse("workerSynthWriteFile", (data) =>
                resolve(data)
            );
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
            this.awaitWorkerResponse("workerSynthWriteFile", (data) =>
                resolve(data.binary)
            );
            this.post({
                type: "writeRMIDI",
                data: postOptions,
                channelNumber: -1
            });
        });
    }

    /**
     * Renders the current song in the connected sequencer to Float32 buffers.
     * @param sampleRate The sample rate to use, in Hertz.
     * @param renderOptions Extra options for the render.
     * @returns A single audioBuffer if separate channels were not enabled, otherwise 16.
     * @remarks
     * This stops the synthesizer.
     */
    public async renderAudio(
        sampleRate: number,
        renderOptions: Partial<WorkerRenderAudioOptions> = DEFAULT_WORKER_RENDER_AUDIO_OPTIONS
    ): Promise<AudioBuffer[]> {
        const options = fillWithDefaults(
            renderOptions,
            DEFAULT_WORKER_RENDER_AUDIO_OPTIONS
        );
        if (options.enableEffects && options.separateChannels) {
            throw new Error("Effects cannot be applied to separate channels.");
        }
        return new Promise((resolve) => {
            // First pass: Worker renders the dry audio
            this.awaitWorkerResponse("renderAudio", (data) => {
                this.revokeProgressTracker("renderAudio");
                const bufferLength = data.dry[0][0].length;
                // Convert to audio buffers
                const dryChannels = data.dry.map((dryPair) => {
                    const buffer = new AudioBuffer({
                        sampleRate,
                        numberOfChannels: 2,
                        length: bufferLength
                    });
                    buffer.copyToChannel(
                        dryPair[0] as Float32Array<ArrayBuffer>,
                        0
                    );
                    buffer.copyToChannel(
                        dryPair[1] as Float32Array<ArrayBuffer>,
                        1
                    );
                    return buffer;
                });
                if (options.enableEffects) {
                    // Append effects
                    const buffer = new AudioBuffer({
                        sampleRate,
                        numberOfChannels: 2,
                        length: bufferLength
                    });
                    buffer.copyToChannel(
                        data.effects[0] as Float32Array<ArrayBuffer>,
                        0
                    );
                    buffer.copyToChannel(
                        data.effects[1] as Float32Array<ArrayBuffer>,
                        1
                    );
                    dryChannels.push(buffer);
                }
                resolve(dryChannels);
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
}
