import { BasicSynthesizer } from "../basic/basic_synthesizer.ts";
import type { SynthConfig } from "../audio_effects/types.ts";
import { DEFAULT_SYNTH_CONFIG } from "../audio_effects/effects_config.ts";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import { PLAYBACK_WORKLET_PROCESSOR_NAME, PLAYBACK_WORKLET_URL } from "./playback_worklet.ts";
import type { BasicSynthesizerMessage, BasicSynthesizerReturnMessage } from "../types.ts";

/**
 * This synthesizer uses a Worker containing the processor and an audio worklet node for playback.
 */
export class WorkerSynthesizer extends BasicSynthesizer {
    /**
     * Creates a new instance of a Worker-based synthesizer.
     * @param context The audio context.
     * @param workerPostMessage The postMessage for the worker containing the synthesizer core.
     * @param config Optional configuration for the synthesizer.
     */
    public constructor(
        context: BaseAudioContext,
        workerPostMessage: (
            m: BasicSynthesizerMessage,
            t?: Transferable[]
        ) => unknown,
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
                    outputChannelCount: Array<number>(18).fill(2),
                    numberOfOutputs: 18,
                    processorOptions: {
                        oneOutput: synthConfig.oneOutput,
                        enableEventSystem: synthConfig.effects.enabled
                    }
                }
            );
        } catch (e) {
            console.error(e);
            throw new Error(
                "Could not create the AudioWorkletNode. Did you forget to registerPlaybackWorklet()?"
            );
        }
        super(worklet, workerPostMessage, synthConfig);

        // Create a message channel for communication between the worker and the worklet
        const messageChannel = new MessageChannel();
        const workerPort = messageChannel.port1;
        const workletPort = messageChannel.port2;
        this.worklet.port.postMessage(null, [workletPort]);
        this.post(
            {
                type: "workerInitialization",
                channelNumber: -1,
                data: {
                    currentTime: this.context.currentTime,
                    sampleRate: this.context.sampleRate
                }
            },
            [workerPort]
        );
    }

    /**
     * Registers an audio worklet. for the WorkerSynthesizer.
     * @param context The context to register the worklet for.
     */
    public static async registerPlaybackWorklet(context: BaseAudioContext) {
        if (!context?.audioWorklet.addModule) {
            throw new Error("Audio worklet is not supported.");
        }
        return context.audioWorklet.addModule(PLAYBACK_WORKLET_URL);
    }

    /**
     * Handles a return message from the Worker.
     * @param e The event received from the Worker.
     */
    public handleWorkerMessage(e: BasicSynthesizerReturnMessage) {
        this.handleMessage(e);
    }
}
