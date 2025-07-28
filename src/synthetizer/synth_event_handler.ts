import type { ProcessorEventType } from "spessasynth_core";

type ProcessorEventCallback<T extends keyof ProcessorEventType> = (
    callbackData: ProcessorEventType[T]
) => unknown;

type EventsMap = {
    [K in keyof ProcessorEventType]: Map<string, ProcessorEventCallback<K>>;
};

export class EventHandler {
    /**
     * The time delay before an event is called.
     * Set to 0 to disable it.
     */
    timeDelay = 0;

    /**
     * The main list of events.
     * @private
     */
    private readonly events: EventsMap = {
        noteOff: new Map<string, ProcessorEventCallback<"noteOff">>(), // called on a note off message
        noteOn: new Map<string, ProcessorEventCallback<"noteOn">>(), // called on a note on message
        pitchWheel: new Map<string, ProcessorEventCallback<"pitchWheel">>(), // called on a pitch-wheel change
        controllerChange: new Map<
            string,
            ProcessorEventCallback<"controllerChange">
        >(), // called on a controller change
        programChange: new Map<
            string,
            ProcessorEventCallback<"programChange">
        >(), // called on a program change
        channelPressure: new Map<
            string,
            ProcessorEventCallback<"channelPressure">
        >(), // called on a channel pressure message
        polyPressure: new Map<string, ProcessorEventCallback<"polyPressure">>(), // called on a poly pressure message
        drumChange: new Map<string, ProcessorEventCallback<"drumChange">>(), // called when a channel type changes
        stopAll: new Map<string, ProcessorEventCallback<"stopAll">>(), // called when the synth receives stop all command
        newChannel: new Map<string, ProcessorEventCallback<"newChannel">>(), // called when a new channel is created
        muteChannel: new Map<string, ProcessorEventCallback<"muteChannel">>(), // called when a channel is muted/unmuted
        presetListChange: new Map<
            string,
            ProcessorEventCallback<"presetListChange">
        >(), // called when the preset list changes (soundfont gets reloaded)
        allControllerReset: new Map<
            string,
            ProcessorEventCallback<"allControllerReset">
        >(), // called when all controllers are reset
        soundBankError: new Map<
            string,
            ProcessorEventCallback<"soundBankError">
        >(), // called when a sound bank parsing error occurs
        synthDisplay: new Map<string, ProcessorEventCallback<"synthDisplay">>() // called when there's a SysEx message to display some text
    };

    /**
     * Adds a new event listener.
     * @param event The event to listen to.
     * @param id The unique identifier for the event. It can be used to overwrite existing callback with the same ID.
     * @param callback The callback for the event.
     */
    addEvent<T extends keyof ProcessorEventType>(
        event: T,
        id: string,
        callback: ProcessorEventCallback<T>
    ) {
        this.events[event].set(id, callback);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Removes an event listener
     * @param name The event to remove a listener from.
     * @param id The unique identifier for the event to remove.
     */
    removeEvent<T extends keyof ProcessorEventType>(name: T, id: string) {
        this.events[name].delete(id);
    }

    /**
     * Calls the given event.
     * Internal use only.
     */
    callEventInternal<T extends keyof ProcessorEventType>(
        name: T,
        eventData: ProcessorEventType[T]
    ) {
        const eventList = this.events[name];
        const callback = () => {
            eventList.forEach((callback) => {
                try {
                    callback(eventData);
                } catch (e) {
                    console.error(
                        `Error while executing an event callback for ${name}:`,
                        e
                    );
                }
            });
        };
        if (this.timeDelay > 0) {
            setTimeout(callback.bind(this), this.timeDelay * 1000);
        } else {
            callback();
        }
    }
}
