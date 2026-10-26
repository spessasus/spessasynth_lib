import { BasicEventHandler } from "../utils/basic_event_handler";
import type { LibSequencerEvent } from "./types";

/**
 * A callback for a given {@link LibSequencerEvent} type.
 *
 * @group Sequencer.Events
 */
export type SequencerEventCallback<T extends keyof LibSequencerEvent> = (
    callbackData: LibSequencerEvent[T]
) => unknown;

/**
 * The {@link Sequencer} supports event handling.
 * For example, the lyrics window in the SpessaSynth web app uses it to show lyrics in real time.
 *
 * It is accessible via the {@link Sequencer.eventHandler} property.
 *
 * Event types can be found in {@link LibSequencerEvent}.
 * @group Sequencer.Events
 */
export class SeqEventHandler extends BasicEventHandler<LibSequencerEvent> {}
