/**
 * Resamples an AudioBuffer to a new sample rate
 * @param audioBuffer - the original buffer
 * @param sampleRate - target rate in Hz
 * @returns the resampled buffer
 */
export async function resampleAudioBuffer(
    audioBuffer: AudioBuffer,
    sampleRate: number
) {
    if (audioBuffer.sampleRate === sampleRate) {
        return audioBuffer;
    }

    const targetLength = Math.ceil(audioBuffer.duration * sampleRate);

    const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        targetLength,
        sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    return await offlineCtx.startRendering();
}
