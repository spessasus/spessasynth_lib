/**
 * The shared event handling of {@link SynthEventHandler} and {@link SeqEventHandler}.
 */
export abstract class BasicEventHandler<Events extends object> {
    /**
     * The time delay before an event is called, in seconds.
     * Set to 0 to disable it.
     */
    public timeDelay = 0;

    /**
     * The callbacks for each event type, by their ID.
     */
    private readonly events = new Map<
        keyof Events,
        Map<string, (callbackData: never) => unknown>
    >();

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds a new event listener.
     * @param event The event type to listen for.
     * @param id The unique identifier for the event. It can be used to overwrite an existing callback with the same ID.
     * @param callback The callback for the event.
     */
    public addEvent<T extends keyof Events>(
        event: T,
        id: string,
        callback: (callbackData: Events[T]) => unknown
    ) {
        let callbacks = this.events.get(event);
        if (!callbacks) {
            callbacks = new Map();
            this.events.set(event, callbacks);
        }
        callbacks.set(id, callback);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Removes an event listener.
     * @param event The event type to remove a listener from.
     * @param id The unique identifier for the event to remove.
     */
    public removeEvent<T extends keyof Events>(event: T, id: string) {
        this.events.get(event)?.delete(id);
    }

    /**
     * Calls the given event.
     * INTERNAL USE ONLY!
     * @internal
     */
    public callEventInternal<T extends keyof Events>(
        name: T,
        eventData: Events[T]
    ) {
        const callbacks = this.events.get(name) as
            Map<string, (callbackData: Events[T]) => unknown> | undefined;
        if (!callbacks) return;
        const callAll = () => {
            for (const callback of callbacks.values()) {
                try {
                    callback(eventData);
                } catch (error) {
                    // Report it as uncaught, without stopping the other callbacks
                    reportError(error);
                }
            }
        };
        if (this.timeDelay > 0) {
            setTimeout(callAll, this.timeDelay * 1000);
        } else {
            callAll();
        }
    }
}
