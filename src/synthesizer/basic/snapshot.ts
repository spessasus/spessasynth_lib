import {
    ChannelSnapshot,
    KeyModifier,
    type MasterParameterType,
    SynthesizerSnapshot
} from "spessasynth_core";
import type { EffectsConfig } from "../audio_effects/types.ts";

// Extended synthesizer snapshot to contain effects
export class LibSynthesizerSnapshot extends SynthesizerSnapshot {
    // Effects configuration of this synthesizer.
    public effectsConfig: EffectsConfig;

    public constructor(
        channelSnapshots: ChannelSnapshot[],
        masterParameters: MasterParameterType,
        keyMappings: (KeyModifier | undefined)[][],
        effectsConfig: EffectsConfig
    ) {
        super(channelSnapshots, masterParameters, keyMappings);
        this.effectsConfig = { ...effectsConfig };
    }

    public getRegularSnapshot(): SynthesizerSnapshot {
        return new SynthesizerSnapshot(
            [...this.channelSnapshots],
            { ...this.masterParameters },
            [...this.keyMappings]
        );
    }
}
