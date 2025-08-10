import { audioToWav } from "spessasynth_core";
import type { WaveMetadata } from "./types";

/**
 * Converts an audio buffer into a wave file.
 * @param audioBuffer The audio data channels.
 * @param normalizeAudio This will find the max sample point and set it to 1, and scale others with it. Recommended.
 * @param channelOffset The channel offset in the AudioBuffer. Defaults to 0.
 * @param metadata The metadata to write into the file.
 * @param loop The loop start and end points in seconds. Undefined if no loop should be written.
 * @param channelCount The amount of channels from the AudioBuffer to write. Defaults to all.
 * @returns The binary file.
 */
export function audioBufferToWav(
    audioBuffer: AudioBuffer,
    normalizeAudio = true,
    channelOffset = 0,
    metadata: Partial<WaveMetadata> = {},
    loop?: {
        start: number;
        end: number;
    },
    channelCount: number = audioBuffer.numberOfChannels
): Blob {
    const channels: Float32Array[] = [];
    for (let i = channelOffset; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
        if (channels.length >= channelCount) {
            break;
        }
    }
    return new Blob(
        [
            audioToWav(
                channels,
                audioBuffer.sampleRate,
                normalizeAudio,
                metadata,
                loop
            )
        ],
        { type: "audio/wav" }
    );
}
