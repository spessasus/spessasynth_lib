import { SpessaSynthCoreUtils } from "spessasynth_core";
import { consoleColors } from "./utils/other.ts";
import { WORKLET_PROCESSOR_NAME } from "./synthesizer/worklet/worklet_processor_name.ts";
import type { PassedProcessorParameters } from "./synthesizer/types.ts";
import { WorkletSynthesizerCore } from "./synthesizer/worklet/worklet_synthesizer_core.ts";

class WorkletSynthesizerProcessor extends AudioWorkletProcessor {
    public readonly process: (
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ) => boolean;
    private readonly core: WorkletSynthesizerCore;

    public constructor(options: {
        processorOptions: PassedProcessorParameters;
    }) {
        super();
        this.core = new WorkletSynthesizerCore(
            sampleRate, // AudioWorkletGlobalScope
            currentTime, // AudioWorkletGlobalScope, sync with audioContext time
            this.port,
            options.processorOptions
        );
        this.process = this.core.process.bind(this.core);
    }
}

registerProcessor(WORKLET_PROCESSOR_NAME, WorkletSynthesizerProcessor);
SpessaSynthCoreUtils.SpessaSynthInfo(
    "%cProcessor successfully registered!",
    consoleColors.recognized
);
