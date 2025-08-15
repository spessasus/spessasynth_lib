import { ALL_CHANNELS_OR_DIFFERENT_ACTION, BasicMIDI, MIDIMessage, midiMessageTypes } from "spessasynth_core";
import { songChangeType } from "./enums.js";
import { DUMMY_MIDI_DATA, MIDIData } from "./midi_data.js";
import { DEFAULT_SEQUENCER_OPTIONS } from "./default_sequencer_options.js";
import type {
    SequencerMessage,
    SequencerMessageData,
    SequencerOptions,
    SequencerReturnMessage,
    SuppliedMIDIData,
    WorkletSequencerEventType
} from "./types";
import { SeqEventHandler } from "./seq_event_handler";
import type { BasicSynthesizer } from "../synthesizer/basic/basic_synthesizer.ts";

// noinspection JSUnusedGlobalSymbols
export class Sequencer {
    /**
     * The current MIDI data, with the exclusion of the embedded sound bank and event data.
     */
    public midiData?: MIDIData;
    /**
     * The current MIDI data for all songs, like the midiData property.
     */
    public songListData: MIDIData[] = [];
    /**
     * Allows setting up custom event listeners for the sequencer.
     */
    public eventHandler = new SeqEventHandler();
    /**
     * Indicates if the current midiData property has fake data in it (not yet loaded).
     */
    public hasDummyData = true;
    /**
     * Indicates whether the sequencer has finished playing a sequence.
     */
    public isFinished = false;
    // The synthesizer attached to this sequencer.
    public readonly synth: BasicSynthesizer;
    // The MIDI port to play to.
    protected midiOut?: MIDIOutput;
    /**
     * Fires on meta-event
     * @type {Object<string, function([MIDIMessage, number])>}
     */
    protected onMetaEvent: Record<
        string,
        (metaMessage: MIDIMessage, trackIndex: number) => unknown
    > = {};
    /**
     * Indicates if the sequencer is paused.
     * Paused if a number, undefined if playing.
     */
    protected pausedTime?: number = 0;
    protected getMIDICallback?: (receivedMIDI: BasicMIDI) => unknown =
        undefined;
    protected highResTimeOffset = 0;
    /**
     * Absolute playback startTime, bases on the synth's time.
     */
    protected absoluteStartTime: number;
    /**
     * Internal loop marker.
     */
    protected _loop = false;

    /**
     * Creates a new MIDI sequencer for playing back MIDI files.
     * @param synth synth to send events to.
     * @param options the sequencer's options.
     */
    public constructor(
        synth: BasicSynthesizer,
        options: Partial<SequencerOptions> = DEFAULT_SEQUENCER_OPTIONS
    ) {
        this.synth = synth;
        this.absoluteStartTime = this.synth.currentTime;

        this.synth.sequencerCallbackFunction = this.handleMessage.bind(this);
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

    protected _songIndex = 0;

    /**
     * The current song number in the playlist.
     */
    public get songIndex() {
        return this._songIndex;
    }

    /**
     * The current song number in the playlist.
     */
    public set songIndex(value: number) {
        /**
         * Sets the song index in the playlist.
         */
        const clamped = Math.max(Math.min(this._songsAmount - 1, value), 0);
        this.sendMessage("changeSong", {
            changeType: songChangeType.index,
            data: clamped
        });
    }

    protected _currentTempo = 120;

    /**
     * Current song's tempo in BPM.
     */
    public get currentTempo() {
        return this._currentTempo;
    }

    /**
     * The current sequence's length, in seconds.
     */
    public get duration() {
        return this.midiData?.duration ?? 0;
    }

    protected _songsAmount = 0;

    // The amount of songs in the list.
    public get songsAmount() {
        return this._songsAmount;
    }

    protected _skipToFirstNoteOn: boolean;

    /**
     * Indicates if the sequencer should skip to first note on.
     */
    public get skipToFirstNoteOn(): boolean {
        return this._skipToFirstNoteOn;
    }

    /**
     * Indicates if the sequencer should skip to first note on.
     */
    public set skipToFirstNoteOn(val: boolean) {
        this._skipToFirstNoteOn = val;
        this.sendMessage("setSkipToFirstNote", this._skipToFirstNoteOn);
    }

    /**
     * Internal loop count marker (-1 is infinite).
     */
    protected _loopCount = -1;

    /**
     * The current remaining number of loops. -1 means infinite looping.
     */
    public get loopCount() {
        return this._loopCount;
    }

    /**
     * The current remaining number of loops. -1 means infinite looping.
     */
    public set loopCount(val) {
        this._loopCount = val;
        this.sendMessage("setLoopCount", val);
    }

    /**
     * Controls the playback's rate.
     */
    protected _playbackRate = 1;

    /**
     * Controls the playback's rate.
     */
    public get playbackRate() {
        return this._playbackRate;
    }

    /**
     * Controls the playback's rate.
     */
    public set playbackRate(value: number) {
        this.sendMessage("setPlaybackRate", value);
        this.highResTimeOffset *= value / this._playbackRate;
        this._playbackRate = value;
    }

    protected _shuffleSongs = false;

    /**
     * Indicates if the song order is random.
     */
    public get shuffleSongs() {
        return this._shuffleSongs;
    }

    /**
     * Indicates if the song order is random.
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

    /**
     * Current playback time, in seconds.
     */
    public get currentTime() {
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
     * Current playback time, in seconds.
     */
    public set currentTime(time) {
        this.sendMessage("setTime", time);
    }

    /**
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
     * Gets the current MIDI File.
     */
    public async getMIDI(): Promise<BasicMIDI> {
        return new Promise((resolve) => {
            this.getMIDICallback = resolve;
            this.sendMessage("getMIDI", null);
        });
    }

    /**
     * Loads a new song list.
     * @param midiBuffers The MIDI files to play.
     */
    public loadNewSongList(midiBuffers: SuppliedMIDIData[]) {
        // Add some fake data
        this.midiData = DUMMY_MIDI_DATA;
        this.hasDummyData = true;
        this.sendMessage("loadNewSongList", midiBuffers);
        this._songIndex = 0;
        this._songsAmount = midiBuffers.length;
    }

    /**
     * Connects a given output to the sequencer.
     * @param output The output to connect.
     */
    public connectMIDIOutput(output?: MIDIOutput) {
        this.resetMIDIOutput();
        this.midiOut = output;
        this.sendMessage("changeMIDIMessageSending", output !== undefined);
        this.currentTime -= 0.1;
    }

    /**
     * Pauses the playback.
     */
    public pause() {
        if (this.paused) {
            return;
        }
        this.pausedTime = this.currentTime;
        this.sendMessage("pause", null);
    }

    /**
     * Starts or resumes the playback.
     */
    public play() {
        this.recalculateStartTime(this.pausedTime ?? 0);
        this.pausedTime = undefined;
        this.isFinished = false;
        this.sendMessage("play", null);
    }

    protected handleMessage(m: SequencerReturnMessage) {
        switch (m.type) {
            case "midiMessage":
                const midiEventData = m.data.message as number[];
                if (this.midiOut) {
                    if (midiEventData[0] >= 0x80) {
                        this.midiOut.send(midiEventData);
                        return;
                    }
                }
                break;

            case "songChange":
                this._songIndex = m.data.songIndex;
                const songChangeData = this.songListData[this._songIndex];
                this.midiData = songChangeData;
                this.hasDummyData = false;
                this.absoluteStartTime = 0;
                this.callEventInternal("songChange", songChangeData);
                break;

            case "timeChange":
                // Message data is absolute time
                const time = m.data.newTime;
                this.recalculateStartTime(time);
                this.callEventInternal("timeChange", time);
                break;

            case "pause":
                this.pausedTime = this.currentTime;
                this.isFinished = m.data.isFinished;
                if (this.isFinished) {
                    this.callEventInternal("songEnded", null);
                }
                break;

            case "midiError":
                this.callEventInternal("midiError", m.data);
                throw new Error(`MIDI parsing error:  ${m.data}`);

            case "getMIDI":
                if (this.getMIDICallback) {
                    this.getMIDICallback(BasicMIDI.copyFrom(m.data));
                }
                break;

            case "metaEvent":
                const event = m.data.event;
                switch (event.statusByte) {
                    case midiMessageTypes.text:
                    case midiMessageTypes.lyric:
                    case midiMessageTypes.copyright:
                    case midiMessageTypes.trackName:
                    case midiMessageTypes.marker:
                    case midiMessageTypes.cuePoint:
                    case midiMessageTypes.instrumentName:
                    case midiMessageTypes.programName:
                        if (!this.midiData) {
                            break;
                        }
                        let lyricsIndex = -1;
                        if (event.statusByte === midiMessageTypes.lyric) {
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
                            (event.statusByte === midiMessageTypes.text ||
                                event.statusByte === midiMessageTypes.lyric)
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
                this.callEventInternal("metaEvent", {
                    event: m.data.event,
                    trackNumber: m.data.trackIndex
                });
                break;

            case "loopCountChange":
                this._loopCount = m.data.newCount;
                if (this._loopCount === 0) {
                }
                break;

            case "songListChange":
                // Remap to MIDI data again as cloned objects don't get methods.
                this.songListData = m.data.newSongList.map(
                    (m) => new MIDIData(m)
                );
                this.midiData = this.songListData[this._songIndex];
                break;

            default:
                break;
        }
    }

    protected callEventInternal<
        EventType extends keyof WorkletSequencerEventType
    >(type: EventType, data: WorkletSequencerEventType[EventType]) {
        this.eventHandler.callEventInternal(type, data);
    }

    protected resetMIDIOutput() {
        if (!this.midiOut) {
            return;
        }
        for (let i = 0; i < 16; i++) {
            this.midiOut.send([midiMessageTypes.controllerChange | i, 120, 0]); // All notes off
            this.midiOut.send([midiMessageTypes.controllerChange | i, 123, 0]); // All sound off
        }
        this.midiOut.send([midiMessageTypes.reset]); // Reset
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
                data: messageData
            } as SequencerMessage
        });
    }
}
