import { BasicMIDI, MIDITrack } from "spessasynth_core";

/**
 * A simplified version of the MIDI, accessible at all times from the Sequencer.
 * Use getMIDI() to get the actual sequence.
 * This class contains all properties that MIDI does, except for tracks and the embedded sound bank.
 */
export class MIDIData extends BasicMIDI {
    /**
     * THIS DATA WILL BE EMPTY! USE sequencer.getMIDI() TO GET THE ACTUAL DATA!
     */
    public override tracks: MIDITrack[] = [];

    /**
     * THIS DATA WILL BE EMPTY! USE sequencer.getMIDI() TO GET THE ACTUAL DATA!
     */
    public override embeddedSoundBank = undefined;

    public readonly isEmbedded: boolean;

    public constructor(mid: BasicMIDI) {
        super();
        super.copyMetadataFrom(mid);
        this.isEmbedded = mid.embeddedSoundBank !== undefined;
    }
}

/**
 * Temporary MIDI data used when the MIDI is not loaded.
 */
export const DUMMY_MIDI_DATA: MIDIData = Object.assign(
    {
        duration: 99999,
        firstNoteOn: 0,
        loop: {
            start: 0,
            end: 123456
        },

        lastVoiceEventTick: 123456,
        lyrics: [],
        tracks: [],
        extraMetadata: [],
        copyright: "",
        tempoChanges: [{ ticks: 0, tempo: 120 }],
        fileName: "NOT_LOADED.mid",
        name: "Loading...",
        timeDivision: 0,
        keyRange: { min: 0, max: 127 },
        isKaraokeFile: false,
        isMultiPort: false,
        rmidiInfo: {},
        bankOffset: 0,
        format: 0
    },
    MIDIData.prototype
);
