import type { SynthProcessorOptions } from "spessasynth_core";

export interface SynthConfig {
    /**
     * If the synth should use one output with 36 channels.
     * The channels are ordered as follows: effects (2), convolver (2),
     * then a stereo pair for each MIDI channel.
     */
    oneOutputMode: boolean;

    /**
     * Custom audio node creation functions for Web Audio wrappers, such as standardized-audio-context.
     * Pass undefined to use the Web Audio API.
     */
    audioNodeCreators?: AudioNodeCreators;

    /**
     * If the event system should be enabled. This can only be set once.
     */
    eventsEnabled: boolean;

    /**
     * If the convolver mode should be enabled.
     * In the convolver mode, the reverb is fed into a Web Audio ConvolverNode,
     * which can be used for a custom impulse response.
     */
    convolverMode: boolean;
}

export interface SynthCoreConfig {
    sampleRate: number;
    initialTime: number;
    convolverMode: boolean;
    processorConfig: Partial<SynthProcessorOptions>;
    /**
     * If the synth should use one output with 36 channels.
     * The channels are ordered as follows: effects (2), convolver (2),
     * then a stereo pair for each MIDI channel.
     */
    oneOutputMode: boolean;
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
            processorOptions: SynthCoreConfig;
        }
    ) => AudioWorkletNode;
}
