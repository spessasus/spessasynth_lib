import { WorkletSynthesizerProcessor } from "./synthesizer/worklet/worklet_processor_core.ts";
import { SpessaSynthCoreUtils } from "spessasynth_core";
import { consoleColors } from "./utils/other.ts";
import { WORKLET_PROCESSOR_NAME } from "./synthesizer/worklet/worklet_processor_name.ts";

registerProcessor(WORKLET_PROCESSOR_NAME, WorkletSynthesizerProcessor);
SpessaSynthCoreUtils.SpessaSynthInfo(
    "%cProcessor successfully registered!",
    consoleColors.recognized
);
