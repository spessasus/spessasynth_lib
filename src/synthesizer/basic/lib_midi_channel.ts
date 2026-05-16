import {
    type ChannelMIDIParameter,
    type ChannelSystemParameter,
    DEFAULT_CHANNEL_MIDI_PARAMETERS,
    DEFAULT_CHANNEL_SYSTEM_PARAMETERS,
    type MIDIController,
    type MIDIPatchFull
} from "spessasynth_core";
import { type BasicSynthesizer } from "./basic_synthesizer.ts";

export class LibMIDIChannel {
    /**
     * This channel number.
     * @private
     */
    private readonly channel;
    private readonly synth: BasicSynthesizer;
    private readonly _systemParameters: ChannelSystemParameter = {
        ...DEFAULT_CHANNEL_SYSTEM_PARAMETERS
    };

    /**
     * @internal
     * @param channel
     * @param synth
     */
    public constructor(channel: number, synth: BasicSynthesizer) {
        this.channel = channel;
        this.synth = synth;
    }

    private _patch: MIDIPatchFull = {
        bankMSB: 0,
        bankLSB: 0,
        program: 0,
        isDrum: false,
        isGMGSDrum: false,
        name: ""
    };

    /**
     * The currently selected MIDI patch of the channel.
     * Note that the exact matching preset may not be available, but this represents exactly what MIDI asks for.
     */
    public get patch(): Readonly<MIDIPatchFull> {
        return this._patch;
    }

    /**
     * @internal
     * @param patch
     */
    public set patch(patch: MIDIPatchFull) {
        this._patch = patch;
    }

    private _midiParameters: ChannelMIDIParameter = {
        ...DEFAULT_CHANNEL_MIDI_PARAMETERS
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * The channel MIDI parameters of this channel.
     * These are only editable via MIDI messages.
     */
    public get midiParameters(): Readonly<ChannelMIDIParameter> {
        return this._midiParameters;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The channel system parameters of this channel.
     * These are only editable via the API.
     */
    public get systemParameters(): Readonly<ChannelSystemParameter> {
        return this._systemParameters;
    }

    private _voiceCount = 0;

    /**
     * The channel's current voice count.
     */
    public get voiceCount() {
        return this._voiceCount;
    }

    /**
     * @internal
     * @param value
     */
    public set voiceCount(value: number) {
        this._voiceCount = value;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Toggles drums on a given channel.
     * @param isDrum If the channel should be drums.
     */
    public setDrums(isDrum: boolean) {
        this.synth.post({
            channelNumber: this.channel,
            type: "setDrums",
            data: isDrum
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Causes the given midi channel to ignore controller messages for the given controller number.
     * @param controller 0-127 MIDI CC number.
     * @param isLocked True if locked, false if unlocked.
     */
    public lockController(controller: MIDIController, isLocked: boolean) {
        this.synth.post({
            channelNumber: this.channel,
            type: "lockController",
            data: {
                controller,
                isLocked
            }
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets a system parameter of the channel.
     * @param parameter The type of the parameter to set.
     * @param value The value to set for the parameter.
     */
    public setSystemParameter<P extends keyof ChannelSystemParameter>(
        parameter: P,
        value: ChannelSystemParameter[P]
    ) {
        this._systemParameters[parameter] = value;
        this.synth.post({
            type: "setChannelSystemParameter",
            channelNumber: this.channel,
            data: {
                type: parameter,
                data: value
            } as {
                [K in keyof ChannelSystemParameter]: {
                    type: K;
                    data: ChannelSystemParameter[K];
                };
            }[keyof ChannelSystemParameter]
        });
    }

    /**
     * @internal
     * @param parameter
     * @param value
     */
    public setMIDIParameter<P extends keyof ChannelMIDIParameter>(
        parameter: P,
        value: ChannelMIDIParameter[P]
    ) {
        this._midiParameters[parameter] = value;
    }

    /**
     * @internal
     */
    public reset() {
        this._midiParameters = {
            ...DEFAULT_CHANNEL_MIDI_PARAMETERS
        };
    }
}
