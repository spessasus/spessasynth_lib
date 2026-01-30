import type { SynthProcessorEventData } from "spessasynth_core";

type ProcessorEventCallback<T extends keyof SynthProcessorEventData> = (
    callbackData: SynthProcessorEventData[T]
) => unknown;

type EventsMap = {
    [K in keyof SynthProcessorEventData]: Map<
        string,
        ProcessorEventCallback<K>
    >;
};

export class SynthEventHandler {
    /**
     * The time delay before an event is called.
     * Set to 0 to disable it.
     */
    public timeDelay = 0;

    /**
     * The main list of events.
     * @private
     */
    private readonly events: EventsMap = {
        noteOff: new Map<string, ProcessorEventCallback<"noteOff">>(), // Called on a note off message
        noteOn: new Map<string, ProcessorEventCallback<"noteOn">>(), // Called on a note on message
        pitchWheel: new Map<string, ProcessorEventCallback<"pitchWheel">>(), // Called on a pitch-wheel change
        controllerChange: new Map<
            string,
            ProcessorEventCallback<"controllerChange">
        >(), // Called on a controller change
        programChange: new Map<
            string,
            ProcessorEventCallback<"programChange">
        >(), // Called on a program change
        channelPressure: new Map<
            string,
            ProcessorEventCallback<"channelPressure">
        >(), // Called on a channel pressure message
        polyPressure: new Map<string, ProcessorEventCallback<"polyPressure">>(), // Called on a poly pressure message
        drumChange: new Map<string, ProcessorEventCallback<"drumChange">>(), // Called when a channel type changes
        stopAll: new Map<string, ProcessorEventCallback<"stopAll">>(), // Called when the synth receives stop all command
        newChannel: new Map<string, ProcessorEventCallback<"newChannel">>(), // Called when a new channel is created
        muteChannel: new Map<string, ProcessorEventCallback<"muteChannel">>(), // Called when a channel is muted/unmuted
        presetListChange: new Map<
            string,
            ProcessorEventCallback<"presetListChange">
        >(), // Called when the preset list changes (soundfont gets reloaded)
        allControllerReset: new Map<
            string,
            ProcessorEventCallback<"allControllerReset">
        >(), // Called when all controllers are reset
        soundBankError: new Map<
            string,
            ProcessorEventCallback<"soundBankError">
        >(), // Called when a sound bank parsing error occurs
        synthDisplay: new Map<string, ProcessorEventCallback<"synthDisplay">>(), // Called when there's a SysEx message to display some text
        masterParameterChange: new Map<
            string,
            ProcessorEventCallback<"masterParameterChange">
        >(), // Called when a master parameter changes
        channelPropertyChange: new Map<
            string,
            ProcessorEventCallback<"channelPropertyChange">
        >() // Called when a channel property changes
    };

    /**
     * Adds a new event listener.
     * @param event The event to listen to.
     * @param id The unique identifier for the event. It can be used to overwrite existing callback with the same ID.
     * @param callback The callback for the event.
     */
    public addEvent<T extends keyof SynthProcessorEventData>(
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
    public removeEvent<T extends keyof SynthProcessorEventData>(
        name: T,
        id: string
    ) {
        this.events[name].delete(id);
    }

    /**
     * Calls the given event.
     * INTERNAL USE ONLY!
     */
    public callEventInternal<T extends keyof SynthProcessorEventData>(
        name: T,
        eventData: SynthProcessorEventData[T]
    ) {
        const eventList = this.events[name];
        const callback = () => {
            for (const callback of eventList.values()) {
                try {
                    callback(eventData);
                } catch (error) {
                    console.error(
                        `Error while executing an event callback for ${name}:`,
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
