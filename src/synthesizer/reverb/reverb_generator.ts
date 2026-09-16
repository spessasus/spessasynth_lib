export function generateReverbImpulse(
    audioContext: BaseAudioContext,
    duration = 0.5,
    decay = 3
) {
    const sampleRate = audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = audioContext.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            const t = i / length;
            data[i] =
                t < Math.random()
                    ? Math.exp(-decay * t) * (Math.random() - 0.5) * 0.5
                    : 0;
        }
    }
    return impulse;
}
