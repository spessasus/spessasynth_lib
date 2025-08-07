import type { PassedProcessorParameters } from "../types";

export interface SynthConfig {
    /**
     * If the synth should use one output with 32 channels (2 audio channels for each midi channel).
     */
    oneOutput: boolean;

    /**
     * Configuration for the effects.
     */
    effects: EffectsConfig;

    /**
     * Custom audio node creation functions for Web Audio wrappers, such as standardized-audio-context.
     * Pass undefined to use the Web Audio API.
     */
    audioNodeCreators?: AudioNodeCreators;
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

export interface EffectsConfig {
    /**
     * If the effects system should be enabled.
     */
    enabled: boolean;
    /**
     * The configuration for chorus. Pass undefined to use defaults.
     */
    chorus: Partial<ChorusConfig>;
    /**
     * The impulse response for the reverb. Pass undefined to use defaults
     */
    reverb: ReverbConfig;
}

export interface ReverbConfig {
    /**
     * Indicates if the reverb effect is enabled.
     * This can only be set once.
     */
    readonly enabled: boolean;
    /**
     * The impulse response for the reverb. Pass undefined to use default one.
     */
    impulseResponse?: AudioBuffer;
}

export interface ChorusConfig {
    /**
     * The amount of delay nodes (for each channel) and the corresponding oscillators.
     */
    nodesAmount: number;
    /**
     * The initial delay, in seconds.
     */
    defaultDelay: number;
    /**
     * The difference between delays in the delay nodes.
     */
    delayVariation: number;
    /**
     * The difference of delays between two channels (added to the right channel).
     */
    stereoDifference: number;
    /**
     * The initial delay time oscillator frequency, in Hz.
     */
    oscillatorFrequency: number;
    /**
     * The difference between frequencies of oscillators, in Hz.
     */
    oscillatorFrequencyVariation: number;
    /**
     * How much will oscillator alter the delay in delay nodes, in seconds.
     */
    oscillatorGain: number;
    /**
     * Indicates if the chorus effect is enabled.
     * This can only be set once.
     */
    enabled: boolean;
}
