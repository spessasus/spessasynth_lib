import { fillWithDefaults } from "../../utils/fill_with_defaults";
import { BasicSynthesizer } from "../basic/basic_synthesizer";
import { DEFAULT_SYNTH_CONFIG } from "../basic/synth_config";
import type { SynthConfig } from "../basic/types";
import type {
    BasicSynthesizerMessage,
    BasicSynthesizerReturnMessage,
    SynthesizerProgress,
    SynthesizerReturn,
    WorkerBankWriteOptions,
    WorkerDLSWriteOptions,
    WorkerRMIDIWriteOptions,
    WorkerSoundFont2WriteOptions
} from "../types";
import {
    getPlaybackWorkletURL,
    PLAYBACK_WORKLET_PROCESSOR_NAME
} from "./playback_worklet";
import {
    DEFAULT_WORKER_RENDER_AUDIO_OPTIONS,
    type WorkerRenderAudioOptions
} from "./render_audio_worker";
import { resampleAudioBuffer } from "../../utils/resample_audio_buffer";

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

/**
 * Options for writing a file with the {@link WorkerSynthesizer}.
 *
 * @group Synthesizer.Worker
 */
export type WorkerSynthWriteOptions<K> = K & {
    progressFunction?: (
        args: SynthesizerProgress["workerSynthWriteFile"]
    ) => unknown;
};

/**
 * Result of split rendered audio.
 *
 * @group Synthesizer.Worker
 */
export interface RenderAudioResult {
    /**
     * The complete stereo mix, including the effects and convolver.
     */
    output: AudioBuffer;
    /**
     * An array of 16 `AudioBuffer`s, one for each MIDI channel.
     * These are the dry channel outputs and are intended for visualization only.
     */
    visual: AudioBuffer[];
}

interface RenderAudioInternalResult {
    visual: AudioBuffer[];
    output: AudioBuffer;
}

/**
 * Options for rendering the audio data in {@link WorkerSynthesizer}.
 *
 * @group Synthesizer.Worker
 */
export type RenderAudioOptions = Omit<
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
 * This synthesizer uses a Worker communicating with an AudioWorklet to provide real-time playback along with methods to export the data in various formats.
 *
 * > **Tip**
 * >
 * > A comparison of both synthesizers [can be found here.](../../../docs/extra/comparing-synthesizers.md).
 *
 * > **Note**
 * >
 * > An example demonstrating capabilities of this synthesizer [can be found here](../../../docs/getting-started/worker-synth-example.md).
 *
 * @group Synthesizer.Worker
 */
export class WorkerSynthesizer extends BasicSynthesizer {
    /**
     * Time offset for syncing with the synth
     * @private
     */
    private timeOffset = 0;

    /**
     * Creates a new instance of a Worker-based synthesizer.
     *
     * > **Warning**
     * >
     * > Make sure to {@link WorkerSynthesizer.registerPlaybackWorklet}!
     *
     * > **Important**
     * >
     * > Also see {@link WorkerSynthesizerCore} for initializing the worker side of the synthesizer.
     *
     *
     * @example
     * Below is a simple example of creating a new synthesizer.
     * Note that the two snippets are two files, one for the worker and one in the main thread.
     *
     * ```js
     * // worker
     * let workerSynthCore;
     * // Wait for the first message with parameters
     * onmessage = (e) => {
     *     if (e.ports[0]) {
     *         // Initialize
     *         workerSynthCore = new WorkerSynthesizerCore(
     *             e.data,
     *             e.ports[0],
     *             postMessage.bind(this)
     *         );
     *     } else {
     *         // Handle all other messages
     *         void workerSynthCore.handleMessage(e.data);
     *     }
     * };
     * ```
     *
     * ```ts
     * // main thread
     * // create audio context
     * const context = new AudioContext({
     *     sampleRate: 44100
     * });
     * // register worklet
     * WorkerSynthesizer.registerPlaybackWorklet(context);
     * // create the worker
     * const worker = new Worker(
     *     // make sure that your path is correct
     *     new URL("worker.js", import.meta.url)
     * );
     * // create the synthesizer and bind it to the worker
     * const synth = new WorkerSynthesizer(context, worker.postMessage.bind(worker));
     * worker.onmessage = (e) => synth.handleWorkerMessage(e.data);
     * ```
     *
     * @param context The audio context for the synthesizer to use.
     * @param workerPostMessage The `postMessage` function of the Worker synthesizer will use.
     * The raw `Worker.postMessage` can be passed here.
     * This can be used for intercepting messages.
     * @param config Optional configuration for the synthesizer.
     *
     * @group Synthesizer.Worker
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

    /**
     * Returns the adjusted time, in sync with worker's internal time which may differ from the AudioContext time.
     */
    public get currentTime() {
        return this.context.currentTime + this.timeOffset;
    }

    /**
     * Registers an audio worklet for the WorkerSynthesizer.
     * @param context The context to register the worklet for.
     * @param maxQueueSize The maximum amount of 128-sample chunks to store in the worklet.
     * Higher values result in less breakups but higher latency.
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
     * Handles a return message from the worker.
     *
     * Usually you're going to do
     * ```ts
     * yourWorker.onmessage = (e) => synth.handleWorkerMessage(e.data);
     * ```
     * but this can also be used to intercept return messages if needed.
     * @param events The events received from the Worker.
     */
    public handleWorkerMessage(events: BasicSynthesizerReturnMessage[]) {
        if (events.length > 0)
            this.timeOffset = events[0].currentTime - this.context.currentTime;
        this.handleMessages(events);
    }

    /**
     * Writes a DLS file directly in the worker.
     * This pauses the playback if it is playing.
     *
     * @param options Optional configuration for writing the DLS file.
     * @returns The file array buffer and its suggested name.
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
     * This pauses the playback if it is playing.
     *
     * @param options Optional configuration for writing the SF2 file.
     * @returns The file array buffer and its suggested name.
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
     * This pauses the playback if it is playing.
     *
     * @param options Optional configuration for writing the RMIDI file.
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
     * Renders the current song in the connected sequencer to a single stereo `AudioBuffer`.
     * This pauses the playback if it is playing.
     * @param sampleRate The sample rate to use, in Hertz.
     * @param renderOptions Options for rendering the audio data.
     * @returns The complete stereo output, including the effects and convolver.
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
        return rendered.output;
    }

    /**
     * Renders the current song in the connected sequencer to the complete stereo output plus separate channel buffers.
     * This pauses the playback if it is playing
     * @param sampleRate The sample rate to use, in Hertz.
     * @param renderOptions Options for rendering the audio data.
     * @returns The complete stereo output and the separate visualization channels.
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
        return {
            output: rendered.output,
            visual: rendered.visual
        };
    }

    private async renderAudioInternal(
        sampleRate: number,
        options: WorkerRenderAudioOptions
    ): Promise<RenderAudioInternalResult> {
        return new Promise((resolve) => {
            // Worker renders the complete output and the visualization channels
            this.awaitWorkerResponse("renderAudio", async (data) => {
                this.revokeProgressTracker("renderAudio");
                const convolverData = data.convolver;
                const visual = data.visual.map((dryPair) =>
                    makeAudioBuffer(dryPair, sampleRate)
                );
                const output = makeAudioBuffer(data.output, sampleRate);
                if (
                    options.enableEffects &&
                    convolverData &&
                    this.convolverNode?.buffer
                ) {
                    const convolver = await this.renderConvolverBuffer(
                        convolverData,
                        sampleRate
                    );
                    mergeStereoAudioBuffer(output, convolver);
                }
                resolve({ visual, output });
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
