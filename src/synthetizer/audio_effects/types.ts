import type { PassedProcessorParameters } from "../types";

export type SynthConfig = {
    // Configuration for the effects.
    effectsConfig: EffectsConfig;
    // Custom audio node creation functions for Web Audio wrappers, such as standardized-audio-context.
    // Pass undefined to use the Web Audio API.
    audioNodeCreators?: {
        worklet: (
            context: BaseAudioContext,
            workletName: string,
            options?: AudioWorkletNodeOptions & {
                processorOptions: PassedProcessorParameters;
            }
        ) => unknown;
    };
};

export type EffectsConfig = {
    // Indicates if the chorus effect is enabled.
    // This can only be set once.
    readonly chorusEnabled: boolean;
    // The configuration for chorus. Pass undefined to use defaults.
    chorusConfig: Partial<ChorusConfig>;
    // Indicates if the reverb effect is enabled.
    // This can only be set once.
    readonly reverbEnabled: boolean;
    // The impulse response for the reverb. Pass undefined to use defaults
    reverbImpulseResponse?: AudioBuffer;
};

export type ChorusConfig = {
    // The amount of delay nodes (for each channel) and the corresponding oscillators.
    nodesAmount: number;
    // The initial delay, in seconds.
    defaultDelay: number;
    // The difference between delays in the delay nodes.
    delayVariation: number;
    // The difference of delays between two channels (added to the right channel).
    stereoDifference: number;
    // The initial delay time oscillator frequency, in Hz.
    oscillatorFrequency: number;
    // The difference between frequencies of oscillators, in Hz.
    oscillatorFrequencyVariation: number;
    // How much will oscillator alter the delay in delay nodes, in seconds.
    oscillatorGain: number;
};
