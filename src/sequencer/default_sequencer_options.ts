import type { SequencerOptions } from "./types";

/**
 * The default {@link SequencerOptions} used by the {@link Sequencer}.
 *
 * @group Sequencer
 */
export const DEFAULT_SEQUENCER_OPTIONS: SequencerOptions = {
    skipToFirstNoteOn: true,
    initialPlaybackRate: 1
};
