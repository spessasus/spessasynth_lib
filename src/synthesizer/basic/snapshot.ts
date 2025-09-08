import { ChannelSnapshot, KeyModifier, type MasterParameterType, SynthesizerSnapshot } from "spessasynth_core";
import type { ChorusConfig, ReverbConfig } from "../audio_effects/types.ts";
import { DEFAULT_CHORUS_CONFIG } from "../audio_effects/chorus.ts";
import { DEFAULT_REVERB_CONFIG } from "../audio_effects/reverb.ts";

/**
 * Extended synthesizer snapshot to contain effects
 */
export class LibSynthesizerSnapshot extends SynthesizerSnapshot {
    /**
     * Chorus configuration of this synthesizer.
     */
    public chorusConfig: ChorusConfig;
    /**
     * Reverb configuration of this synthesizer.
     */
    public reverbConfig: ReverbConfig;

    public constructor(
        channelSnapshots: ChannelSnapshot[],
        masterParameters: MasterParameterType,
        keyMappings: (KeyModifier | undefined)[][],
        chorusConfig: ChorusConfig = DEFAULT_CHORUS_CONFIG,
        reverbConfig: ReverbConfig = DEFAULT_REVERB_CONFIG
    ) {
        super(
            channelSnapshots.map((c) => ChannelSnapshot.copyFrom(c)),
            masterParameters,
            keyMappings
        );
        this.reverbConfig = { ...reverbConfig };
        this.chorusConfig = { ...chorusConfig };
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Retrieves the SynthesizerSnapshot from the lib snapshot.
     */
    public getCoreSnapshot(): SynthesizerSnapshot {
        return new SynthesizerSnapshot(
            [...this.channelSnapshots],
            { ...this.masterParameters },
            [...this.keyMappings]
        );
    }
}
