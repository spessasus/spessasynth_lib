import {
    type ChannelMIDIParameter,
    DEFAULT_GLOBAL_MIDI_PARAMETERS,
    DEFAULT_GLOBAL_SYSTEM_PARAMETERS,
    type GlobalMIDIParameter,
    type GlobalSystemParameter,
    type MIDIController,
    MIDIControllers,
    MIDIMessageTypes,
    type MIDIPatchFull,
    SpessaLog,
    type SynthesizerSnapshot,
    type SynthMethodOptions
} from "spessasynth_core";
import type { SequencerReturnMessage } from "../../sequencer/types";
import { fillWithDefaults } from "../../utils/fill_with_defaults";
import { ConsoleColors } from "../../utils/other";
import { reverbBufferBinary } from "../reverb/compressed_reverb_decoder";
import type {
    BasicSynthesizerMessage,
    BasicSynthesizerReturnMessage,
    LibSynthesizerEvent,
    SynthesizerProgress,
    SynthesizerReturn
} from "../types";
import { LibMIDIChannel } from "./lib_midi_channel";
import { SoundBankManager } from "./sound_bank_manager";
import {
    ALL_CHANNELS_OR_DIFFERENT_ACTION,
    CONVOLVER_OUTPUT,
    MAIN_OUTPUT,
    TOTAL_OUTPUT_COUNT,
    VISUAL_CHANNEL_OUTPUTS_START
} from "./synth_config";
import {
    type ProcessorEventCallback,
    SynthEventHandler
} from "./synth_event_handler";
import type { AudioNodeCreators, SynthConfig } from "./types";

const DEFAULT_SYNTH_METHOD_OPTIONS: SynthMethodOptions = {
    time: 0
};

const SPESSASYNTH_LIB_HANDLER = (event: string) =>
    `SPESSASYNTH_LIB_HANDLE_${event}_${Math.random()}`;

type SynthesizerPostFunction = (
    data: BasicSynthesizerMessage,
    transfer?: Transferable[]
) => unknown;

/**
 *
 * This abstract class contains shared methods between {@link WorkletSynthesizer} and {@link WorkerSynthesizer}.
 *
 * > **Warning**
 * >
 * > The synthesizer internally sends commands to the {@link BasicSynthesizerCore} where all the processing happens. (This can be a worklet or a worker depending on your synthesizer of choice.)
 * > Keep that in mind as not all methods will immediately report values!
 * > (E.g. {@link BasicSynthesizer.noteOn `noteOn`} won't instantly increase the voice count in {@link BasicSynthesizer.midiChannels `midiChannels`})
 *
 * ### Features
 *
 * The synthesizer uses `spessasynth_core`'s synthesizer as the core audio engine, providing extensive support for all supported audio formats and various MIDI extensions.
 *
 * [MIDI implementation chart can be found here](https://spessasus.github.io/spessasynth_core/extra/midi-implementation/).
 *
 * [Comparison of both synthesizers can be found here.](../../../docs/extra/comparing-synthesizers.md)
 * @group Synthesizer.Basic
 */
export abstract class BasicSynthesizer {
    /**
     * The synthesizer's sound bank manager.
     * It allows managing the sound bank list.
     */
    public readonly soundBankManager = new SoundBankManager(this);
    /**
     * The synthesizer's event handler.
     * It allows setting up custom event listeners for the synthesizer.
     */
    public readonly eventHandler = new SynthEventHandler();
    /**
     * Synthesizer's parent audio context instance.
     */
    public readonly context: BaseAudioContext;
    /**
     * The synthesizer's (virtual) MIDI channels.
     *
     * > **Note**
     * >
     * > The real channels live in {@link BasicSynthesizerCore}.
     */
    public readonly midiChannels: LibMIDIChannel[] = [];
    /**
     * The current preset list of the synthesizer,
     * including all soundbanks with their offsets set through the {@link SoundBankManager}.
     *
     * > **Tip**
     * >
     * > It is still recommended to use {@link LibSynthesizerEvent.presetListChange `presetListChange`} event as the data may not be immediately available.
     */
    public presetList: MIDIPatchFull[] = [];

    /**
     * INTERNAL USE ONLY!
     * @internal
     * All sequencer callbacks
     */
    public sequencers = new Array<(m: SequencerReturnMessage) => unknown>();
    /**
     * A promise that gets resolved when the synthesizer gets fully initialized.
     *
     * > **Warning**
     * >
     * > Remember to wait for this promise before playing anything or rendering audio!
     */
    public readonly isReady: Promise<unknown>;
    /**
     * INTERNAL USE ONLY!
     * @internal
     */
    public readonly post: SynthesizerPostFunction;
    /**
     * The `AudioNode` that processes the synthesizer's captured reverb tail through a Web Audio `ConvolverNode`.
     *
     * > **Warning**
     * >
     * > This property is only defined when {@link SynthConfig.convolverMode} is enabled.
     */
    public readonly convolverNode: ConvolverNode | undefined;
    protected readonly worklet: AudioWorkletNode;
    protected readonly convolverReady?: Promise<AudioBuffer>;
    /**
     * Spessasynth_core system parameters
     */
    protected readonly _systemParameters: GlobalSystemParameter = {
        ...DEFAULT_GLOBAL_SYSTEM_PARAMETERS
    };
    protected readonly lockedMIDIParameters = Object.fromEntries(
        Object.keys(DEFAULT_GLOBAL_MIDI_PARAMETERS).map((k) => [k, false])
    ) as Record<keyof GlobalMIDIParameter, boolean>;
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
     * @param context The audio context.
     * @param workletName The worklet processor name to use.
     * @param postFunction The internal post function. Leave undefined to use worklet's post message.
     * @param synthConfig Optional configuration for the synthesizer.
     * @internal
     */
    protected constructor(
        context: BaseAudioContext,
        workletName: string,
        synthConfig: SynthConfig,
        postFunction?: SynthesizerPostFunction
    ) {
        SpessaLog.info(
            "%cInitializing SpessaSynth synthesizer...",
            ConsoleColors.info
        );
        this.context = context;
        // Create worklet
        // Create the audio worklet node
        try {
            const workletConstructor: AudioNodeCreators["worklet"] =
                synthConfig?.audioNodeCreators?.worklet ??
                ((context, name, options) => {
                    return new AudioWorkletNode(context, name, options);
                });
            this.worklet = workletConstructor(context, workletName, {
                // Main output + convolver, potentially unused + 16 visual channels, all stereo pairs
                outputChannelCount: new Array<number>(TOTAL_OUTPUT_COUNT).fill(
                    2
                ),
                // 1 output
                numberOfOutputs: TOTAL_OUTPUT_COUNT,
                processorOptions: {
                    convolverMode: synthConfig.convolverMode,
                    sampleRate: context.sampleRate,
                    initialTime: context.currentTime,
                    processorConfig: {
                        eventsEnabled: synthConfig.eventsEnabled
                    }
                }
            });
        } catch (error) {
            console.error(error);
            throw new Error(
                "Could not create the AudioWorkletNode. Did you forget to addModule()?",
                { cause: error }
            );
        }

        let convolverPromise: Promise<AudioBuffer> | undefined = undefined;

        // Create convolver if needed
        if (synthConfig.convolverMode) {
            convolverPromise = context.decodeAudioData(reverbBufferBinary);

            this.convolverNode = context.createConvolver();
            this.worklet.connect(this.convolverNode, CONVOLVER_OUTPUT);
            this.convolverReady = convolverPromise.then((buffer) => {
                this.convolverNode!.buffer = buffer;
                return buffer;
            });
        }

        this.post =
            postFunction ??
            (((data, transfer = []) => {
                this.worklet.port.postMessage(data, transfer);
            }) as SynthesizerPostFunction);

        const backendPromise = new Promise((resolve) =>
            this.awaitWorkerResponse("sf3Decoder", resolve)
        );
        // Wait for both
        this.isReady = convolverPromise
            ? Promise.all([convolverPromise, backendPromise])
            : backendPromise;

        // Set up message handling and managers
        this.worklet.port.onmessage = (
            e: MessageEvent<BasicSynthesizerReturnMessage[]>
        ) => this.handleMessages(e.data);

        // Create initial channels
        for (let i = 0; i < 16; i++) this.addNewChannelInternal(false);

        // Attach event handlers
        this.registerInternalEvent("channelAdded", () => {
            this.addNewChannelInternal(false);
        });
        this.registerInternalEvent(
            "presetListChange",
            (e) => (this.presetList = [...e])
        );
        this.registerInternalEvent(
            "globalParamChange",
            <P extends keyof GlobalMIDIParameter>(e: {
                parameter: P;
                value: GlobalMIDIParameter[P];
            }) => (this._midiParameters[e.parameter] = e.value)
        );
        this.registerInternalEvent(
            "channelParamChange",
            <P extends keyof ChannelMIDIParameter>(e: {
                channel: number;
                parameter: P;
                value: ChannelMIDIParameter[P];
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
        this.registerInternalEvent("reset", () => {
            for (const c of this.midiChannels) c.reset();

            // Only reset unlocked parameters
            for (const [key, value] of Object.entries(
                DEFAULT_GLOBAL_MIDI_PARAMETERS
            ) as {
                [K in keyof GlobalMIDIParameter]: [K, GlobalMIDIParameter[K]];
            }[keyof GlobalMIDIParameter][]) {
                if (!this.lockedMIDIParameters[key])
                    // Strange cast but works
                    this._midiParameters[key] = value as never;
            }
        });
    }

    protected _midiParameters: GlobalMIDIParameter = {
        ...DEFAULT_GLOBAL_MIDI_PARAMETERS
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * The {@link GlobalMIDIParameter}s of the synthesizer.
     * These are only editable via MIDI messages.
     */
    public get midiParameters(): Readonly<GlobalMIDIParameter> {
        return this._midiParameters;
    }

    /**
     * Current voice amount
     */
    protected _voiceCount = 0;

    // noinspection JSUnusedGlobalSymbols
    /**
     * The current amount of voices (notes) being synthesized. A real-time value.
     */
    public get voiceCount() {
        return this._voiceCount;
    }

    /**
     * The connected `BaseAudioContext`'s time.
     */
    public get currentTime() {
        return this.context.currentTime;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The {@link GlobalSystemParameter}s of the synthesizer.
     * These are only editable via the API.
     */
    public get systemParameters(): Readonly<GlobalSystemParameter> {
        return this._systemParameters;
    }

    /**
     * Connects the synthesizer to a given AudioNode.
     * @param destinationNode The node to connect to.
     * @returns The destination node.
     */
    public connect(destinationNode: AudioNode) {
        // Connect main
        this.worklet.connect(destinationNode, MAIN_OUTPUT);

        // Connect convolver (optional)
        this.convolverNode?.connect(destinationNode);
        return destinationNode;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disconnects the synthesizer from a given AudioNode.
     * @param destinationNode The node to disconnect from.
     * @returns THe destination node.
     */
    public disconnect(destinationNode: AudioNode) {
        // Disconnect main output
        this.worklet.disconnect(destinationNode, MAIN_OUTPUT);

        // Connect convolver (optional)
        this.convolverNode?.disconnect(destinationNode);
        return destinationNode;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets `spessasynth_core`'s log level in the processor.
     * @example
     * ```js
     * // Enable all logs
     * synth.setLogLevel(true, true, true);
     * ```
     *
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
     * Locks or unlocks a given {@link GlobalMIDIParameter}.
     * This prevents any changes to it until it's unlocked.
     * @example
     * ```js
     * // Lock the MIDI system to GS
     * synth.lockMIDIParameter("system", "gs");
     * ```
     *
     * @param parameter The Global MIDI Parameter to lock.
     * @param isLocked If the parameter should be locked.
     */
    public lockMIDIParameter<P extends keyof GlobalMIDIParameter>(
        parameter: P,
        isLocked: boolean
    ) {
        this.post({
            type: "lockGlobalMIDIParameter",
            data: {
                parameter,
                isLocked
            },
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION
        });
        this.lockedMIDIParameters[parameter] = isLocked;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets a {@link GlobalSystemParameter} to a given value.
     * @example
     * ```js
     * // Set the master gain to 200%
     * synth.setSystemParameter("gain", 2);
     * ```
     *
     * @param parameter The parameter to set.
     * @param value The value to set.
     */
    public setSystemParameter<K extends keyof GlobalSystemParameter>(
        parameter: K,
        value: GlobalSystemParameter[K]
    ) {
        this._systemParameters[parameter] = value;
        this.post({
            type: "setGlobalSystemParameter",
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION,
            data: {
                parameter,
                value
            } as {
                [K in keyof GlobalSystemParameter]: {
                    parameter: K;
                    value: GlobalSystemParameter[K];
                };
            }[keyof GlobalSystemParameter]
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get a current {@link SynthesizerSnapshot} of the synthesizer.
     */
    public async getSnapshot() {
        return await new Promise<SynthesizerSnapshot>((resolve) => {
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
     * Connects a given channel output to the given audio node.
     * Note that this output is only meant for visualization and may be silent when Insertion Effect for this channel is enabled.
     * @example
     * ```js
     * // Create an analyzer for channel 1
     * const analyzer = context.createAnalyser();
     * synth.connectChannel(analyzer, 0);
     * ```
     *
     * @param targetNode The node to connect to.
     * @param channelNumber The channel number to connect to, will be rolled over if value is greater than 15.
     * @returns The target node.
     */
    public connectChannel(targetNode: AudioNode, channelNumber: number) {
        this.worklet.connect(
            targetNode,
            (channelNumber % 16) + VISUAL_CHANNEL_OUTPUTS_START
        );
        return targetNode;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disconnects a given channel output to the given audio node.
     * @example
     * ```js
     * // Disconnect the analyzer from earlier
     * synth.disconnectChannel(analyzer, 0);
     * ```
     *
     * @param targetNode The node to disconnect from.
     * @param channelNumber The channel number to connect to, will be rolled over if value is greater than 15.
     */
    public disconnectChannel(targetNode: AudioNode, channelNumber: number) {
        this.worklet.disconnect(
            targetNode,
            (channelNumber % 16) + VISUAL_CHANNEL_OUTPUTS_START
        );
    }

    /**
     * Sends a raw MIDI message to the synthesizer.
     * @example
     * ```js
     * // send a MIDI note on message for channel 2 and a note 61 (C#) with velocity 120
     * synth.sendMessage([0x92, 0x3d, 0x78]);
     * ```
     *
     * @param message  The MIDI message to process.
     * @param channelOffset Adds to the channel number of the message. It defaults to 0.
     * @param eventOptions Additional options for this command.
     */
    public sendMessage(
        message: Iterable<number>,
        channelOffset = 0,
        eventOptions: SynthMethodOptions = DEFAULT_SYNTH_METHOD_OPTIONS
    ) {
        this._sendInternal(message, channelOffset, eventOptions);
    }

    /**
     * Starts playing a note.
     *
     * > **Note**
     * >
     * > That velocity of 0 is treated like a Note Off message.
     * @example
     * ```js
     * // start the note 64 (E) on channel 0 with velocity of 120
     * synth.noteOn(0, 64, 120);
     * ```
     *
     * @param channel The MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
     * @param midiNote The MIDI note number to play. Ranges from 0 to 127.
     * @param velocity Controls how loud the note is. Ranges from 0 to 127, where 127 is the loudest and 1 is the quietest.
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
     * @example
     * ```js
     * // stop the note 78 (F) on channel 15
     * synth.noteOff(15, 77);
     * ```
     *
     * @param channel The MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
     * @param midiNote The MIDI note number to stop. Ranges from 0 to 127.
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
     * Stop all notes. Equivalent of MIDI "panic".
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
     * Set a given MIDI controller to a given value.
     *
     * > **Tip**
     * >
     * > Refer to [this table](https://spessasus.github.io/spessasynth_core/extra/midi-implementation#default-supported-controllers)
     * > for the list of controllers supported by default.
     * @example
     * ```js
     * // set controller 10 (Channel Pan) on channel 2 to 127 (Hard right)
     * synth.controllerChange(2, 10, 127);
     * ```
     *
     * @param channel The MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
     * @param controller The MIDI CC number of the controller to change.
     * @param value The value to set the given controller to. Ranges from 0 to 127.
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
     * Fully resets the synthesizer to GS mode.
     */
    public reset() {
        this.post({
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION,
            type: "ccReset",
            data: null
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Apply pressure to the given channel. It usually controls the vibrato amount.
     * @example
     * ```js
     * // set channel 1 pressure to 64 (middle)
     * synth.channelPressure(1, 64);
     * ```
     *
     * @param channel The MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
     * @param pressure The pressure to apply. Ranges from 0 to 127. 0 means no pressure, 127 means max.
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

    // noinspection JSUnusedGlobalSymbols
    /**
     * Apply pressure to the given note on a given channel.
     * It may be bound to specific parameters with system exclusive messages to allow for
     * extra controls, such as per-note pitch wheel.
     * @example
     * ```js
     * // set channel 11 pressure on note 60 (C) to 127 (max)
     * synth.polyPressure(11, 60, 127);
     * ```
     *
     * @param channel The MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
     * @param midiNote The MIDI note number to apply pressure to. Ranges from 0 to 127.
     * @param pressure The pressure to apply. Ranges from 0 to 127.
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

    // noinspection JSUnusedGlobalSymbols
    /**
     * Change the channel's pitch, including the currently playing notes.
     * @example
     * ```js
     * // set pitch bend on channel 1 to middle (no change)
     * synth.pitchWheel(0, 8192);
     * ```
     *
     * @param channel The MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
     * @param value The 14-bit pitch value. Ranges from 0 to 16383 where 8192 is no pitch change.
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
     * Change the channel's pitch bend range in semitones.
     * It uses Registered Parameter Number controllers internally.
     *
     * > **Tip**
     * >
     * > The pitch bend range can be decimal, for example, 0.5 means +- half a semitone.
     *
     * @example
     * ```js
     * // set the pitch bend range on channel 0 to +-12 semitones (one octave)
     * synth.pitchWheelRange(0, 12);
     * ```
     *
     * @param channel The MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
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
     * Changes the program for the given channel.
     * @example
     * ```js
     * // change the program on channel 1 to 16 (drawbar organ)
     * synth.programChange(0, 16);
     * ```
     *
     * @param channel The MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
     * @param programNumber The MIDI program number to use. Ranges from 0 to 127.
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
     *
     * > **Tip**
     * >
     * > Refer to the
     * > [MIDI Implementation](https://spessasus.github.io/spessasynth_core/extra/midi-implementation/#system-exclusives)
     * > for the list of supported System Exclusives.
     *
     * @example
     * ```js
     * // send a GS DT1 Use Drums On Channel 10 (turn channel 10 into a drum channel)
     * synth.systemExclusive([
     *     0x41, 0x10, 0x42, 0x12, 0x40, 0x1a, 0x15, 0x01, 0x10, 0xf7
     * ]);
     *
     * // send a GS DT1 Use Drums On Channel 10 (turn channel 20 into a drum channel)
     * synth.systemExclusive(
     *     [0x41, 0x10, 0x42, 0x12, 0x40, 0x1a, 0x15, 0x01, 0x10, 0xf7],
     *     10
     * );
     * ```
     *
     * @param messageData The message's data, excluding the F0 byte, but including the F7 at the end.
     * @param channelOffset The channel offset for the message as they usually can only address the first 16 channels.
     *   For example, to send a system exclusive on channel 16 (0-based),
     *   send a system exclusive for channel 0 and specify the channel offset to be 16.
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
     * Tunes individual MIDI key numbers on a given program using the MIDI Tuning Standard.
     * Think of it as a pitch wheel but for individual notes.
     *
     * > **Warning**
     * >
     * > This tuning is not applied per channel, but per MIDI program number.
     *
     * @param program The MIDI program to tune. Ranges from 0 to 127.
     * @param tunings An array of tunings, each containing two properties:
     * - `sourceKey` - the MIDI note number to tune.
     * - `targetPitch` - The MIDI note number of the target pitch.
     *  Note that floating values are allowed and they are specified in cents.
     * `targetPitch` of `-1` sets the default tuning.
     */
    public tuneKeys(
        program: number,
        tunings: {
            sourceKey: number;
            targetPitch: number;
        }[]
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
     *
     * Cranks the reverb up to the max and returns a string that says: `That's the spirit!`
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
    protected handleMessages(messages: BasicSynthesizerReturnMessage[]) {
        for (const m of messages)
            switch (m.type) {
                case "eventCall": {
                    this.eventHandler.callEventInternal(
                        m.data.type,
                        m.data.data
                    );
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
                    SpessaLog.warn(m.data);
                    this.eventHandler.callEventInternal(
                        "soundBankError",
                        m.data
                    );
                    break;
                }

                case "renderingProgress": {
                    this.renderingProgressTracker.get(m.data.type)?.(
                        m.data.data
                    );
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

    private registerInternalEvent<T extends keyof LibSynthesizerEvent>(
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
