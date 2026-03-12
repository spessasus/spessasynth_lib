import type { PassedProcessorParameters } from "../types";

export interface SynthConfig {
    /**
     * If the synth should use one output with 32 channels (2 audio channels for each midi channel).
     */
    oneOutput: boolean;

    /**
     * @deprecated Deprecated parameter, does nothing.
     */
    initializeChorusProcessor?: boolean;

    /**
     * @deprecated Deprecated parameter, does nothing.
     */
    initializeReverbProcessor?: boolean;

    /**
     * Custom audio node creation functions for Web Audio wrappers, such as standardized-audio-context.
     * Pass undefined to use the Web Audio API.
     */
    audioNodeCreators?: AudioNodeCreators;

    /**
     * If the event system should be enabled. This can only be set once.
     */
    enableEventSystem: boolean;
}

export interface AudioNodeCreators {
    /**
     * A custom creator for an AudioWorkletNode.
     * @param context
     * @param workletName
     * @param options
     */
    worklet: (
        context: BaseAudioContext,
        workletName: string,
        options?: AudioWorkletNodeOptions & {
            processorOptions: PassedProcessorParameters;
        }
    ) => AudioWorkletNode;
}
