import type { WorkletSequencerEventType } from "./types";

type SequencerEventCallback<T extends keyof WorkletSequencerEventType> = (
    callbackData: WorkletSequencerEventType[T]
) => unknown;

type EventsMap = {
    [K in keyof WorkletSequencerEventType]: Map<
        string,
        SequencerEventCallback<K>
    >;
};

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
        textEvent: new Map<string, SequencerEventCallback<"textEvent">>()
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds a new event listener.
     * @param event The event to listen to.
     * @param id The unique identifier for the event. It can be used to overwrite existing callback with the same ID.
     * @param callback The callback for the event.
     */
    public addEvent<T extends keyof WorkletSequencerEventType>(
        event: T,
        id: string,
        callback: SequencerEventCallback<T>
    ) {
        this.events[event].set(id, callback);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Removes an event listener
     * @param name The event to remove a listener from.
     * @param id The unique identifier for the event to remove.
     */
    public removeEvent<T extends keyof WorkletSequencerEventType>(
        name: T,
        id: string
    ) {
        this.events[name].delete(id);
    }

    /**
     * Calls the given event.
     * Internal use only.
     * @internal
     */
    public callEventInternal<T extends keyof WorkletSequencerEventType>(
        name: T,
        eventData: WorkletSequencerEventType[T]
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
