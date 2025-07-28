import { type SongChangeType } from "./enums";
import { type BasicMIDI, type MIDIMessage } from "spessasynth_core";
import type { MIDIData } from "./midi_data";

export type SequencerOptions = {
    // If true, the sequencer will skip to the first note.
    skipToFirstNoteOn: boolean;
    // If true, the sequencer will automatically start playing the MIDI.
    autoPlay: boolean;
    // If true, the sequencer will stay paused when seeking or changing the playback rate.
    preservePlaybackState: boolean;
    // The initial playback rate, defaults to 1.0 (normal speed).
    initialPlaybackRate: number;
};

export type SequencerMessage = {
    [K in keyof SequencerMessageData]: {
        type: K;
        data: SequencerMessageData[K];
    };
}[keyof SequencerMessageData];

type SequencerMessageData = {
    // loadNewSongList
    loadNewSongList: { midis: SuppliedMIDIData[]; autoPlay: boolean };
    // isFinished
    pause: boolean;
    stop: null;
    // resetTime
    play: boolean;
    // time
    setTime: number;
    // sendMIDIMessages
    changeMIDIMessageSending: boolean;
    // playbackRate
    setPlaybackRate: number;
    // [loop, count]
    setLoop: {
        loop: boolean;
        count: number;
    };
    // [changeType, data]
    changeSong: {
        changeType: SongChangeType;
        data?: number;
    };
    getMIDI: null;
    // skipToFirstNoteOn
    setSkipToFirstNote: boolean;
    // preservePlaybackState
    setPreservePlaybackState: boolean;
};

export type SequencerReturnMessage = {
    [K in keyof SequencerReturnMessageData]: {
        type: K;
        data: SequencerReturnMessageData[K];
    };
}[keyof SequencerReturnMessageData];

type SequencerReturnMessageData = {
    // [...midiEventBytes]
    midiEvent: number[];
    songChange: {
        songIndex: number;
        isAutoPlayed: boolean;
    };
    // newTime
    timeChange: number;
    // isFinished
    pause: boolean;
    // midiData
    getMIDI: BasicMIDI;
    // errorMSG
    midiError: string;
    metaEvent: {
        event: MIDIMessage;
        trackNum: number;
    };
    // newLoopCount
    loopCountChange: number;
    // songListData
    songListChange: MIDIData[];
};
/**
 * sequencer.js
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
