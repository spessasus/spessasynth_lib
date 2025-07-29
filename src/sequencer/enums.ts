export const songChangeType = {
    shuffleOn: 1, // no additional data
    shuffleOff: 2, // no additional data
    index: 3 // songIndex<number>
} as const;
export type SongChangeType =
    (typeof songChangeType)[keyof typeof songChangeType];
