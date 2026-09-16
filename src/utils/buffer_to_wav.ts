import { audioToWav, type WaveWriteOptions } from "spessasynth_core";

/**
 * Options for writing a WAV file.
 *
 * @group Writing WAV
 */
export interface LibWaveWriteOptions extends WaveWriteOptions {
    /**
     * The channel offset in the AudioBuffer. Defaults to 0.
     * If the buffer has more than two channels, you can specify the channel offset to use.
     * This is especially useful in when extracting a stereo pair from multichannel audio buffer.
     */
    channelOffset: number;

    /**
     * This option limits the channel count to a given number.
     * Otherwise, all channels starting from {@link LibWaveWriteOptions.channelOffset `channelOffset`} are used.
     */
    channelCount: number;
}

/**
 * SpessaSynth has a helper function for writing wave files.
 * Converts an audio buffer into a fully valid WAVE (.wav) file.
 *
 * > **Important**
 * >
 * > The metadata uses the `INFO` chunk to write the information. It is encoded with `utf-8`
 *
 * @param audioBuffer The buffer to write. Multiple channels are allowed.
 * @param options Additional options for writing the file.
 * @returns The binary file.
 *
 * @group Writing WAV
 */
export function audioBufferToWav(
    audioBuffer: AudioBuffer,
    options?: Partial<LibWaveWriteOptions>
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
