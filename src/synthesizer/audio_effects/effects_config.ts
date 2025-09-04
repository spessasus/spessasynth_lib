import type { SynthConfig } from "./types";

export const DEFAULT_SYNTH_CONFIG: SynthConfig = {
    enableEventSystem: true,
    oneOutput: false,
    audioNodeCreators: undefined,
    initializeChorusProcessor: true,
    initializeReverbProcessor: true
};
