export const songChangeType = {
    shuffleOn: 1, // No additional data
    shuffleOff: 2, // No additional data
    index: 3 // SongIndex<number>
} as const;
export type SongChangeType =
    (typeof songChangeType)[keyof typeof songChangeType];
