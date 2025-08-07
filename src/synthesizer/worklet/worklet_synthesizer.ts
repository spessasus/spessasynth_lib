import { DEFAULT_SYNTH_CONFIG } from "../audio_effects/effects_config.js";
import { WORKLET_PROCESSOR_NAME } from "./worklet_processor_name.js";
import type { SynthConfig } from "../audio_effects/types.ts";
import { BasicSynthesizer } from "../basic/basic_synthesizer.ts";
import type { OfflineRenderWorkletData } from "../types.ts";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";

/**
 * This synthesizer uses an audio worklet node containing the processor.
 */
export class WorkletSynthesizer extends BasicSynthesizer {
    /**
     * Creates a new instance of an AudioWorklet-based synthesizer.
     * @param context The audio context.
     * @param config Optional configuration for the synthesizer.
     */
    public constructor(
        context: BaseAudioContext,
        config: Partial<SynthConfig> = DEFAULT_SYNTH_CONFIG
    ) {
        // Ensure default values for options
        const synthConfig = fillWithDefaults(config, DEFAULT_SYNTH_CONFIG);

        let outputChannelCount = Array<number>(18).fill(2);
        let numberOfOutputs = 18;

        if (synthConfig.oneOutput) {
            // One output with 36 channels
            outputChannelCount = [36];
            numberOfOutputs = 1;
        }

        let worklet: AudioWorkletNode;
        // Create the audio worklet node
        try {
            const workletConstructor =
                synthConfig?.audioNodeCreators?.worklet ??
                ((context, name, options) => {
                    return new AudioWorkletNode(context, name, options);
                });
            worklet = workletConstructor(context, WORKLET_PROCESSOR_NAME, {
                outputChannelCount,
                numberOfOutputs,
                processorOptions: {
                    midiChannels: 16,
                    oneOutput: synthConfig.oneOutput,
                    enableEventSystem: synthConfig.effects.enabled
                }
            });
        } catch (e) {
            console.error(e);
            throw new Error(
                "Could not create the audioWorklet. Did you forget to addModule()?"
            );
        }
        super(
            worklet,
            (data, transfer = []) => {
                worklet.port.postMessage(data, transfer);
            },
            synthConfig
        );
    }

    /**
     * Starts an offline audio render.
     * @param config The configuration to use.
     * @remarks
     * Do NOT call any other methods after initializing before this one.
     * Chromium seems to ignore
     */
    public async startOfflineRender(config: OfflineRenderWorkletData) {
        this.post(
            {
                type: "startOfflineRender",
                data: config,
                channelNumber: -1
            },
            config.soundBankList.map((b) => b.soundBankBuffer)
        );
        await new Promise((r) =>
            this.awaitWorkletResponse("startOfflineRender", r)
        );
    }

    /**
     * Destroys the synthesizer instance.
     */
    public destroy() {
        this.reverbProcessor?.disconnect();
        this.chorusProcessor?.delete();
        // noinspection JSCheckFunctionSignatures
        this.post({
            channelNumber: 0,
            type: "destroyWorklet",
            data: null
        });
        this.worklet.disconnect();
        // @ts-expect-error destruction!
        // noinspection JSConstantReassignment
        delete this.worklet;
        // @ts-expect-error destruction!
        // noinspection JSConstantReassignment
        delete this.reverbProcessor;
        delete this.chorusProcessor;
    }
}
