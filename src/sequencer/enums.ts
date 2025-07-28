export const songChangeType = {
    backwards: 0, // no additional data
    forwards: 1, // no additional data
    shuffleOn: 2, // no additional data
    shuffleOff: 3, // no additional data
    index: 4 // songIndex<number>
} as const;
export type SongChangeType =
    (typeof songChangeType)[keyof typeof songChangeType];

export const sequencerMessageType = {
    loadNewSongList: 0,
    pause: 1,
    stop: 2,
    play: 3,
    setTime: 4,
    changeMIDIMessageSending: 5,
    setPlaybackRate: 6,
    setLoop: 7,
    changeSong: 8,
    getMIDI: 9,
    setSkipToFirstNote: 10,
    setPreservePlaybackState: 11
} as const;

/**
 *
 * @enum {number}
 */
export const sequencerReturnMessageType = {
    midiEvent: 0,
    songChange: 1,
    timeChange: 2,
    pause: 3,
    getMIDI: 4,
    midiError: 5,
    metaEvent: 6,
    loopCountChange: 7,
    songListChange: 8
} as const;
