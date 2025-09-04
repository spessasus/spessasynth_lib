import { audioToWav, type WaveWriteOptions } from "spessasynth_core";

interface ExtraWaveOptions extends WaveWriteOptions {
    /**
     * The channel offset in the AudioBuffer. Defaults to 0.
     */
    channelOffset: number;

    /**
     * The amount of channels from the AudioBuffer to write. Defaults to all.
     */
    channelCount: number;
}

/**
 * Converts an audio buffer into a wave file.
 * @param audioBuffer The audio data channels.
 * @param options Additional options for writing the file.
 * @returns The binary file.
 */
export function audioBufferToWav(
    audioBuffer: AudioBuffer,
    options?: Partial<ExtraWaveOptions>
): Blob {
    const channels: Float32Array[] = [];
    const channelOffset = options?.channelOffset ?? 0;
    const channelCount = options?.channelCount ?? audioBuffer.numberOfChannels;
    for (let i = channelOffset; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
        if (channels.length >= channelCount) {
            break;
        }
    }
    return new Blob([audioToWav(channels, audioBuffer.sampleRate, options)], {
        type: "audio/wav"
    });
}
