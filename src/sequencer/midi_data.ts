import { BasicMIDI, MIDITrack } from "spessasynth_core";

/**
 * A simplified version of the {@link MIDITrack}, accessible at all times from the {@link Sequencer}.
 * This data does not contain any events.
 *
 * @group Sequencer.MIDI Data
 */
export class MIDIDataTrack extends MIDITrack {
    /**
     * THIS DATA WILL BE EMPTY! USE {@link Sequencer.getMIDI} TO GET THE ACTUAL DATA!
     */
    public events: never[] = [];

    public constructor(track: MIDITrack) {
        super();
        super.copyFrom(track);
        this.events = [];
    }
}

/**
 * A simplified version of {@link BasicMIDI}, accessible at all times from the {@link Sequencer}.
 * Use {@link Sequencer.getMIDI} to get the actual sequence.
 * This class contains all properties that {@link BasicMIDI} does, except for tracks, timeline and the embedded sound bank.
 *
 * @group Sequencer.MIDI Data
 */
export class MIDIData extends BasicMIDI {
    public override tracks: MIDIDataTrack[];
    /**
     * THIS DATA WILL BE EMPTY! USE {@link Sequencer.getMIDI} TO GET THE ACTUAL DATA!
     */
    public override timeline: never[] = [];

    /**
     * THIS DATA WILL BE EMPTY! USE {@link Sequencer.getMIDI} TO GET THE ACTUAL DATA!
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
