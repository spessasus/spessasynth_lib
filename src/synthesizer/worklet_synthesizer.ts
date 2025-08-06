import { DEFAULT_SYNTH_CONFIG } from "./audio_effects/effects_config.js";
import { WORKLET_PROCESSOR_NAME } from "./worklet_url.js";
import type { SynthConfig } from "./audio_effects/types";
import { BasicSynthesizer } from "./basic_synthesizer.ts";
import type { StartRenderingDataConfig } from "./types.ts";

// This synthesizer uses an audio worklet node containing the processor.
export class WorkletSynthesizer extends BasicSynthesizer {
    /**
     * Creates a new instance of the SpessaSynth synthesizer.
     * @param targetNode The target node to connect to.
     * @param config Optional configuration for the synthesizer.
     */
    public constructor(
        targetNode: AudioNode,
        config: Partial<SynthConfig> = DEFAULT_SYNTH_CONFIG
    ) {
        let worklet: AudioWorkletNode;
        // Create the audio worklet node
        try {
            const workletConstructor =
                config?.audioNodeCreators?.worklet ??
                ((context, name, options) => {
                    return new AudioWorkletNode(context, name, options);
                });
            worklet = workletConstructor(
                targetNode.context,
                WORKLET_PROCESSOR_NAME,
                {
                    outputChannelCount: Array(18).fill(2),
                    numberOfOutputs: 18,
                    processorOptions: {
                        midiChannels: 16,
                        enableEventSystem:
                            config?.enableEffectsSystem ??
                            DEFAULT_SYNTH_CONFIG.enableEffectsSystem
                    }
                }
            ) as AudioWorkletNode;
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
            targetNode,
            config
        );
    }

    public startOfflineRender(config: StartRenderingDataConfig) {
        this.post(
            {
                type: "startOfflineRender",
                data: config,
                channelNumber: -1
            },
            config.soundBankList
        );
    }
}
