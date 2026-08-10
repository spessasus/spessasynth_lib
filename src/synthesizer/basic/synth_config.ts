import type { SynthConfig } from "./types";

export const DEFAULT_SYNTH_CONFIG: SynthConfig = {
    eventsEnabled: true,
    oneOutputMode: false,
    convolverMode: false,
    audioNodeCreators: undefined
};

export const ALL_CHANNELS_OR_DIFFERENT_ACTION = -1;

// Total output count for both worklets
// First shared (wet, convolver) then 16 channels
export const TOTAL_OUTPUT_COUNT = 18;
// The number at which channels start
export const CHANNEL_OUTPUTS_START = 2;
