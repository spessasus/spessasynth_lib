import {
    DefaultXGReverb,
    type GSReverbParameter,
    type GSReverbProcessor,
    SPESSA_BUFSIZE,
    type XGReverbBlock,
    type XGSystemEffectBlockSnapshot
} from "spessasynth_core";

/**
 * Captures the reverb input of the GS reverb processor (convolver mode).
 */
class GSReverbCapture implements GSReverbProcessor {
    public character = 0;
    public delayFeedback = 0;
    public level = 64;
    public preDelayTime = 0;
    public preLowpass = 0;
    public time = 0;

    private readonly capture: ReverbCapture;

    public constructor(capture: ReverbCapture) {
        this.capture = capture;
    }

    public getSnapshot(): GSReverbParameter {
        return {
            character: this.character,
            delayFeedback: this.delayFeedback,
            level: this.level,
            preDelayTime: this.preDelayTime,
            preLowpass: this.preLowpass,
            time: this.time
        };
    }

    public applySnapshot(snapshot: GSReverbParameter) {
        this.character = snapshot.character;
        this.delayFeedback = snapshot.delayFeedback;
        this.level = snapshot.level;
        this.preDelayTime = snapshot.preDelayTime;
        this.preLowpass = snapshot.preLowpass;
        this.time = snapshot.time;
    }

    public process(
        input: Float32Array,
        _outputLeft: Float32Array,
        _outputRight: Float32Array,
        _startIndex: number,
        sampleCount: number
    ): void {
        // Level 64 is the default
        const gain = this.level / 64;
        const { capturedLeft, capturedRight } = this.capture;
        for (let i = 0; i < sampleCount; i++) {
            const sample = input[i] * gain;
            capturedLeft[i] = sample;
            capturedRight[i] = sample;
        }
    }
}

/**
 * Captures the stereo reverb input of the XG reverb block (convolver mode).
 */
class XGReverbCapture implements XGReverbBlock {
    private readonly capture: ReverbCapture;
    private readonly parameters: DefaultXGReverb;

    public constructor(capture: ReverbCapture, sampleRate: number) {
        this.capture = capture;
        this.parameters = new DefaultXGReverb(sampleRate, SPESSA_BUFSIZE);
    }

    public get return() {
        return this.parameters.return;
    }

    public set return(value: number) {
        this.parameters.return = value;
    }

    public get pan() {
        return this.parameters.pan;
    }

    public set pan(value: number) {
        this.parameters.pan = value;
    }

    public setType(type: number) {
        this.parameters.setType(type);
    }

    public getType() {
        return this.parameters.getType();
    }

    public reset() {
        this.parameters.reset();
    }

    public setParameter(param: number, value: number) {
        this.parameters.setParameter(param, value);
    }

    public getSnapshot() {
        return this.parameters.getSnapshot();
    }

    public applySnapshot(snapshot: XGSystemEffectBlockSnapshot) {
        this.parameters.applySnapshot(snapshot);
    }

    public process(
        inputLeft: Float32Array,
        inputRight: Float32Array,
        _outputLeft: Float32Array,
        _outputRight: Float32Array,
        _startIndex: number,
        sampleCount: number
    ): void {
        // Return 64 is the default
        const gain = this.parameters.return / 64;
        // 1 is hard left, 64 is center, 127 is hard right
        const pan = Math.min(127, Math.max(1, this.parameters.pan));
        const gainLeft = gain * Math.min(1, (127 - pan) / 63);
        const gainRight = gain * Math.min(1, (pan - 1) / 63);
        const { capturedLeft, capturedRight } = this.capture;
        for (let i = 0; i < sampleCount; i++) {
            capturedLeft[i] = inputLeft[i] * gainLeft;
            capturedRight[i] = inputRight[i] * gainRight;
        }
    }
}

/**
 * Passthrough for capturing reverb (convolver mode).
 * Pass {@link gsReverb} and {@link xgReverb} to the synthesizer.
 * Both write into the same stereo capture, as only one of them is active at a time.
 */
export class ReverbCapture {
    public readonly capturedLeft = new Float32Array(SPESSA_BUFSIZE);
    public readonly capturedRight = new Float32Array(SPESSA_BUFSIZE);

    public readonly gsReverb: GSReverbProcessor;
    public readonly xgReverb: XGReverbBlock;

    public constructor(sampleRate: number) {
        this.gsReverb = new GSReverbCapture(this);
        this.xgReverb = new XGReverbCapture(this, sampleRate);
    }

    /**
     * Copies the captured data into the output and clears the capture.
     * Clearing ensures that the last block does not repeat when the reverb is not processed (e.g. effects are disabled).
     * @param outputLeft The left output buffer.
     * @param outputRight The right output buffer.
     * @param startIndex The index to start writing at in the output buffers.
     * @param sampleCount The amount of samples to move.
     */
    public moveCapturedData(
        outputLeft: Float32Array,
        outputRight: Float32Array,
        startIndex: number,
        sampleCount: number
    ) {
        const { capturedLeft, capturedRight } = this;
        for (let i = 0; i < sampleCount; i++) {
            const outIndex = startIndex + i;
            outputLeft[outIndex] = capturedLeft[i];
            outputRight[outIndex] = capturedRight[i];
            capturedLeft[i] = 0;
            capturedRight[i] = 0;
        }
    }
}
