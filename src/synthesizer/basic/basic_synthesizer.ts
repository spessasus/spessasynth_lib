import { WorkletKeyModifierManagerWrapper } from "./key_modifier_manager.ts";
import { SoundBankManager } from "./sound_bank_manager.ts";
import {
    type ProcessorEventCallback,
    SynthEventHandler
} from "./synth_event_handler.ts";
import {
    DEFAULT_GLOBAL_MASTER_PARAMETERS,
    DEFAULT_MIDI_GLOBAL_PARAMETERS,
    type GlobalMasterParameter,
    type MIDIChannelParameter,
    type MIDIController,
    MIDIControllers,
    type MIDIGlobalParameter,
    MIDIMessageTypes,
    type MIDIPatchFull,
    SpessaSynthLog,
    type SynthesizerSnapshot,
    type SynthMethodOptions,
    type SynthProcessorEventData
} from "spessasynth_core";
import type { SequencerReturnMessage } from "../../sequencer/types.ts";
import type { SynthConfig } from "./types.ts";
import type {
    BasicSynthesizerMessage,
    BasicSynthesizerReturnMessage,
    SynthesizerProgress,
    SynthesizerReturn
} from "../types.ts";
import { ConsoleColors } from "../../utils/other.ts";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import { LibMIDIChannel } from "./lib_midi_channel.ts";
import { ALL_CHANNELS_OR_DIFFERENT_ACTION } from "./synth_config.ts";

const DEFAULT_SYNTH_METHOD_OPTIONS: SynthMethodOptions = {
    time: 0
};

const SPESSASYNTH_LIB_HANDLER = (event: string) =>
    `SPESSASYNTH_LIB_HANDLE_${event}_${Math.random()}`;

// The "remote controller" of a given processor and abstraction for both synth engines.
export abstract class BasicSynthesizer {
    /**
     * Allows managing the sound bank list.
     */
    public readonly soundBankManager = new SoundBankManager(this);
    /**
     * Allows managing key modifications.
     */
    public readonly keyModifierManager = new WorkletKeyModifierManagerWrapper(
        this
    );
    /**
     * Allows setting up custom event listeners for the synthesizer.
     */
    public readonly eventHandler: SynthEventHandler = new SynthEventHandler();
    /**
     * Synthesizer's parent AudioContext instance.
     */
    public readonly context: BaseAudioContext;
    /**
     * Synth's current channel properties.
     */
    public readonly midiChannels: LibMIDIChannel[] = [];
    /**
     * The current preset list.
     */
    public presetList: MIDIPatchFull[] = [];

    /**
     * INTERNAL USE ONLY!
     * @internal
     * All sequencer callbacks
     */
    public sequencers = new Array<(m: SequencerReturnMessage) => unknown>();
    /**
     * Resolves when the synthesizer is ready.
     */
    public readonly isReady: Promise<unknown>;
    /**
     * INTERNAL USE ONLY!
     * @internal
     */
    public readonly post: (
        data: BasicSynthesizerMessage,
        transfer?: Transferable[]
    ) => unknown;
    protected readonly worklet: AudioWorkletNode;
    /**
     * The new channels will have their audio sent to the modulated output by this constant.
     * what does that mean?
     * e.g., if outputsAmount is 16, then channel's 16 audio data will be sent to channel 0
     */
    protected readonly _outputCount = 16;
    protected readonly _masterParameters: GlobalMasterParameter = {
        ...DEFAULT_GLOBAL_MASTER_PARAMETERS
    };
    // Resolve map, waiting for the worklet to confirm the operation
    protected resolveMap = new Map<
        keyof SynthesizerReturn,
        (data: SynthesizerReturn[keyof SynthesizerReturn]) => unknown
    >();
    protected renderingProgressTracker = new Map<
        keyof SynthesizerProgress,
        {
            [K in keyof SynthesizerProgress]: (
                args: SynthesizerProgress[K]
            ) => unknown;
        }[keyof SynthesizerProgress]
    >();

    /**
     * Creates a new instance of a synthesizer.
     * @param worklet The AudioWorkletNode to use.
     * @param postFunction The internal post function.
     * @param config Optional configuration for the synthesizer.
     */
    protected constructor(
        worklet: AudioWorkletNode,
        postFunction: (
            data: BasicSynthesizerMessage,
            transfer?: Transferable[]
        ) => unknown,
        config: SynthConfig
    ) {
        SpessaSynthLog.info(
            "%cInitializing SpessaSynth synthesizer...",
            ConsoleColors.info
        );
        this.context = worklet.context;
        this.worklet = worklet;
        this.post = postFunction;

        // Used in child classes
        void config;

        this.isReady = new Promise((resolve) =>
            this.awaitWorkerResponse("sf3Decoder", resolve)
        );

        // Set up message handling and managers
        this.worklet.port.onmessage = (
            e: MessageEvent<BasicSynthesizerReturnMessage>
        ) => this.handleMessage(e.data);

        // Create initial channels
        for (let i = 0; i < 16; i++) this.addNewChannelInternal(false);

        // Attach event handlers
        this.registerInternalEvent("newChannel", () => {
            this.addNewChannelInternal(false);
        });
        this.registerInternalEvent(
            "presetListChange",
            (e) => (this.presetList = [...e])
        );
        this.registerInternalEvent(
            "midiGlobalChange",
            <P extends keyof MIDIGlobalParameter>(e: {
                parameter: P;
                value: MIDIGlobalParameter[P];
            }) => (this._midiParameters[e.parameter] = e.value)
        );
        this.registerInternalEvent(
            "midiChannelChange",
            <P extends keyof MIDIChannelParameter>(e: {
                channel: number;
                parameter: P;
                value: MIDIChannelParameter[P];
            }) =>
                this.midiChannels[e.channel].setMIDIParameter(
                    e.parameter,
                    e.value
                )
        );
        this.registerInternalEvent(
            "programChange",
            (e) =>
                (this.midiChannels[e.channel].patch = {
                    ...e
                })
        );
        this.registerInternalEvent("allControllerReset", () => {
            for (const c of this.midiChannels) c.reset();
            this._midiParameters = {
                ...DEFAULT_MIDI_GLOBAL_PARAMETERS
            };
        });
    }

    protected _midiParameters: MIDIGlobalParameter = {
        ...DEFAULT_MIDI_GLOBAL_PARAMETERS
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * The global MIDI parameters of the synthesizer.
     * These are only editable via MIDI messages.
     */
    public get midiParameters(): Readonly<MIDIGlobalParameter> {
        return this._midiParameters;
    }

    /**
     * The current channel count of the synthesizer.
     */
    public get channelCount() {
        return this.midiChannels.length;
    }

    /**
     * Current voice amount
     */
    protected _voiceCount = 0;

    // noinspection JSUnusedGlobalSymbols
    /**
     * The current number of voices playing.
     */
    public get voiceCount() {
        return this._voiceCount;
    }

    /**
     * The audioContext's current time.
     */
    public get currentTime() {
        return this.context.currentTime;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The global master parameters of the synthesizer.
     * These are only editable via the API.
     */
    public get masterParameters(): Readonly<GlobalMasterParameter> {
        return this._masterParameters;
    }

    /**
     * Connects from a given node.
     * @param destinationNode The node to connect to.
     */
    public connect(destinationNode: AudioNode) {
        // Connect all other worklet outputs (effects + 16 channels)
        for (let i = 0; i < 17; i++) {
            this.worklet.connect(destinationNode, i);
        }
        return destinationNode;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disconnects from a given node.
     * @param destinationNode The node to disconnect from.
     */
    public disconnect(destinationNode?: AudioNode) {
        if (!destinationNode) {
            this.worklet.disconnect();
            return undefined;
        }
        // Disconnect all other worklet outputs
        for (let i = 0; i < 17; i++) {
            this.worklet.disconnect(destinationNode, i);
        }
        return destinationNode;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets the SpessaSynth's log level in the processor.
     * @param enableInfo Enable info (verbose)
     * @param enableWarning Enable warnings (unrecognized messages)
     * @param enableGroup Enable groups (to group a lot of logs)
     */
    public setLogLevel(
        enableInfo: boolean,
        enableWarning: boolean,
        enableGroup: boolean
    ) {
        this.post({
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION,
            type: "setLogLevel",
            data: {
                enableInfo,
                enableWarning,
                enableGroup
            }
        });
    }

    // noinspection JSUnusedGlobalSymbols

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets a master parameter to a given value.
     * @param type The parameter to set.
     * @param value The value to set.
     */
    public setMasterParameter<K extends keyof GlobalMasterParameter>(
        type: K,
        value: GlobalMasterParameter[K]
    ) {
        this._masterParameters[type] = value;
        this.post({
            type: "setGlobalMasterParameter",
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION,
            data: {
                type,
                data: value
            } as {
                [K in keyof GlobalMasterParameter]: {
                    type: K;
                    data: GlobalMasterParameter[K];
                };
            }[keyof GlobalMasterParameter]
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Gets a complete snapshot of the synthesizer, effects.
     */
    public async getSnapshot(): Promise<SynthesizerSnapshot> {
        return new Promise((resolve) => {
            this.awaitWorkerResponse("synthesizerSnapshot", (s) => {
                resolve(s);
            });
            this.post({
                type: "requestSynthesizerSnapshot",
                data: null,
                channelNumber: -1
            });
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds a new channel to the synthesizer.
     */
    public addNewChannel() {
        this.addNewChannelInternal(true);
    }

    /**
     * DEPRECATED, please don't use it!
     * @deprecated
     */
    public setVibrato(
        channel: number,
        value: { delay: number; depth: number; rate: number }
    ) {
        void channel;
        void value;
    }

    /**
     * Connects a given channel output to the given audio node.
     * Note that this output is only meant for visualization and may be silent when Insertion Effect for this channel is enabled.
     * @param targetNode The node to connect to.
     * @param channelNumber The channel number to connect to, will be rolled over if value is greater than 15.
     * @returns The target node.
     */
    public connectChannel(targetNode: AudioNode, channelNumber: number) {
        this.worklet.connect(targetNode, (channelNumber % 16) + 1);
        return targetNode;
    }

    /**
     * Disconnects a given channel output to the given audio node.
     * @param targetNode The node to disconnect from.
     * @param channelNumber The channel number to connect to, will be rolled over if value is greater than 15.
     */
    public disconnectChannel(targetNode: AudioNode, channelNumber: number) {
        this.worklet.disconnect(targetNode, (channelNumber % 16) + 1);
    }

    /**
     * Connects the individual audio outputs to the given audio nodes.
     * Note that these outputs is only meant for visualization and may be silent when Insertion Effect for this channel is enabled.
     * @param audioNodes Exactly 16 outputs.
     */
    public connectIndividualOutputs(audioNodes: AudioNode[]) {
        if (audioNodes.length !== this._outputCount) {
            throw new Error(`input nodes amount differs from the system's outputs amount!
            Expected ${this._outputCount} got ${audioNodes.length}`);
        }
        for (let channel = 0; channel < this._outputCount; channel++) {
            // + 1 because effects come first!
            this.connectChannel(audioNodes[channel], channel);
        }
    }

    /**
     * Disconnects the individual audio outputs from the given audio nodes.
     * @param audioNodes Exactly 16 outputs.
     */
    public disconnectIndividualOutputs(audioNodes: AudioNode[]) {
        if (audioNodes.length !== this._outputCount) {
            throw new Error(`input nodes amount differs from the system's outputs amount!
            Expected ${this._outputCount} got ${audioNodes.length}`);
        }
        for (let channel = 0; channel < this._outputCount; channel++) {
            // + 1 because effects come first!
            this.disconnectChannel(audioNodes[channel], channel);
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disables the GS NRPN parameters like vibrato or drum key tuning.
     * @deprecated Deprecated! Please use master parameters
     */
    public disableGSNPRNParams() {
        this.setMasterParameter("nrpnParamLock", true);
    }

    /**
     * Sends a raw MIDI message to the synthesizer.
     * @param message the midi message, each number is a byte.
     * @param channelOffset the channel offset of the message.
     * @param eventOptions additional options for this command.
     */
    public sendMessage(
        message: Iterable<number>,
        channelOffset = 0,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        this._sendInternal(message, channelOffset, eventOptions);
    }

    /**
     * Starts playing a note
     * @param channel Usually 0-15: the channel to play the note.
     * @param midiNote 0-127 the key number of the note.
     * @param velocity 0-127 the velocity of the note (generally controls loudness).
     * @param eventOptions Additional options for this command.
     */
    public noteOn(
        channel: number,
        midiNote: number,
        velocity: number,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        const ch = channel % 16;
        const offset = channel - ch;
        midiNote %= 128;
        velocity %= 128;
        this.sendMessage(
            [MIDIMessageTypes.noteOn | ch, midiNote, velocity],
            offset,
            eventOptions
        );
    }

    /**
     * Stops playing a note.
     * @param channel Usually 0-15: the channel of the note.
     * @param midiNote {number} 0-127 the key number of the note.
     * @param eventOptions Additional options for this command.
     */
    public noteOff(
        channel: number,
        midiNote: number,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        midiNote %= 128;

        const ch = channel % 16;
        const offset = channel - ch;
        this._sendInternal(
            [MIDIMessageTypes.noteOff | ch, midiNote],
            offset,
            eventOptions
        );
    }

    /**
     * Stops all notes.
     * @param force If the notes should immediately be stopped, defaults to false.
     */
    public stopAll(force = false) {
        this.post({
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION,
            type: "stopAll",
            data: force ? 1 : 0
        });
    }

    /**
     * Changes the given controller
     * @param channel Usually 0-15: the channel to change the controller.
     * @param controller 0-127 the MIDI CC number.
     * @param value 0-127 the controller value.
     * @param eventOptions Additional options for this command.
     */
    public controllerChange(
        channel: number,
        controller: MIDIController,
        value: number,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        if (controller > 127 || controller < 0) {
            throw new Error(`Invalid controller number: ${controller}`);
        }
        value = Math.floor(value) % 128;
        controller = Math.floor(controller) % 128;
        // Controller change has its own message for the force property
        const ch = channel % 16;
        const offset = channel - ch;
        this._sendInternal(
            [MIDIMessageTypes.controllerChange | ch, controller, value],
            offset,
            eventOptions
        );
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Resets all controllers (for every channel)
     */
    public resetControllers() {
        this.post({
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION,
            type: "ccReset",
            data: null
        });
    }

    /**
     * Applies pressure to a given channel.
     * @param channel Usually 0-15: the channel to change the controller.
     * @param pressure 0-127: the pressure to apply.
     * @param eventOptions Additional options for this command.
     */
    public channelPressure(
        channel: number,
        pressure: number,
        eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        const ch = channel % 16;
        const offset = channel - ch;
        pressure %= 128;
        this.sendMessage(
            [MIDIMessageTypes.channelPressure | ch, pressure],
            offset,
            eventOptions
        );
    }

    /**
     * Applies pressure to a given note.
     * @param channel Usually 0-15: the channel to change the controller.
     * @param midiNote 0-127: the MIDI note.
     * @param pressure 0-127: the pressure to apply.
     * @param eventOptions Additional options for this command.
     */
    public polyPressure(
        channel: number,
        midiNote: number,
        pressure: number,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        const ch = channel % 16;
        const offset = channel - ch;
        midiNote %= 128;
        pressure %= 128;
        this.sendMessage(
            [MIDIMessageTypes.polyPressure | ch, midiNote, pressure],
            offset,
            eventOptions
        );
    }

    /**
     * Sets the pitch of the given channel.
     * @param channel Usually 0-15: the channel to change pitch.
     * @param value The bend of the MIDI pitch wheel message. 0 - 16384
     * @param eventOptions Additional options for this command.
     */
    public pitchWheel(
        channel: number,
        value: number,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        const ch = channel % 16;
        const offset = channel - ch;
        this.sendMessage(
            [MIDIMessageTypes.pitchWheel | ch, value & 0x7f, value >> 7],
            offset,
            eventOptions
        );
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets the channel's pitch wheel range, in semitones.
     * @param channel Usually 0-15: the channel to change.
     * @param range The bend range in semitones.
     * @param eventOptions Additional options for this command.
     */
    public pitchWheelRange(
        channel: number,
        range: number,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        // Set range
        this.controllerChange(
            channel,
            MIDIControllers.registeredParameterMSB,
            0,
            eventOptions
        );
        this.controllerChange(
            channel,
            MIDIControllers.registeredParameterLSB,
            0,
            eventOptions
        );
        this.controllerChange(channel, MIDIControllers.dataEntryMSB, range);

        // Reset rpn
        this.controllerChange(
            channel,
            MIDIControllers.registeredParameterMSB,
            127,
            eventOptions
        );
        this.controllerChange(
            channel,
            MIDIControllers.registeredParameterLSB,
            127,
            eventOptions
        );
        this.controllerChange(
            channel,
            MIDIControllers.dataEntryMSB,
            0,
            eventOptions
        );
    }

    /**
     * Changes the program for a given channel
     * @param channel Usually 0-15: the channel to change.
     * @param programNumber 0-127 the MIDI patch number.
     * @param eventOptions Additional options for this command.
     */
    public programChange(
        channel: number,
        programNumber: number,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        const ch = channel % 16;
        const offset = channel - ch;
        programNumber %= 128;
        this.sendMessage(
            [MIDIMessageTypes.programChange | ch, programNumber],
            offset,
            eventOptions
        );
    }

    /**
     * Sends a MIDI Sysex message to the synthesizer.
     * @param messageData The message's data, excluding the F0 byte, but including the F7 at the end.
     * @param channelOffset Channel offset for the system exclusive message, defaults to zero.
     * @param eventOptions Additional options for this command.
     */
    public systemExclusive(
        messageData: number[] | Iterable<number> | Uint8Array,
        channelOffset = 0,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        this._sendInternal(
            [MIDIMessageTypes.systemExclusive, ...Array.from(messageData)],
            channelOffset,
            eventOptions
        );
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Tune MIDI keys of a given program using the MIDI Tuning Standard.
     * @param program  0 - 127 the MIDI program number to use.
     * @param tunings The keys and their tunings.
     * TargetPitch of -1 sets the tuning for this key to be tuned regularly.
     */
    public tuneKeys(
        program: number,
        tunings: { sourceKey: number; targetPitch: number }[]
    ) {
        if (tunings.length > 127) {
            throw new Error("Too many tunings. Maximum allowed is 127.");
        }
        const systemExclusive = [
            0x7f, // Real-time
            0x10, // Device id
            0x08, // MIDI Tuning
            0x02, // Note change
            program, // Tuning program number
            tunings.length // Number of changes
        ];
        for (const tuning of tunings) {
            systemExclusive.push(tuning.sourceKey); // [kk] MIDI Key number
            if (tuning.targetPitch === -1) {
                // No change
                systemExclusive.push(0x7f, 0x7f, 0x7f);
            } else {
                const midiNote = Math.floor(tuning.targetPitch);
                const fraction = Math.floor(
                    (tuning.targetPitch - midiNote) / 0.000_061
                );
                systemExclusive.push(
                    midiNote, // Frequency data byte 1
                    (fraction >> 7) & 0x7f, // Frequency data byte 2
                    fraction & 0x7f // Frequency data byte 3
                );
            }
        }
        systemExclusive.push(0xf7);
        this.systemExclusive(systemExclusive);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Yes please!
     */
    public reverbateEverythingBecauseWhyNot(): "That's the spirit!" {
        for (let i = 0; i < this.midiChannels.length; i++) {
            this.controllerChange(i, MIDIControllers.reverbDepth, 127);
            this.midiChannels[i].lockController(
                MIDIControllers.reverbDepth,
                true
            );
        }
        return "That's the spirit!";
    }

    /**
     * INTERNAL USE ONLY!
     * @param type INTERNAL USE ONLY!
     * @param resolve INTERNAL USE ONLY!
     * @internal
     */
    public awaitWorkerResponse<K extends keyof SynthesizerReturn>(
        type: K,
        resolve: (data: SynthesizerReturn[K]) => unknown
    ) {
        // @ts-expect-error I can't use generics with map
        this.resolveMap.set(type, resolve);
    }

    /**
     * INTERNAL USE ONLY!
     * @param callback the sequencer callback
     * @internal
     */
    public assignNewSequencer(
        callback: (m: SequencerReturnMessage) => unknown
    ) {
        this.post({
            channelNumber: -1,
            type: "requestNewSequencer",
            data: null
        });
        this.sequencers.push(callback);
        return this.sequencers.length - 1;
    }

    protected assignProgressTracker<K extends keyof SynthesizerProgress>(
        type: K,
        progressFunction: (args: SynthesizerProgress[K]) => unknown
    ) {
        if (this.renderingProgressTracker.get(type)) {
            throw new Error("Something is already being rendered!");
        }
        this.renderingProgressTracker.set(type, progressFunction);
    }

    protected revokeProgressTracker<K extends keyof SynthesizerProgress>(
        type: K
    ) {
        this.renderingProgressTracker.delete(type);
    }

    protected _sendInternal(
        message: Iterable<number>,
        channelOffset: number,
        eventOptions: Partial<SynthMethodOptions>
    ) {
        const options = fillWithDefaults(
            eventOptions,
            DEFAULT_SYNTH_METHOD_OPTIONS
        );
        this.post({
            type: "midiMessage",
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION,
            data: {
                messageData: new Uint8Array(message),
                channelOffset,
                options
            }
        });
    }

    /**
     * Handles the messages received from the worklet.
     */
    protected handleMessage(m: BasicSynthesizerReturnMessage) {
        switch (m.type) {
            case "eventCall": {
                this.eventHandler.callEventInternal(m.data.type, m.data.data);
                break;
            }

            case "sequencerReturn": {
                this.sequencers[m.data.id]?.(m.data);
                break;
            }

            case "voiceCountChange": {
                for (let i = 0; i < m.data.length; i++) {
                    this.midiChannels[i].voiceCount = m.data[i];
                    this._voiceCount = m.data.reduce((s, v) => s + v, 0);
                }
                break;
            }

            case "isFullyInitialized": {
                this.workletResponds(m.data.type, m.data.data);
                break;
            }

            case "soundBankError": {
                SpessaSynthLog.warn(m.data as unknown as string);
                this.eventHandler.callEventInternal("soundBankError", m.data);
                break;
            }

            case "renderingProgress": {
                this.renderingProgressTracker.get(m.data.type)?.(m.data.data);
            }
        }
    }

    protected addNewChannelInternal(post: boolean) {
        this.midiChannels.push(
            new LibMIDIChannel(this.midiChannels.length, this)
        );
        if (!post) return;

        this.post({
            channelNumber: 0,
            type: "addNewChannel",
            data: null
        });
    }

    protected workletResponds<K extends keyof SynthesizerReturn>(
        type: K,
        data: SynthesizerReturn[K]
    ) {
        this.resolveMap.get(type)?.(data);
        this.resolveMap.delete(type);
    }

    private registerInternalEvent<T extends keyof SynthProcessorEventData>(
        event: T,
        callback: ProcessorEventCallback<T>
    ) {
        this.eventHandler.addEvent(
            event,
            SPESSASYNTH_LIB_HANDLER(event),
            callback
        );
    }
}
