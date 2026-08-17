import type { SynthConfig } from "./types";

export const DEFAULT_SYNTH_CONFIG: SynthConfig = {
    eventsEnabled: true,
    convolverMode: false,
    audioNodeCreators: undefined
};

export const ALL_CHANNELS_OR_DIFFERENT_ACTION = -1;

/**
 * Total output count for both worklets.
 * The outputs are like this, all stereo pairs
 * Main output
 * Convolver (potentially unused)
 * MIDI Channels (Visuals only, do not connect to audio outputs!!!):
 * MIDI Channel 1
 * MIDI Channel 2
 * ...
 * MIDI Channel 16
 * First the effects, then the convolver, then 16 channels
 */
export const TOTAL_OUTPUT_COUNT = 18;
// The number at which channels start
export const VISUAL_CHANNEL_OUTPUTS_START = 2;
// The output of the effects from spessasynth_core
export const MAIN_OUTPUT = 0;
// The output number of convolver
export const CONVOLVER_OUTPUT = 1;
