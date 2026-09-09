import type {
    ReverbProcessor,
    ReverbProcessorSnapshot
} from "spessasynth_core";

const BLOCK_SIZE = 128;

/**
 * Passthrough for capturing reverb (convolver mode)
 */
export class ReverbCapture implements ReverbProcessor {
    public character = 0;
    public delayFeedback = 0;
    public level = 64;
    public preDelayTime = 0;
    public preLowpass = 0;
    public time = 0;

    public readonly capturedData = new Float32Array(BLOCK_SIZE);

    public getSnapshot(): ReverbProcessorSnapshot {
        return { ...this };
    }

    public process(
        input: Float32Array,
        _outputLeft: Float32Array,
        _outputRight: Float32Array,
        _startIndex: number,
        sampleCount: number
    ): void {
        for (let i = 0; i < sampleCount; i++) {
            this.capturedData[i] = input[i];
        }
    }
}
