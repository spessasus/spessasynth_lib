import { SpessaLog } from "spessasynth_core";
import { ConsoleColors } from "./utils/other";
import { WORKLET_PROCESSOR_NAME } from "./synthesizer/worklet/worklet_processor_name";
import { WorkletSynthesizerCore } from "./synthesizer/worklet/worklet_synthesizer_core";
import type { SynthCoreConfig } from "./synthesizer/basic/types";

class WorkletSynthesizerProcessor extends AudioWorkletProcessor {
    private readonly core: WorkletSynthesizerCore;

    public constructor(options: { processorOptions: SynthCoreConfig }) {
        super();
        this.core = new WorkletSynthesizerCore(
            {
                ...options.processorOptions,
                sampleRate, // AudioWorkletGlobalScope
                initialTime: currentTime // AudioWorkletGlobalScope, sync with audioContext time
            },
            this.port
        );
    }

    // Don't bind, do it like this for it to work with Chrome 109
    public process(inputs: Float32Array[][], outputs: Float32Array[][]) {
        return this.core.process(inputs, outputs);
    }
}

registerProcessor(WORKLET_PROCESSOR_NAME, WorkletSynthesizerProcessor);
SpessaLog.info(
    "%cProcessor successfully registered!",
    ConsoleColors.recognized
);
