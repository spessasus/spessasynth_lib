import { DEFAULT_CHORUS_CONFIG } from "./fancy_chorus.js";
import type { SynthConfig } from "./types";

export const DEFAULT_SYNTH_CONFIG: SynthConfig = {
    effectsConfig: {
        chorusEnabled: true,
        chorusConfig: DEFAULT_CHORUS_CONFIG,

        reverbEnabled: true,
        reverbImpulseResponse: undefined // Will load the integrated one
    },
    audioNodeCreators: undefined,
    enableEffectsSystem: true
};
