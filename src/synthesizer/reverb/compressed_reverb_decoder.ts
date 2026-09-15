import { rbCompressed } from "./rb_compressed.min";
import { inflateSync } from "fflate";

// Convert the base64 string to array buffer
const binaryString = atob(String(rbCompressed));
const binary = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
    binary[i] = binaryString.charCodeAt(i);
}

/**
 * The reverb is zlib compressed, decompress here.
 * Yes, this does actually decrease the total bundle size!
 * And then the audio data is FLAC compressed. TODO check if we can use opus/vorbis?
 */
const reverbBufferBinary: ArrayBuffer = inflateSync(binary).buffer;
export { reverbBufferBinary };
