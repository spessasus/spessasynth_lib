import type { SynthesizerEventData } from "../types.ts";

export type ProcessorEventCallback<T extends keyof SynthesizerEventData> = (
    callbackData: SynthesizerEventData[T]
) => unknown;

type EventsMap = {
    [K in keyof SynthesizerEventData]: Map<string, ProcessorEventCallback<K>>;
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
        controllerChange: new Map<
            string,
            ProcessorEventCallback<"controllerChange">
        >(), // Called on a controller change
        programChange: new Map<
            string,
            ProcessorEventCallback<"programChange">
        >(), // Called on a program change
        polyPressure: new Map<string, ProcessorEventCallback<"polyPressure">>(), // Called on a poly pressure message
        stopAll: new Map<string, ProcessorEventCallback<"stopAll">>(), // Called when the synth receives stop all command
        channelAdded: new Map<string, ProcessorEventCallback<"channelAdded">>(), // Called when a new channel is created
        presetListChange: new Map<
            string,
            ProcessorEventCallback<"presetListChange">
        >(), // Called when the preset list changes (soundfont gets reloaded)
        reset: new Map<string, ProcessorEventCallback<"reset">>(), // Called when all controllers are reset
        soundBankError: new Map<
            string,
            ProcessorEventCallback<"soundBankError">
        >(), // Called when a sound bank parsing error occurs
        displayMessage: new Map<
            string,
            ProcessorEventCallback<"displayMessage">
        >(), // Called when there's a SysEx message to display some text
        globalParamChange: new Map<
            string,
            ProcessorEventCallback<"globalParamChange">
        >(), // Called when a MIDI global parameter changes
        channelParamChange: new Map<
            string,
            ProcessorEventCallback<"channelParamChange">
        >(), // Called when a MIDI channel parameter changes
        effectChange: new Map<string, ProcessorEventCallback<"effectChange">>() // Called when an effect processor parameter is changed
    };

    /**
     * Adds a new event listener.
     * @param event The event to listen to.
     * @param id The unique identifier for the event. It can be used to overwrite existing callback with the same ID.
     * @param callback The callback for the event.
     */
    public addEvent<T extends keyof SynthesizerEventData>(
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
    public removeEvent<T extends keyof SynthesizerEventData>(
        name: T,
        id: string
    ) {
        this.events[name].delete(id);
    }

    /**
     * Calls the given event.
     * INTERNAL USE ONLY!
     * @internal
     */
    public callEventInternal<T extends keyof SynthesizerEventData>(
        name: T,
        eventData: SynthesizerEventData[T]
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
