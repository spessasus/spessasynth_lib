import { BasicEventHandler } from "../../utils/basic_event_handler";
import type { LibSynthesizerEvent } from "../types";

/**
 * A callback for a given {@link LibSynthesizerEvent} type.
 *
 * @group Synthesizer.Events
 */
export type ProcessorEventCallback<T extends keyof LibSynthesizerEvent> = (
    callbackData: LibSynthesizerEvent[T]
) => unknown;

/**
 * The synthesizer supports event handling.
 * For example, the MIDI keyboard in the SpessaSynth web app uses it to visualize key presses.
 *
 * It is accessible via the {@link BasicSynthesizer.eventHandler} property.
 *
 * Event types can be found in {@link LibSynthesizerEvent}.
 * @group Synthesizer.Events
 */
export class SynthEventHandler extends BasicEventHandler<LibSynthesizerEvent> {}
