import { reverbBufferBinary } from "./reverb_as_binary.js";

/**
 * Creates a reverb processor.
 */
export function getReverbProcessor(
    context: BaseAudioContext,
    reverbBuffer: AudioBuffer | undefined = undefined
): { conv: ConvolverNode; promise: Promise<AudioBuffer> } {
    let solve: () => void = () => {};
    let promise: Promise<AudioBuffer> = new Promise(
        (r) => (solve = r as () => unknown)
    );
    const convolver = context.createConvolver();
    if (reverbBuffer && typeof solve !== "undefined") {
        convolver.buffer = reverbBuffer;
        solve();
    } else {
        // decode
        promise = context.decodeAudioData(reverbBufferBinary.slice(0));
        promise.then((b) => {
            convolver.buffer = b;
        });
    }
    return {
        conv: convolver,
        promise: promise
    };
}
