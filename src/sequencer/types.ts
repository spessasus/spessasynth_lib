import {
    type BasicMIDI,
    type MIDIMessage,
    type SequencerEvent as CoreSequencerEvent,
    type SequencerEventCallback
} from "spessasynth_core";
import type { MIDIData } from "./midi_data";

/**
 * Optional configuration for the {@link Sequencer}.
 *
 * @group Sequencer
 */
export interface SequencerOptions {
    /**
     * If true, the sequencer will skip to the first note-on event when the time is set before it.
     * Defaults to `true`.
     */
    skipToFirstNoteOn: boolean;
    /**
     * The initial playback rate, defaults to 1.0 (normal speed).
     */
    initialPlaybackRate: number;
}

export type SequencerMessage = {
    [K in keyof SequencerMessageData]: {
        type: K;
        data: SequencerMessageData[K];
        // Pretty much just index in the sequencer array
        id: number;
    };
}[keyof SequencerMessageData];

export interface SequencerMessageData {
    // LoadNewSongList
    loadNewSongList: SuppliedMIDIData[];
    pause: null;
    play: null;
    // Time
    setTime: number;
    // SendMIDIMessages
    changeMIDIMessageSending: boolean;
    // PlaybackRate
    setPlaybackRate: number;
    // Count
    setLoopCount: number;
    // [changeType, data]
    changeSong: {
        changeType: "shuffleOn" | "shuffleOff" | "index";
        data?: number;
    };
    getMIDI: null;
    // SkipToFirstNoteOn
    setSkipToFirstNote: boolean;
}

export type SequencerReturnMessage =
    | (Exclude<SequencerEventCallback, { type: "songListChange" }> & {
          id: number;
      })
    | (Extract<SequencerEventCallback, { type: "songListChange" }> & {
          data: { shuffledSongIndexes: number[] };
          id: number;
      })
    | { type: "getMIDI"; data: BasicMIDI; id: number }
    | { type: "midiError"; data: Error; id: number }
    | { type: "sync"; data: number; id: number };

/**
 * A MIDI file to play, either a {@link BasicMIDI} or an object with two properties (the two can be mixed in a song list):
 * - `binary` - The `ArrayBuffer` representation of the file.
 * - `fileName` - An optional fallback name for the sequence if it doesn't have one (like the file name).
 *
 * > **Tip**
 * >
 * > For performance reasons, it is recommended to pass the binary data rather than the parsed {@link BasicMIDI} instance.
 *
 * @group Sequencer.MIDI Data
 */
export type SuppliedMIDIData =
    | BasicMIDI
    | {
          /**
           * The binary data of the file.
           */
          binary: ArrayBuffer;
          /**
           * The file name of this file as a fallback.
           */
          fileName?: string;
      };

/**
 * All event types which get emitted by {@link Sequencer}.
 *
 * @group Sequencer.Events
 */
export interface LibSequencerEvent extends Omit<
    CoreSequencerEvent,
    "midiMessage" | "songListChange"
> {
    /**
     * This event is triggered when the current song changes.
     */
    songChange: {
        /**
         * The index of the new song in the playlist.
         * If shuffle mode is enabled, this is the index of the shuffled song list.
         */
        songIndex: number;
        /**
         * The data of the new song.
         */
        midiData: MIDIData;
    };
    /**
     * This event is triggered when a Text Event is encountered.
     */
    textEvent: {
        /**
         * The raw event.
         */
        event: MIDIMessage;
        /**
         * If the text is a lyric, the index of the lyric in {@link BasicMIDI.lyrics}, otherwise -1.
         */
        lyricsIndex: number;
    };

    /**
     * This event is triggered when a MIDI parsing error is encountered.
     */
    midiError: Error;
}
