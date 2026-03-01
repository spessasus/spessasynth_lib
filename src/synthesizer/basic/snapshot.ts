import {
    ChannelSnapshot,
    KeyModifier,
    type MasterParameterType,
    SynthesizerSnapshot
} from "spessasynth_core";

/**
 * Extended synthesizer snapshot to contain effects
 */
export class LibSynthesizerSnapshot extends SynthesizerSnapshot {
    public constructor(
        channelSnapshots: ChannelSnapshot[],
        masterParameters: MasterParameterType,
        keyMappings: (KeyModifier | undefined)[][]
    ) {
        super(
            channelSnapshots.map((c) => ChannelSnapshot.copyFrom(c)),
            masterParameters,
            keyMappings
        );
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
