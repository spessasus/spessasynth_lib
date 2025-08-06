import { WorkletKeyModifierManagerWrapper } from "./key_modifier_manager.ts";
import { SoundBankManager } from "./sound_bank_manager.ts";
import { SynthEventHandler } from "./synth_event_handler.ts";
import {
    ALL_CHANNELS_OR_DIFFERENT_ACTION,
    type ChannelProperty,
    DEFAULT_MASTER_PARAMETERS,
    DEFAULT_PERCUSSION,
    type MasterParameterType,
    type MIDIController,
    midiControllers,
    midiMessageTypes,
    type PresetListChangeCallback,
    SpessaSynthCoreUtils as util,
    SynthesizerSnapshot,
    type SynthMethodOptions
} from "spessasynth_core";
import type { SequencerReturnMessage } from "../sequencer/types.ts";
import type { ChorusConfig, SynthConfig } from "./audio_effects/types.ts";
import {
    DEFAULT_CHORUS_CONFIG,
    FancyChorus
} from "./audio_effects/fancy_chorus.ts";
import { DEFAULT_SYNTH_CONFIG } from "./audio_effects/effects_config.ts";
import type { WorkletMessage, WorkletReturnMessage } from "./types.ts";
import { consoleColors } from "../utils/other.ts";
import { fillWithDefaults } from "../utils/fill_with_defaults.ts";
import { getReverbProcessor } from "./audio_effects/reverb.ts";
import { LibSynthesizerSnapshot } from "./snapshot.ts";

const DEFAULT_SYNTH_METHOD_OPTIONS: SynthMethodOptions = {
    time: 0
};

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
    public readonly channelProperties: ChannelProperty[] = [];
    /**
     * The current preset list.
     */
    public presetList: PresetListChangeCallback = [];
    // INTERNAL USE ONLY!
    public sequencerCallbackFunction?: (m: SequencerReturnMessage) => unknown;
    /**
     * Resolves when the synthesizer is ready.
     */
    public readonly isReady: Promise<unknown>;
    // Effects configuration for the synthesizer.
    public synthConfig: SynthConfig;
    /**
     * Synthesizer's reverb processor.
     * Undefined if reverb is disabled.
     */
    public readonly reverbProcessor?: ConvolverNode;
    /**
     * Synthesizer's chorus processor.
     * Undefined if chorus is disabled.
     */
    public chorusProcessor?: FancyChorus;

    // Initialize internal promise resolution
    public resolveWhenReady?: (...args: unknown[]) => unknown = undefined;
    public readonly worklet: AudioWorkletNode;
    // INTERNAL USE ONLY!
    public readonly post: (
        data: WorkletMessage,
        transfer?: Transferable[]
    ) => unknown;
    /**
     * Synthesizer's output node.
     */
    protected readonly targetNode: AudioNode;
    protected _destroyed = false;
    /**
     * The new channels will have their audio sent to the modulated output by this constant.
     * what does that mean?
     * e.g., if outputsAmount is 16, then channel's 16 audio data will be sent to channel 0
     */
    protected readonly _outputsAmount = 16;
    /**
     * The current number of MIDI channels the synthesizer has
     */
    public channelsAmount = this._outputsAmount;
    protected snapshotCallback?: (s: SynthesizerSnapshot) => unknown;
    protected readonly masterParameters: MasterParameterType = {
        ...DEFAULT_MASTER_PARAMETERS
    };
    // Internal resolve for "isReady"
    protected isProcessorReady?: (value: unknown) => void;

    /**
     * Creates a new instance of a synthesizer.
     * @param worklet The AudioWorkletNode to use.
     * @param postFunction The internal post function.
     * @param targetNode The target node to connect to.
     * @param config Optional configuration for the synthesizer.
     */
    protected constructor(
        worklet: AudioWorkletNode,
        postFunction: (
            data: WorkletMessage,
            transfer?: Transferable[]
        ) => unknown,
        targetNode: AudioNode,
        config: Partial<SynthConfig> = DEFAULT_SYNTH_CONFIG
    ) {
        util.SpessaSynthInfo(
            "%cInitializing SpessaSynth synthesizer...",
            consoleColors.info
        );
        this.context = targetNode.context;
        this.targetNode = targetNode;
        this.worklet = worklet;
        this.post = postFunction;

        // Ensure default values for options
        const synthConfig = fillWithDefaults(config, DEFAULT_SYNTH_CONFIG);

        this.isReady = new Promise(
            (resolve) => (this.isProcessorReady = resolve)
        );

        // Initialize effects configuration
        this.synthConfig = fillWithDefaults(synthConfig, DEFAULT_SYNTH_CONFIG);

        // Set up message handling and managers
        this.worklet.port.onmessage = (e: MessageEvent<WorkletReturnMessage>) =>
            this.handleMessage(e.data);

        // Connect worklet outputs
        const reverbOn = this.synthConfig?.effectsConfig?.reverbEnabled ?? true;
        const chorusOn = this.synthConfig?.effectsConfig?.chorusEnabled ?? true;
        if (reverbOn) {
            const proc = getReverbProcessor(
                this.context,
                this.synthConfig.effectsConfig.reverbImpulseResponse
            );
            this.reverbProcessor = proc.conv;
            this.isReady = Promise.all([this.isReady, proc.promise]);
            this.reverbProcessor.connect(targetNode);
            this.worklet.connect(this.reverbProcessor, 0);
        }
        if (chorusOn) {
            const chorusConfig = fillWithDefaults(
                this.synthConfig.effectsConfig.chorusConfig,
                DEFAULT_CHORUS_CONFIG
            );
            this.chorusProcessor = new FancyChorus(targetNode, chorusConfig);
            this.worklet.connect(this.chorusProcessor.input, 1);
        }
        for (let i = 2; i < this.channelsAmount + 2; i++) {
            this.worklet.connect(targetNode, i);
        }

        // Create initial channels
        for (let i = 0; i < this.channelsAmount; i++) {
            this.addNewChannelInternal(false);
        }
        this.channelProperties[DEFAULT_PERCUSSION].isDrum = true;

        // Attach event handlers
        this.eventHandler.addEvent(
            "newChannel",
            `synth-new-channel-${Math.random()}`,
            () => {
                this.channelsAmount++;
            }
        );
        this.eventHandler.addEvent(
            "presetListChange",
            `synth-preset-list-change-${Math.random()}`,
            (e) => {
                this.presetList = e;
            }
        );
        this.eventHandler.addEvent(
            "masterParameterChange",
            `synth-master-parameter-change-${Math.random()}`,
            <P extends keyof MasterParameterType>(e: {
                parameter: P;
                value: MasterParameterType[P];
            }) => {
                this.masterParameters[e.parameter] = e.value;
            }
        );
        this.eventHandler.addEvent(
            "channelPropertyChange",
            `synth-channel-property-change-${Math.random()}`,
            (e) => {
                this.channelProperties[e.channel] = e.property;

                this._voicesAmount = this.channelProperties.reduce(
                    (sum, voices) => sum + voices.voicesAmount,
                    0
                );
            }
        );
    }

    /**
     * Current voice amount
     */
    protected _voicesAmount = 0;

    /**
     * The current number of voices playing.
     */
    public get voicesAmount() {
        return this._voicesAmount;
    }

    /**
     * @returns The audioContext's current time.
     */
    public get currentTime() {
        return this.context.currentTime;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets the SpessaSynth's log level in the worklet processor.
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
    /**
     * Gets a master parameter from the synthesizer.
     * @param type The parameter to get.
     * @returns The parameter value.
     */
    public getMasterParameter<K extends keyof MasterParameterType>(
        type: K
    ): MasterParameterType[K] {
        return this.masterParameters[type];
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets a master parameter to a given value.
     * @param type The parameter to set.
     * @param value The value to set.
     */
    public setMasterParameter<K extends keyof MasterParameterType>(
        type: K,
        value: MasterParameterType[K]
    ) {
        this.masterParameters[type] = value;
        this.post({
            type: "setMasterParameter",
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION,
            data: {
                type,
                data: value
            } as {
                [K in keyof MasterParameterType]: {
                    type: K;
                    data: MasterParameterType[K];
                };
            }[keyof MasterParameterType]
        });
    }

    /**
     * Gets a complete snapshot of the synthesizer, effects.
     */
    public async getSynthesizerSnapshot(): Promise<LibSynthesizerSnapshot> {
        return new Promise((resolve) => {
            this.snapshotCallback = (s: SynthesizerSnapshot) => {
                this.snapshotCallback = undefined;
                const snapshot = new LibSynthesizerSnapshot(
                    s.channelSnapshots,
                    s.masterParameters,
                    s.keyMappings,
                    this.synthConfig.effectsConfig
                );
                resolve(snapshot);
            };
            this.post({
                type: "requestSynthesizerSnapshot",
                data: null,
                channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION
            });
        });
    }

    /**
     * Adds a new channel to the synthesizer.
     */
    public addNewChannel() {
        this.addNewChannelInternal(true);
    }

    /**
     * Sets custom vibrato for the channel.
     * @param channel The channel number.
     * @param value The vibrato parameters.
     */
    public setVibrato(
        channel: number,
        value: { delay: number; depth: number; rate: number }
    ) {
        this.post({
            channelNumber: channel,
            type: "setChannelVibrato",
            data: value
        });
    }

    /**
     * Connects the individual audio outputs to the given audio nodes. In the app, it's used by the renderer.
     * @param audioNodes Exactly 16 outputs.
     */
    public connectIndividualOutputs(audioNodes: AudioNode[]) {
        if (audioNodes.length !== this._outputsAmount) {
            throw new Error(`input nodes amount differs from the system's outputs amount!
            Expected ${this._outputsAmount} got ${audioNodes.length}`);
        }
        for (
            let outputNumber = 0;
            outputNumber < this._outputsAmount;
            outputNumber++
        ) {
            // + 2 because chorus and reverb come first!
            this.worklet.connect(audioNodes[outputNumber], outputNumber + 2);
        }
    }

    /**
     * Disconnects the individual audio outputs to the given audio nodes. In the app, it's used by the renderer.
     * @param audioNodes Exactly 16 outputs.
     */
    public disconnectIndividualOutputs(audioNodes: AudioNode[]) {
        if (audioNodes.length !== this._outputsAmount) {
            throw new Error(`input nodes amount differs from the system's outputs amount!
            Expected ${this._outputsAmount} got ${audioNodes.length}`);
        }
        for (
            let outputNumber = 0;
            outputNumber < this._outputsAmount;
            outputNumber++
        ) {
            // + 2 because chorus and reverb come first!
            this.worklet.disconnect(audioNodes[outputNumber], outputNumber + 2);
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disables the GS NRPN parameters like vibrato or drum key tuning.
     */
    public disableGSNPRNParams() {
        // Rate -1 disables, see worklet_message.js line 9
        // Channel -1 is all
        this.setVibrato(ALL_CHANNELS_OR_DIFFERENT_ACTION, {
            depth: 0,
            rate: -1,
            delay: 0
        });
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
        this._sendInternal(message, channelOffset, false, eventOptions);
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
            [midiMessageTypes.noteOn | ch, midiNote, velocity],
            offset,
            eventOptions
        );
    }

    /**
     * Stops playing a note.
     * @param channel Usually 0-15: the channel of the note.
     * @param midiNote {number} 0-127 the key number of the note.
     * @param force Instantly kills the note if true.
     * @param eventOptions Additional options for this command.
     */
    public noteOff(
        channel: number,
        midiNote: number,
        force = false,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        midiNote %= 128;

        const ch = channel % 16;
        const offset = channel - ch;
        this._sendInternal(
            [midiMessageTypes.noteOff | ch, midiNote],
            offset,
            force,
            eventOptions
        );
    }

    /**
     * Stops all notes.
     * @param force If we should instantly kill the note, defaults to false.
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
     * @param controllerNumber 0-127 the MIDI CC number.
     * @param controllerValue 0-127 the controller value.
     * @param force Forces the controller-change message, even if it's locked or gm system is set and the cc is bank select.
     * @param eventOptions Additional options for this command.
     */
    public controllerChange(
        channel: number,
        controllerNumber: MIDIController,
        controllerValue: number,
        force = false,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        if (controllerNumber > 127 || controllerNumber < 0) {
            throw new Error(`Invalid controller number: ${controllerNumber}`);
        }
        controllerValue = Math.floor(controllerValue) % 128;
        controllerNumber = Math.floor(controllerNumber) % 128;
        // Controller change has its own message for the force property
        const ch = channel % 16;
        const offset = channel - ch;
        this._sendInternal(
            [
                midiMessageTypes.controllerChange | ch,
                controllerNumber,
                controllerValue
            ],
            offset,
            force,
            eventOptions
        );
    }

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
            [midiMessageTypes.channelPressure | ch, pressure],
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
            [midiMessageTypes.polyPressure | ch, midiNote, pressure],
            offset,
            eventOptions
        );
    }

    /**
     * Sets the pitch of the given channel.
     * @param channel Usually 0-15: the channel to change pitch.
     * @param MSB SECOND byte of the MIDI pitchWheel message.
     * @param LSB FIRST byte of the MIDI pitchWheel message.
     * @param eventOptions Additional options for this command.
     */
    public pitchWheel(
        channel: number,
        MSB: number,
        LSB: number,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        const ch = channel % 16;
        const offset = channel - ch;
        this.sendMessage(
            [midiMessageTypes.pitchBend | ch, LSB, MSB],
            offset,
            eventOptions
        );
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Transposes the channel by given number of semitones.
     * @param channel The channel number.
     * @param semitones The transposition of the channel, it can be a float.
     * @param force Defaults to false, if true transposes the channel even if it's a drum channel.
     */
    public transposeChannel(channel: number, semitones: number, force = false) {
        this.post({
            channelNumber: channel,
            type: "transposeChannel",
            data: {
                semitones,
                force
            }
        });
    }

    /**
     * Sets the channel's pitch bend range, in semitones.
     * @param channel Usually 0-15: the channel to change.
     * @param pitchBendRangeSemitones The bend range in semitones.
     */
    public setPitchBendRange(channel: number, pitchBendRangeSemitones: number) {
        // Set range
        this.controllerChange(channel, midiControllers.RPNMsb, 0);
        this.controllerChange(channel, midiControllers.RPNLsb, 0);
        this.controllerChange(
            channel,
            midiControllers.dataEntryMsb,
            pitchBendRangeSemitones
        );

        // Reset rpn
        this.controllerChange(channel, midiControllers.RPNMsb, 127);
        this.controllerChange(channel, midiControllers.RPNLsb, 127);
        this.controllerChange(channel, midiControllers.dataEntryMsb, 0);
    }

    /**
     * Changes the program for a given channel
     * @param channel Usually 0-15: the channel to change.
     * @param programNumber 0-127 the MIDI patch number.
     * defaults to false
     */
    public programChange(channel: number, programNumber: number) {
        const ch = channel % 16;
        const offset = channel - ch;
        programNumber %= 128;
        this.sendMessage(
            [midiMessageTypes.programChange | ch, programNumber],
            offset
        );
    }

    /**
     * Causes the given midi channel to ignore controller messages for the given controller number.
     * @param channel Usually 0-15: the channel to lock.
     * @param controllerNumber 0-127 MIDI CC number.
     * @param isLocked True if locked, false if unlocked.
     * @remarks
     *  Controller number -1 locks the preset.
     */
    public lockController(
        channel: number,
        controllerNumber: MIDIController | -1,
        isLocked: boolean
    ) {
        this.post({
            channelNumber: channel,
            type: "lockController",
            data: {
                controllerNumber,
                isLocked
            }
        });
    }

    /**
     * Mutes or unmutes the given channel.
     * @param channel Usually 0-15: the channel to lock.
     * @param isMuted Indicates if the channel is muted.
     */
    public muteChannel(channel: number, isMuted: boolean) {
        this.post({
            channelNumber: channel,
            type: "muteChannel",
            data: isMuted
        });
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
            [midiMessageTypes.systemExclusive, ...Array.from(messageData)],
            channelOffset,
            false,
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
                    (tuning.targetPitch - midiNote) / 0.000061
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
     * Toggles drums on a given channel.
     * @param channel The channel number.
     * @param isDrum If the channel should be drums.
     */
    public setDrums(channel: number, isDrum: boolean) {
        this.post({
            channelNumber: channel,
            type: "setDrums",
            data: isDrum
        });
    }

    /**
     * Updates the reverb processor with a new impulse response.
     * @param buffer the new reverb impulse response.
     */
    public setReverbResponse(buffer: AudioBuffer) {
        if (!this.reverbProcessor) {
            throw new Error(
                "Attempted to change reverb response without reverb being enabled."
            );
        }
        this.reverbProcessor.buffer = buffer;
        this.synthConfig.effectsConfig.reverbImpulseResponse = buffer;
    }

    /**
     * Updates the chorus processor parameters.
     * @param config the new chorus.
     */
    public setChorusConfig(config: Partial<ChorusConfig>) {
        if (!this.chorusProcessor) {
            throw new Error(
                "Attempted to change chorus config without chorus being enabled."
            );
        }
        const fullConfig = fillWithDefaults(config, DEFAULT_CHORUS_CONFIG);
        this.worklet.disconnect(this.chorusProcessor.input);
        this.chorusProcessor.delete();
        delete this.chorusProcessor;
        this.chorusProcessor = new FancyChorus(this.targetNode, fullConfig);
        this.worklet.connect(this.chorusProcessor.input, 1);
        this.synthConfig.effectsConfig.chorusConfig = fullConfig;
    }

    /**
     * Destroys the synthesizer instance.
     */
    public destroy() {
        this.reverbProcessor?.disconnect();
        this.chorusProcessor?.delete();
        // noinspection JSCheckFunctionSignatures
        this.post({
            channelNumber: 0,
            type: "destroyWorklet",
            data: null
        });
        this.worklet.disconnect();
        // @ts-expect-error destruction!
        // noinspection JSConstantReassignment
        delete this.worklet;
        // @ts-expect-error destruction!
        // noinspection JSConstantReassignment
        delete this.reverbProcessor;
        delete this.chorusProcessor;
        this._destroyed = true;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Yes please!
     */
    public reverbateEverythingBecauseWhyNot(): "That's the spirit!" {
        for (let i = 0; i < this.channelsAmount; i++) {
            this.controllerChange(i, midiControllers.reverbDepth, 127);
            this.lockController(i, midiControllers.reverbDepth, true);
        }
        return "That's the spirit!";
    }

    protected _sendInternal(
        message: Iterable<number>,
        channelOffset: number,
        force = false,
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
                force,
                options
            }
            //[new Uint8Array(message), offset, force, opts]
        });
    }

    /**
     * Handles the messages received from the worklet.
     */
    protected handleMessage(m: WorkletReturnMessage) {
        switch (m.type) {
            case "eventCall":
                this.eventHandler.callEventInternal(m.data.type, m.data.data);
                break;

            case "sequencerReturn":
                this.sequencerCallbackFunction?.(m.data);
                break;

            case "synthesizerSnapshot":
                this.snapshotCallback?.(SynthesizerSnapshot.copyFrom(m.data));
                break;

            case "isFullyInitialized":
                this.isProcessorReady?.(undefined);
                this.resolveWhenReady?.();
                break;

            case "soundBankError":
                util.SpessaSynthWarn(m.data as unknown as string);
                this.eventHandler.callEventInternal("soundBankError", m.data);
                break;
        }
    }

    protected addNewChannelInternal(post: boolean) {
        this.channelProperties.push({
            voicesAmount: 0,
            pitchBend: 0,
            pitchBendRangeSemitones: 0,
            isMuted: false,
            isDrum: false,
            transposition: 0,
            program: 0,
            bank: this.channelsAmount % 16 === DEFAULT_PERCUSSION ? 128 : 0
        });
        if (!post) {
            return;
        }
        this.post({
            channelNumber: 0,
            type: "addNewChannel",
            data: null
        });
    }
}
