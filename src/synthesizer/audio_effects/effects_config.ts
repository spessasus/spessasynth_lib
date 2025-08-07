import { DEFAULT_CHORUS_CONFIG } from "./chorus.js";
import type { ReverbConfig, SynthConfig } from "./types";

export const DEFAULT_REVERB_CONFIG: ReverbConfig = {
    enabled: true,
    impulseResponse: undefined // Will load the integrated one
};

export const DEFAULT_SYNTH_CONFIG: SynthConfig = {
    effects: {
        enabled: true,
        chorus: DEFAULT_CHORUS_CONFIG,

        reverb: DEFAULT_REVERB_CONFIG
    },
    oneOutput: false,
    audioNodeCreators: undefined
};
