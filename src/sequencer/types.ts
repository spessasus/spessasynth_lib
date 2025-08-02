import { type SongChangeType } from "./enums";
import {
    type BasicMIDI,
    type MIDIMessage,
    type SequencerEvent
} from "spessasynth_core";
import type { MIDIData } from "./midi_data";

export interface SequencerOptions {
    // If true, the sequencer will skip to the first note.
    skipToFirstNoteOn: boolean;
    // If true, the sequencer will stay paused when seeking or changing the playback rate.
    preservePlaybackState: boolean;
    // The initial playback rate, defaults to 1.0 (normal speed).
    initialPlaybackRate: number;
}

export type SequencerMessage = {
    [K in keyof SequencerMessageData]: {
        type: K;
        data: SequencerMessageData[K];
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
        changeType: SongChangeType;
        data?: number;
    };
    getMIDI: null;
    // SkipToFirstNoteOn
    setSkipToFirstNote: boolean;
}

export type SequencerReturnMessage =
    | SequencerEvent
    | { type: "getMIDI"; data: BasicMIDI }
    | { type: "midiError"; data: Error };

/**
 * Sequencer.js
 * purpose: plays back the midi file decoded by midi_loader.js, including support for multichannel midis
 * (adding channels when more than one midi port is detected)
 * note: this is the sequencer class that runs on the main thread
 * and only communicates with the worklet sequencer which does the actual playback
 */

export type SuppliedMIDIData =
    | BasicMIDI
    | {
          // The binary data of the file.
          binary: ArrayBuffer;
          // The alternative name for the file.
          altName?: string;
      };

export interface WorkletSequencerEventType {
    // New song.
    songChange: MIDIData;
    // New time.
    timeChange: number;
    // No data.
    songEnded: null;
    // New tempo in BPM.
    tempoChange: number;
    metaEvent: {
        event: MIDIMessage;
        trackNumber: number;
    };
    textEvent: {
        // The raw event.
        event: MIDIMessage;
        // If the text is a lyric, the index of the lyric in BasicMIDI's "lyrics" property, otherwise -1.
        lyricsIndex: number;
    };

    midiError: Error;
}
