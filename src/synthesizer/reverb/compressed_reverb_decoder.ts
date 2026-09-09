import { SpessaSynthCoreUtils } from "spessasynth_core";
import { rbCompressed } from "./rb_compressed.min.js";

// Convert the base64 string to array buffer
const binaryString = atob(String(rbCompressed));
const binary = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
    binary[i] = binaryString.charCodeAt(i);
}

/**
 * The reverb is zlib compressed, decompress here.
 */
const reverbBufferBinary: ArrayBuffer =
    SpessaSynthCoreUtils.inflateSync(binary).buffer;
export { reverbBufferBinary };
