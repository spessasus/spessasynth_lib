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

    /**
     * If the embedded sound bank is an SFe bank, for example the one of a converted tracker module.
     * Writing such a bank as SF2 may lose data.
     */
    public readonly embeddedSoundBankIsSFe: boolean;

    public constructor(mid: BasicMIDI) {
        super();
        super.copyMetadataFrom(mid);
        this.tracks = mid.tracks.map((t) => new MIDIDataTrack(t));
        // Another MIDIData, or one cloned from the worker (a plain object without the bank)
        if (mid instanceof MIDIData || "embeddedSoundBankIsSFe" in mid) {
            const data = mid as MIDIData;
            this.embeddedSoundBankSize = data.embeddedSoundBankSize;
            this.embeddedSoundBankIsSFe = data.embeddedSoundBankIsSFe;
            return;
        }
        const bank = mid?.embeddedSoundBank;
        this.embeddedSoundBankSize = bank?.byteLength;
        // A RIFS file is always SFe, a RIFF one has its form type at bytes 8 to 11
        let isSFe = false;
        if (bank && bank.byteLength >= 12) {
            const bytes = new Uint8Array(bank, 0, 12);
            const text = (from: number) =>
                String.fromCharCode(...bytes.subarray(from, from + 4));
            isSFe = text(0) === "RIFS" || text(8).toLowerCase() === "sfen";
        }
        this.embeddedSoundBankIsSFe = isSFe;
    }
}
