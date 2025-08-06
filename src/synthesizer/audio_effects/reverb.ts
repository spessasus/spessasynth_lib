import { reverbBufferBinary } from "./reverb_as_binary.js";

/**
 * Creates a reverb processor.
 * @returns The convolver node and a promise for when the audio buffer gets set.
 */
export function getReverbProcessor(
    context: BaseAudioContext,
    reverbBuffer: AudioBuffer | undefined = undefined
): { conv: ConvolverNode; promise: Promise<AudioBuffer> } {
    let solve: (() => void) | undefined;
    let promise = new Promise<AudioBuffer>((r) => (solve = r as () => unknown));
    const convolver = context.createConvolver();
    if (reverbBuffer && typeof solve !== "undefined") {
        convolver.buffer = reverbBuffer;
        solve();
    } else {
        // Decode
        promise = context.decodeAudioData(reverbBufferBinary.slice(0));
        void promise.then((b) => {
            convolver.buffer = b;
        });
    }
    return {
        conv: convolver,
        promise: promise
    };
}
