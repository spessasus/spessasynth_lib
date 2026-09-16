import type { SynthProcessorOptions } from "spessasynth_core";

/**
 * Configuration options for the synthesizer.
 *
 * @group Synthesizer.Basic
 */
export interface SynthConfig {
    /**
     * Custom audio node creation functions for Web Audio wrappers, such as `standardized-audio-context`.
     * Pass undefined to use the Web Audio API.
     */
    audioNodeCreators?: AudioNodeCreators;

    /**
     * If the event system should be enabled.
     * This can only be set once.
     *
     * If false, no event will be emitted.
     */
    eventsEnabled: boolean;

    /**
     * If the convolver mode should be enabled.
     * In the convolver mode, the synthesizer captures its reverb output and feeds it into a Web Audio `ConvolverNode`.
     * This lets you use a custom impulse response for the synth's reverb tail instead of the built-in reverb engine.
     *
     * - When enabled, the reverb is removed from the main output and exposed as a separate stream that is processed by the `ConvolverNode`.
     * - The impulse response is loaded internally from the library and can be replaced by assigning a new buffer to the {@link BasicSynthesizer.convolverNode}.
     */
    convolverMode: boolean;
}

export interface SynthCoreConfig {
    sampleRate: number;
    initialTime: number;
    convolverMode: boolean;
    processorConfig: Partial<SynthProcessorOptions>;
}

/**
 * Custom audio node creation functions for Web Audio wrappers, such as `standardized-audio-context`.
 *
 * @group Synthesizer.Basic
 */
export interface AudioNodeCreators {
    /**
     * A custom creator for an `AudioWorkletNode`.
     * This is the exact same signature as the `AudioWorkletNode` constructor.
     *
     * @example
     * An example function that creates the standard worklet node looks like this:
     *
     * ```js
     * (context: BaseAudioContext, name: string, options: AudioWorkletNodeOptions) => {
     *     return new AudioWorkletNode(context, name, options);
     * };
     * ```
     *
     * @param context The context of the node.
     * @param workletName The name of the registered processor
     * @param options `AudioWorkletNodeOptions`.
     */
    worklet: (
        context: BaseAudioContext,
        workletName: string,
        options?: AudioWorkletNodeOptions & {
            processorOptions: SynthCoreConfig;
        }
    ) => AudioWorkletNode;
}
