import { BasicMIDI, MIDITrack } from "spessasynth_core";

export class MIDIDataTrack extends MIDITrack {
    /**
     * THIS DATA WILL BE EMPTY! USE sequencer.getMIDI() TO GET THE ACTUAL DATA!
     */
    public events: never[] = [];

    public constructor(track: MIDITrack) {
        super();
        super.copyFrom(track);
        this.events = [];
    }
}

/**
 * A simplified version of the MIDI, accessible at all times from the Sequencer.
 * Use getMIDI() to get the actual sequence.
 * This class contains all properties that MIDI does, except for tracks and the embedded sound bank.
 */
export class MIDIData extends BasicMIDI {
    public override tracks: MIDIDataTrack[];

    /**
     * THIS DATA WILL BE EMPTY! USE sequencer.getMIDI() TO GET THE ACTUAL DATA!
     */
    public override embeddedSoundBank = undefined;

    /**
     * The byte length of the sound bank if it exists.
     */
    public readonly embeddedSoundBankSize?: number;

    public constructor(mid: BasicMIDI) {
        super();
        super.copyMetadataFrom(mid);
        this.tracks = mid.tracks.map((t) => new MIDIDataTrack(t));
        this.embeddedSoundBankSize =
            mid instanceof MIDIData
                ? mid.embeddedSoundBankSize
                : mid?.embeddedSoundBank?.byteLength;
    }
}
