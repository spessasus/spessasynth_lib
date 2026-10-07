import type { LibSequencerEvent } from "./types";

export type SequencerEventCallback<T extends keyof LibSequencerEvent> = (
    callbackData: LibSequencerEvent[T]
) => unknown;

type EventsMap = {
    [K in keyof LibSequencerEvent]: Map<string, SequencerEventCallback<K>>;
};

/**
 * The {@link Sequencer} supports event handling.
 * For example, the lyrics window in the demo uses handling to show lyrics in real-time.
 *
 * It is accessible via the {@link Sequencer.eventHandler} property.
 *
 * Event types can be found in {@link LibSequencerEvent}.
 * @group Sequencer.Events
 */
export class SeqEventHandler {
    /**
     * The time delay before an event is called.
     * Set to 0 to disable it.
     */
    public timeDelay = 0;

    private readonly events: EventsMap = {
        songChange: new Map<string, SequencerEventCallback<"songChange">>(),
        songEnded: new Map<string, SequencerEventCallback<"songEnded">>(),
        metaEvent: new Map<string, SequencerEventCallback<"metaEvent">>(),
        timeChange: new Map<string, SequencerEventCallback<"timeChange">>(),
        midiError: new Map<string, SequencerEventCallback<"midiError">>(),
        textEvent: new Map<string, SequencerEventCallback<"textEvent">>(),
        loopCountChange: new Map<
            string,
            SequencerEventCallback<"loopCountChange">
        >()
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds a new event listener.
     * @param event The event type to listen for.
     * @param id The unique identifier for the event. It can be used to overwrite existing callback with the same ID.
     * @param callback The callback for the event.
     */
    public addEvent<T extends keyof LibSequencerEvent>(
        event: T,
        id: string,
        callback: SequencerEventCallback<T>
    ) {
        this.events[event].set(id, callback);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Removes an event listener.
     * @param name The event type to remove a listener from.
     * @param id The unique identifier for the event to remove.
     */
    public removeEvent<T extends keyof LibSequencerEvent>(name: T, id: string) {
        this.events[name].delete(id);
    }

    /**
     * Calls the given event.
     * Internal use only.
     * @internal
     */
    public callEventInternal<T extends keyof LibSequencerEvent>(
        name: T,
        eventData: LibSequencerEvent[T]
    ) {
        const eventList = this.events[name];
        const callback = () => {
            for (const callback of eventList.values()) {
                try {
                    callback(eventData);
                } catch (error) {
                    console.error(
                        `Error while executing a sequencer event callback for ${name}:`,
                        error
                    );
                }
            }
        };
        if (this.timeDelay > 0) {
            setTimeout(callback.bind(this), this.timeDelay * 1000);
        } else {
            callback();
        }
    }
}
