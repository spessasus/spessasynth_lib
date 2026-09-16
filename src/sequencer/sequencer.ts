// Import for {@link}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { MIDITrack } from "spessasynth_core";
import {
    BasicMIDI,
    MIDIControllers,
    MIDIMessageTypes,
    MIDIUtils,
    SpessaSynthCoreUtils
} from "spessasynth_core";
import { songChangeType } from "./enums";
import { MIDIData } from "./midi_data";
import { DEFAULT_SEQUENCER_OPTIONS } from "./default_sequencer_options";
import type {
    LibSequencerEvent,
    SequencerMessage,
    SequencerMessageData,
    SequencerOptions,
    SequencerReturnMessage,
    SuppliedMIDIData
} from "./types";
import { SeqEventHandler } from "./seq_event_handler";
import { type BasicSynthesizer } from "../synthesizer/basic/basic_synthesizer";
import { ALL_CHANNELS_OR_DIFFERENT_ACTION } from "../synthesizer/basic/synth_config"; // noinspection JSUnusedGlobalSymbols

// noinspection JSUnusedGlobalSymbols
/**
 * This is the module that plays MIDI sequences using a {@link WorkletSynthesizer} or {@link WorkerSynthesizer}
 *
 * @group Sequencer
 */
export class Sequencer {
    /**
     * The data of all the sequences, stored like the {@link Sequencer.midiData} property, but for all songs.
     * Allows creating playlists with the decoded titles and metadata.
     */
    public songListData: MIDIData[] = [];
    /**
     * The sequencer's event handler.
     * It allows setting up custom event listeners for the sequencer.
     */
    public eventHandler = new SeqEventHandler();
    /**
     * Indicates whether the sequencer has finished playing a sequence.
     */
    public isFinished = false;
    /**
     * The synthesizer attached to this sequencer.
     */
    public readonly synth: BasicSynthesizer;
    /**
     * The data of the current sequence.
     * Undefined if the data is currently loading or if no song is playing.
     *
     * The {@link BasicMIDI.embeddedSoundBank} and {@link BasicMIDI.timeline} properties
     * and {@link MIDITrack.events} in the tracks are all empty to avoid copying the entire file between threads.
     *
     * > **Tip**
     * >
     * > To get the actual MIDI data, use the {@Sequencer.getMIDI} method.
     *
     * > **Danger**
     * >
     * > The sequencer doesn't instantly get the new MIDI information.
     * > Make sure to listen for the {@SynthEventData.songChange} instead of waiting or assuming that the data is available instantly.
     * > Also keep in mind that The sequencer _preloads_ the samples for the MIDI (this can be disabled with {@Sequencer.preload})
     */
    public midiData?: MIDIData;
    /**
     * The MIDI ports to play to.
     * Key is channel offset, value is the port.
     */
    private midiOutputs = new Map<
        number,
        { send: (data: number[]) => unknown }
    >();
    private isLoading = false;
    /**
     * Indicates if the sequencer is paused.
     * Paused if a number, undefined if playing.
     */
    private pausedTime?: number = 0;
    private getMIDICallback?: (receivedMIDI: BasicMIDI) => unknown = undefined;
    private highResTimeOffset = 0;
    /**
     * Absolute playback startTime, bases on the synth's time.
     */
    private absoluteStartTime: number;
    /**
     * For sending the messages to the correct SpessaSynthSequencer in core
     */
    private readonly sequencerID: number;

    /**
     * Creates a new MIDI sequencer for playing back MIDI files.
     *
     * > **Tip**
     * >
     * > As of `v4.1.0` you can connect more than 1 {@link Sequencer} to a synthesizer!
     *
     * @param synth The synthesizer instance to play back to.
     * @param options Optional configuration for the sequencer.
     */
    public constructor(
        synth: BasicSynthesizer,
        options: Partial<SequencerOptions> = DEFAULT_SEQUENCER_OPTIONS
    ) {
        this.synth = synth;
        this.absoluteStartTime = this.synth.currentTime;

        this.sequencerID = this.synth.assignNewSequencer(
            this.handleMessage.bind(this)
        );
        this._skipToFirstNoteOn = options?.skipToFirstNoteOn ?? true;

        if (options?.initialPlaybackRate !== 1) {
            this.playbackRate = options?.initialPlaybackRate ?? 1;
        }

        if (!this._skipToFirstNoteOn) {
            // Setter sends message
            this.sendMessage("setSkipToFirstNote", false);
        }

        window.addEventListener(
            "beforeunload",
            this.resetMIDIOutput.bind(this)
        );
    }

    private _shuffledSongIndexes: number[] = [];

    /**
     * The shuffled song indexes, pointing to songs in {@link Sequencer.songListData}.
     * This is used when shuffleMode is enabled.
     */
    public get shuffledSongIndexes() {
        return this._shuffledSongIndexes;
    }

    private _songIndex = 0;

    /**
     * The current song number in the playlist.
     * If shuffle mode is enabled, this is the index of the shuffled song list.
     */
    public get songIndex() {
        return this._songIndex;
    }

    /**
     * Sets the current song number in the playlist.
     * If shuffle Mode is enabled, this is the index of the shuffled song list.
     * @param value The new song index to set.
     */
    public set songIndex(value: number) {
        /**
         * Sets the song index in the playlist.
         */
        const clamped = Math.max(0, value % this._songCount);
        if (clamped === this._songIndex) {
            return;
        }
        this.isLoading = true;
        this.midiData = undefined;
        this.sendMessage("changeSong", {
            changeType: songChangeType.index,
            data: clamped
        });
    }

    private _currentTempo = 120;

    /**
     * Current song's tempo in BPM.
     */
    public get currentTempo() {
        return this._currentTempo;
    }

    /**
     * The current song's length, in seconds.
     * 0 if no track is currently loaded.
     */
    public get duration() {
        return this.midiData?.duration ?? 0;
    }

    private _songCount = 0;

    /**
     * The number of songs in the playlist.
     */
    public get songCount() {
        return this._songCount;
    }

    private _skipToFirstNoteOn: boolean;

    /**
     * Indicates if the sequencer should skip to first note on when the time is set below it.
     */
    public get skipToFirstNoteOn(): boolean {
        return this._skipToFirstNoteOn;
    }

    /**
     * Indicates if the sequencer should skip to first note on when the time is set below it.
     * @param val The new value for this parameter.
     */
    public set skipToFirstNoteOn(val: boolean) {
        this._skipToFirstNoteOn = val;
        this.sendMessage("setSkipToFirstNote", this._skipToFirstNoteOn);
    }

    /**
     * Internal loop count marker (-1 is infinite).
     */
    private _loopCount = -1;

    /**
     * The number of loops remaining until the loop is disabled.
     */
    public get loopCount() {
        return this._loopCount;
    }

    /**
     * The number of loops remaining until the loop is disabled.
     * Set to `Infinity` to loop forever.
     * It will automatically decrease by one every loop.
     * Set to 0 to disable loops.
     * @param val The new loop count.
     */
    public set loopCount(val) {
        this._loopCount = val;
        this.sendMessage("setLoopCount", val);
    }

    /**
     * Controls the playback's rate.
     */
    private _playbackRate = 1;

    /**
     * Controls how fast the song plays (1 is normal, 0.5 is half speed etc.)
     */
    public get playbackRate() {
        return this._playbackRate;
    }

    /**
     * Controls how fast the song plays (1 is normal, 0.5 is half speed etc.)
     * @param value The new playback rate.
     */
    public set playbackRate(value: number) {
        const t = this.currentTime;
        this.sendMessage("setPlaybackRate", value);
        this.highResTimeOffset *= value / this._playbackRate;
        this._playbackRate = value;
        this.recalculateStartTime(t);
    }

    private _shuffleSongs = false;

    /**
     * Controls if the sequencer should shuffle the songs in the song list.
     * If true, the sequencer will play the songs in a random order.
     *
     * Songs are shuffled on a {@Sequencer.loadNewSongList} call.
     */
    public get shuffleSongs() {
        return this._shuffleSongs;
    }

    /**
     * Controls if the sequencer should shuffle the songs in the song list.
     * If true, the sequencer will play the songs in a random order.
     *
     * Songs are shuffled on a {@Sequencer.loadNewSongList} call.
     * @param value The new value for this parameter.
     */
    public set shuffleSongs(value: boolean) {
        this._shuffleSongs = value;
        if (value) {
            this.sendMessage("changeSong", {
                changeType: songChangeType.shuffleOn
            });
        } else {
            this.sendMessage("changeSong", {
                changeType: songChangeType.shuffleOff
            });
        }
    }

    private _externalMIDIPlayback = false;

    /**
     * Enables or disables sending MIDI messages to the attached MIDI ports.
     *
     * > **Tip**
     * >
     * > Also see {@link MIDIDeviceHandler}.
     */
    public get externalMIDIPlayback() {
        return this._externalMIDIPlayback;
    }

    /**
     * Enables or disables sending MIDI messages to the attached MIDI ports.
     *
     * > **Tip**
     * >
     * > Also see {@link MIDIDeviceHandler}.
     * @param value The new value for this parameter.
     */
    public set externalMIDIPlayback(value: boolean) {
        this._externalMIDIPlayback = value;
        this.sendMessage("changeMIDIMessageSending", value);
    }

    /**
     * The current playback time of the song in seconds.
     */
    public get currentTime() {
        if (this.isLoading) {
            return 0;
        }
        // Return the paused time if it's set to something other than undefined
        if (this.pausedTime !== undefined) {
            return this.pausedTime;
        }

        return (
            (this.synth.currentTime - this.absoluteStartTime) *
            this._playbackRate
        );
    }

    /**
     * Seeks to the specified time.
     * @param time The new time in seconds.
     */
    public set currentTime(time) {
        this.sendMessage("setTime", time);
    }

    /**
     * A smoothed version of {@link Sequencer.currentTime}.
     * Use for visualization as it's not affected by the audioContext stutter.
     */
    public get currentHighResolutionTime() {
        if (this.pausedTime !== undefined) {
            return this.pausedTime;
        }
        const highResTimeOffset = this.highResTimeOffset;
        const absoluteStartTime = this.absoluteStartTime;

        // Sync performance.now to current time
        const performanceElapsedTime =
            (performance.now() / 1000 - absoluteStartTime) * this._playbackRate;

        let currentPerformanceTime = highResTimeOffset + performanceElapsedTime;
        const currentAudioTime = this.currentTime;

        const smoothingFactor = 0.01 * this._playbackRate;

        // Diff times smoothing factor
        const timeDifference = currentAudioTime - currentPerformanceTime;
        this.highResTimeOffset += timeDifference * smoothingFactor;

        // Return a smoothed performance time
        currentPerformanceTime =
            this.highResTimeOffset + performanceElapsedTime;
        return currentPerformanceTime;
    }

    /**
     * True if paused, false if playing or stopped.
     */
    public get paused() {
        return this.pausedTime !== undefined;
    }

    /**
     * Gets the actual {@link BasicMIDI} sequence, complete with track data.
     */
    public async getMIDI(): Promise<BasicMIDI> {
        return new Promise((resolve) => {
            this.getMIDICallback = resolve;
            this.sendMessage("getMIDI", null);
        });
    }

    /**
     * Load a new song list.
     * Note that this does not start playing the songs automatically
     * @param midiBuffers The MIDI files to play.
     */
    public loadNewSongList(midiBuffers: SuppliedMIDIData[]) {
        this.isLoading = true;
        this.midiData = undefined;
        this.sendMessage("loadNewSongList", midiBuffers);
        this._songIndex = 0;
        this._songCount = midiBuffers.length;
    }

    /**
     * Connects a given MIDI output port and plays the sequence to it.
     *
     * > **Note**
     * >
     * > You can also use the {@link MIDIDeviceHandler}.
     *
     * > **Warning**
     * >
     * > Remember to enable {@link Sequencer.externalMIDIPlayback}!
     *
     * @param output The output to connect.
     * @param channelOffset The channel offset of this output for multi-port files. For example 0 means the first port, 16 means the second port and so on.
     */
    public connectMIDIOutput(
        output: { send: (data: number[]) => unknown },
        channelOffset = 0
    ) {
        this.resetMIDIOutput();
        if (output) {
            this.midiOutputs.set(channelOffset, output);
        } else {
            this.midiOutputs.clear();
        }
    }

    /**
     * Disconnects a given MIDI output port from the sequencer.
     *
     * > **Warning**
     * >
     * > Remember to disable {@link Sequencer.externalMIDIPlayback}
     * > if you want to use the synthesizer for playback.
     *
     * @param output The output to disconnect.
     */
    public disconnectMIDIOutput(output: { send: (data: number[]) => unknown }) {
        for (const [key, value] of this.midiOutputs) {
            if (value === output) {
                this.midiOutputs.delete(key);
                return;
            }
        }
    }

    /**
     * Pauses the playback of the sequence.
     */
    public pause() {
        if (this.paused) {
            return;
        }
        this.pausedTime = this.currentTime;
        this.sendMessage("pause", null);
    }

    /**
     * Starts playing or resumes the sequence.
     */
    public play() {
        this.recalculateStartTime(this.pausedTime ?? 0);
        this.pausedTime = undefined;
        this.isFinished = false;
        this.sendMessage("play", null);
    }

    private handleMessage(m: SequencerReturnMessage) {
        switch (m.type) {
            case "midiMessage": {
                const midiEvent = m.data;
                const midiEventData = midiEvent.message;
                if (this.midiOutputs.size > 0 && midiEventData[0] >= 0x80) {
                    const output =
                        this.midiOutputs.get(midiEvent.channelOffset) ??
                        this.midiOutputs.values().next().value!;
                    output.send(midiEventData);
                    return;
                }
                break;
            }

            case "songChange": {
                this._songIndex = m.data.songIndex;
                const idx = this._shuffleSongs
                    ? this._shuffledSongIndexes[this._songIndex]
                    : this._songIndex;
                const songChangeData = this.songListData[idx];
                this.midiData = songChangeData;
                this.isLoading = false;
                this.absoluteStartTime = 0;
                this.callEventInternal("songChange", {
                    songIndex: m.data.songIndex,
                    midiData: songChangeData
                });
                break;
            }

            case "sync": {
                if (Math.abs(m.data - this.currentTime) > 0.05)
                    this.recalculateStartTime(m.data);
                break;
            }

            case "timeChange": {
                // Message data is absolute time
                const time = m.data.newTime;
                this.recalculateStartTime(time);
                this.callEventInternal("timeChange", m.data);
                break;
            }

            case "songEnded": {
                this.pausedTime = this.currentTime;
                this.isFinished = true;
                this.callEventInternal("songEnded", m.data);
                break;
            }

            case "midiError": {
                this.callEventInternal("midiError", m.data);
                break;
            }

            case "getMIDI": {
                if (this.getMIDICallback) {
                    this.getMIDICallback(BasicMIDI.copyFrom(m.data));
                }
                break;
            }

            case "metaEvent": {
                const event = m.data.event;
                switch (event.statusByte) {
                    case MIDIMessageTypes.setTempo: {
                        this._currentTempo =
                            60_000_000 /
                            SpessaSynthCoreUtils.readBigEndian(event.data, 3);
                        break;
                    }

                    case MIDIMessageTypes.text:
                    case MIDIMessageTypes.lyric:
                    case MIDIMessageTypes.copyright:
                    case MIDIMessageTypes.trackName:
                    case MIDIMessageTypes.marker:
                    case MIDIMessageTypes.cuePoint:
                    case MIDIMessageTypes.instrumentName:
                    case MIDIMessageTypes.programName: {
                        if (!this.midiData) {
                            break;
                        }
                        let lyricsIndex = -1;
                        if (event.statusByte === MIDIMessageTypes.lyric) {
                            lyricsIndex = Math.min(
                                this.midiData.lyrics.findIndex(
                                    (l) => l.ticks === event.ticks
                                ),
                                this.midiData.lyrics.length - 1
                            );
                        }
                        // If MIDI is a karaoke file, it uses the "text" event type or "lyrics" for lyrics (duh)
                        // Why?
                        // Because the MIDI standard is a messy pile of garbage,
                        // And it's not my fault that it's like this :(
                        // I'm just trying to make the best out of a bad situation.
                        // I'm sorry
                        // Okay I should get back to work
                        // Anyway,
                        // Check for a karaoke file and change the status byte to "lyric"
                        // If it's a karaoke file
                        if (
                            this.midiData.isKaraokeFile &&
                            (event.statusByte === MIDIMessageTypes.text ||
                                event.statusByte === MIDIMessageTypes.lyric)
                        ) {
                            lyricsIndex = Math.min(
                                this.midiData.lyrics.findIndex(
                                    (l) => l.ticks === event.ticks
                                ),
                                this.midiData.lyrics.length
                            );
                        }
                        this.callEventInternal("textEvent", {
                            event,
                            lyricsIndex
                        });
                        break;
                    }
                }
                this.callEventInternal("metaEvent", m.data);
                break;
            }

            case "loopCountChange": {
                this._loopCount = m.data.newCount;
                this.callEventInternal("loopCountChange", m.data);
                break;
            }

            case "songListChange": {
                // Remap to MIDI data again as cloned objects don't get methods.
                this.songListData = m.data.newSongList.map(
                    (m) => new MIDIData(m)
                );
                this._shuffledSongIndexes = m.data.shuffledSongIndexes;
                break;
            }

            default: {
                break;
            }
        }
    }

    private callEventInternal<EventType extends keyof LibSequencerEvent>(
        type: EventType,
        data: LibSequencerEvent[EventType]
    ) {
        this.eventHandler.callEventInternal(type, data);
    }

    private resetMIDIOutput() {
        for (const output of this.midiOutputs.values()) {
            for (let i = 0; i < 16; i++) {
                output.send([
                    MIDIMessageTypes.controllerChange | i,
                    MIDIControllers.allNotesOff,
                    0
                ]); // All notes off
                output.send([
                    MIDIMessageTypes.controllerChange | i,
                    MIDIControllers.resetAllControllers,
                    0
                ]); // Reset all controllers
            }
            output.send([
                MIDIMessageTypes.systemExclusive,
                ...MIDIUtils.gs(
                    0x40, // System parameter - Address
                    0x00, // Global mode parameter -  Address
                    0x7f, // MODE SET - Address
                    [0x00] // 00 = GS Reset - Data
                )
            ]);
        }
    }

    private recalculateStartTime(time: number) {
        this.absoluteStartTime =
            this.synth.currentTime - time / this._playbackRate;
        this.highResTimeOffset =
            (this.synth.currentTime - performance.now() / 1000) *
            this._playbackRate;
        if (this.paused) {
            this.pausedTime = time;
        }
    }

    private sendMessage<T extends keyof SequencerMessageData>(
        messageType: T,
        messageData: SequencerMessageData[T]
    ) {
        this.synth.post({
            channelNumber: ALL_CHANNELS_OR_DIFFERENT_ACTION,
            type: "sequencerSpecific",
            data: {
                type: messageType,
                data: messageData,
                id: this.sequencerID
            } as SequencerMessage
        });
    }
}
