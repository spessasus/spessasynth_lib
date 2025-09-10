import { rbCompressed } from "./rb_compressed.min.js";
import { SpessaSynthCoreUtils } from "spessasynth_core";

// Note: atob is wrapped in a function as this technically goes in the worklet!
export const getDefaultReverbBinary = () => {
    // Convert the base64 string to array buffer
    const binaryString = atob(rbCompressed);
    const binary = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        binary[i] = binaryString.charCodeAt(i);
    }

    /**
     * The reverb is zlib compressed, decompress here.
     */
    return SpessaSynthCoreUtils.inflateSync(binary).buffer;
};
