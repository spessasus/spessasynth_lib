import { consoleColors } from "../utils/other.js";
import {
    ALL_CHANNELS_OR_DIFFERENT_ACTION,
    BasicMIDI,
    loadSoundFont,
    MIDI_CHANNEL_COUNT,
    type ProcessorEventType,
    SoundBankLoader,
    SpessaSynthCoreUtils as util,
    SpessaSynthLogging,
    SpessaSynthProcessor,
    SpessaSynthSequencer,
    SynthesizerSnapshot
} from "spessasynth_core";
import { WORKLET_PROCESSOR_NAME } from "./worklet_url.js";
import { WorkletSoundfontManagerMessageType } from "./sfman_message.js";
import {
    sequencerMessageType,
    sequencerReturnMessageType,
    songChangeType
} from "../sequencer/enums.js";
import { fillWithDefaults } from "../utils/fill_with_defaults.js";
import { DEFAULT_SEQUENCER_OPTIONS } from "../sequencer/default_sequencer_options.js";
import { MIDIData } from "../sequencer/midi_data.js";
import type {
    StartRenderingDataConfig,
    WorkletMessage,
    WorkletReturnMessage,
    WorkletReturnMessageData
} from "./types";
import type {
    SequencerOptions,
    SequencerReturnMessage
} from "../sequencer/types";

// a worklet processor wrapper for the synthesizer core
class WorkletSpessaProcessor extends AudioWorkletProcessor {
    /**
     * If the worklet is alive.
     */
    alive = true;

    /**
     * Instead of 18 stereo outputs, there's one with 32 channels (no effects).
     */
    oneOutputMode = false;

    synthesizer: SpessaSynthProcessor;
    sequencer: SpessaSynthSequencer | undefined;

    /**
     * Creates a new worklet synthesis system. contains all channels.
     */
    constructor(options: {
        processorOptions: {
            midiChannels: number;
            soundBank: ArrayBuffer;
            enableEventSystem: boolean;
            startRenderingData: StartRenderingDataConfig;
        };
    }) {
        super();
        const opts = options.processorOptions;

        // one output is indicated by setting midiChannels to 1
        this.oneOutputMode = opts.midiChannels === 1;

        // prepare synthesizer connections
        const postSyn = (m: WorkletReturnMessage) => {
            this.postMessageToMainThread(m);
        };

        // start rendering data
        const startRenderingData = opts?.startRenderingData;
        /**
         * The snapshot that synth was restored from.
         */
        const snapshot: SynthesizerSnapshot | undefined =
            startRenderingData?.snapshot;

        /**
         * Initialize the synthesis engine.
         */
        this.synthesizer = new SpessaSynthProcessor(
            sampleRate, // AudioWorkletGlobalScope
            {
                effectsEnabled: !this.oneOutputMode, // one output mode disables effects
                enableEventSystem: opts?.enableEventSystem, // enable message port?
                midiChannels: MIDI_CHANNEL_COUNT, // midi channel count (16)
                initialTime: currentTime // AudioWorkletGlobalScope, sync with audioContext time
            }
        );
        this.synthesizer.onEventCall = <K extends keyof ProcessorEventType>(
            type: K,
            data: ProcessorEventType[K]
        ) => {
            const d: WorkletReturnMessageData["eventCall"] = { type, data };
            postSyn({
                type: "eventCall",
                data: d
            });
        };
        this.synthesizer.onChannelPropertyChange = (p, n) =>
            postSyn({
                type: "channelPropertyChange",
                data: { channelNumber: n, property: p }
            });
        this.synthesizer.onMasterParameterChange = (t, v) =>
            postSyn({
                type: "masterParameterChange",
                data: {
                    type: t,
                    data: v
                }
            });

        const bank = SoundBankLoader.fromArrayBuffer(opts.soundBank);
        this.synthesizer.soundBankManager.reloadManager(bank);

        this.synthesizer.processorInitialized.then(() => {
            // initialize the sequencer engine
            this.sequencer = new SpessaSynthSequencer(this.synthesizer);

            const postSeq = (m: SequencerReturnMessage) => {
                this.postMessageToMainThread({
                    type: "sequencerSpecific",
                    data: m
                });
            };

            // receive messages from the main thread
            this.port.onmessage = (e) => this.handleMessage(e.data);

            // sequencer events
            this.sequencer.onMIDIMessage = (m) => {
                postSeq({
                    type: "midiEvent",
                    data: m
                });
            };
            this.sequencer.onTimeChange = (t) => {
                postSeq({
                    type: "timeChange",
                    data: t
                });
            };
            this.sequencer.onPlaybackStop = (p) => {
                postSeq({
                    type: "pause",
                    data: p
                });
            };
            this.sequencer.onSongChange = (songIndex, isAutoPlayed) => {
                postSeq({
                    type: "songChange",
                    data: {
                        songIndex,
                        isAutoPlayed
                    }
                });
            };
            this.sequencer.onMetaEvent = (event, trackNum) => {
                postSeq({
                    type: "metaEvent",
                    data: {
                        event,
                        trackNum
                    }
                });
            };
            this.sequencer.onLoopCountChange = (c) => {
                postSeq({
                    type: "loopCountChange",
                    data: c
                });
            };
            this.sequencer.onSongListChange = (l) => {
                const midiDataList = l.map((s) => new MIDIData(s));
                postSeq({
                    type: "songListChange",
                    data: midiDataList
                });
            };

            if (snapshot !== undefined) {
                this.synthesizer.applySynthesizerSnapshot(snapshot);
            }

            // if sent, start rendering
            if (startRenderingData) {
                util.SpessaSynthInfo(
                    "%cRendering enabled! Starting render.",
                    consoleColors.info
                );
                if (startRenderingData.parsedMIDI) {
                    if (startRenderingData?.loopCount !== undefined) {
                        this.sequencer.loopCount =
                            startRenderingData?.loopCount;
                        this.sequencer.loop = true;
                    } else {
                        this.sequencer.loop = false;
                    }
                    // set voice cap to unlimited
                    this.synthesizer.setMasterParameter("voiceCap", Infinity);

                    /**
                     * set options
                     */
                    const seqOptions: SequencerOptions = fillWithDefaults(
                        startRenderingData.sequencerOptions,
                        DEFAULT_SEQUENCER_OPTIONS
                    );
                    this.sequencer.skipToFirstNoteOn =
                        seqOptions.skipToFirstNoteOn;
                    this.sequencer.preservePlaybackState =
                        seqOptions.preservePlaybackState;
                    this.sequencer.playbackRate =
                        seqOptions.initialPlaybackRate;
                    // autoplay is ignored
                    try {
                        // cloned objects don't have methods
                        this.sequencer.loadNewSongList([
                            BasicMIDI.copyFrom(startRenderingData.parsedMIDI)
                        ]);
                    } catch (e) {
                        console.error(e);
                        postSeq({
                            type: "midiError",
                            data: e as string
                        });
                    }
                }
            }

            this.postReady();
        });
    }

    postReady() {
        this.postMessageToMainThread({
            type: "isFullyInitialized",
            data: null
        });
    }

    postMessageToMainThread(data: WorkletReturnMessage) {
        this.port.postMessage(data);
    }

    handleMessage(m: WorkletMessage) {
        const channel = m.channelNumber;

        let channelObject:
            | (typeof this.synthesizer.midiChannels)[number]
            | undefined = undefined;
        if (channel >= 0) {
            channelObject = this.synthesizer.midiChannels[channel];
            if (channelObject === undefined) {
                util.SpessaSynthWarn(
                    `Trying to access channel ${channel} which does not exist... ignoring!`
                );
                return;
            }
        }
        if (!channelObject) {
            return;
        }
        switch (m.messageType) {
            case "midiMessage":
                this.synthesizer.processMessage(
                    m.messageData.messageData,
                    m.messageData.channelOffset,
                    m.messageData.force,
                    m.messageData.options
                );
                break;

            case "customCcChange":
                // custom controller change
                channelObject.setCustomController(
                    m.messageData.ccNumber,
                    m.messageData.ccValue
                );
                break;

            case "ccReset":
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                    this.synthesizer.resetAllControllers();
                } else {
                    channelObject.resetControllers();
                }
                break;

            case "setChannelVibrato":
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                    for (
                        let i = 0;
                        i < this.synthesizer.midiChannels.length;
                        i++
                    ) {
                        const chan = this.synthesizer.midiChannels[i];
                        if (
                            m.messageData.rate ===
                            ALL_CHANNELS_OR_DIFFERENT_ACTION
                        ) {
                            chan.disableAndLockGSNRPN();
                        } else {
                            chan.setVibrato(
                                m.messageData.depth,
                                m.messageData.rate,
                                m.messageData.delay
                            );
                        }
                    }
                } else if (
                    m.messageData.rate === ALL_CHANNELS_OR_DIFFERENT_ACTION
                ) {
                    channelObject.disableAndLockGSNRPN();
                } else {
                    channelObject.setVibrato(
                        m.messageData.depth,
                        m.messageData.rate,
                        m.messageData.delay
                    );
                }
                break;

            case "stopAll":
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                    this.synthesizer.stopAllChannels(m.messageData === 1);
                } else {
                    channelObject.stopAllNotes(m.messageData === 1);
                }
                break;

            case "killNotes":
                this.synthesizer.voiceKilling(m.messageData);
                break;

            case "muteChannel":
                channelObject.muteChannel(m.messageData);
                break;

            case "addNewChannel":
                this.synthesizer.createMidiChannel();
                break;

            case "setMasterParameter":
                this.synthesizer.setMasterParameter(
                    m.messageData.parameter,
                    m.messageData.value
                );
                break;

            case "setDrums":
                channelObject.setDrums(m.messageData);
                break;

            case "transposeChannel":
                channelObject.transposeChannel(
                    m.messageData.semitones,
                    m.messageData.force
                );
                break;

            case "lockController":
                if (
                    m.messageData.controllerNumber ===
                    ALL_CHANNELS_OR_DIFFERENT_ACTION
                ) {
                    channelObject.setPresetLock(m.messageData.isLocked);
                } else {
                    channelObject.lockedControllers[
                        m.messageData.controllerNumber
                    ] = m.messageData.isLocked;
                }
                break;

            case "sequencerSpecific": {
                if (!this.sequencer) {
                    return;
                }
                const seq = this.sequencer;
                const seqMsg = m.messageData;
                switch (seqMsg.type) {
                    default:
                        break;

                    case "loadNewSongList":
                        try {
                            const sList = seqMsg.data.midis;
                            const songMap = sList.map((s) => {
                                if ("duration" in s) {
                                    // cloned objects don't have methods
                                    return BasicMIDI.copyFrom(s);
                                }
                                return BasicMIDI.fromArrayBuffer(
                                    s.binary,
                                    s.altName
                                );
                            });
                            seq.loadNewSongList(songMap, seqMsg.data.autoPlay);
                        } catch (e) {
                            console.error(e);
                            this.postMessageToMainThread({
                                messageType:
                                    returnMessageType.sequencerSpecific,
                                messageData: {
                                    messageType:
                                        sequencerReturnMessageType.midiError,
                                    messageData: e
                                }
                            });
                        }
                        break;

                    case sequencerMessageType.pause:
                        seq.pause();
                        break;

                    case sequencerMessageType.play:
                        seq.play(messageData);
                        break;

                    case sequencerMessageType.stop:
                        seq.stop();
                        break;

                    case sequencerMessageType.setTime:
                        seq.currentTime = messageData;
                        break;

                    case sequencerMessageType.changeMIDIMessageSending:
                        seq.sendMIDIMessages = messageData;
                        break;

                    case sequencerMessageType.setPlaybackRate:
                        seq.playbackRate = messageData;
                        break;

                    case sequencerMessageType.setLoop:
                        const [loop, count] = messageData;
                        seq.loop = loop;
                        if (count === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                            seq.loopCount = Infinity;
                        } else {
                            seq.loopCount = count;
                        }
                        break;

                    case sequencerMessageType.changeSong:
                        switch (messageData[0]) {
                            case songChangeType.forwards:
                                seq.nextSong();
                                break;

                            case songChangeType.backwards:
                                seq.previousSong();
                                break;

                            case songChangeType.shuffleOff:
                                seq.shuffleMode = false;
                                seq.songIndex =
                                    seq.shuffledSongIndexes[seq.songIndex];
                                break;

                            case songChangeType.shuffleOn:
                                seq.shuffleMode = true;
                                seq.shuffleSongIndexes();
                                seq.songIndex = 0;
                                seq.loadCurrentSong();
                                break;

                            case songChangeType.index:
                                seq.songIndex = messageData[1];
                                seq.loadCurrentSong();
                                break;
                        }
                        break;

                    case sequencerMessageType.getMIDI:
                        this.postMessageToMainThread({
                            messageType: returnMessageType.sequencerSpecific,
                            messageData: {
                                messageType: sequencerReturnMessageType.getMIDI,
                                messageData: seq.midiData
                            }
                        });
                        break;

                    case sequencerMessageType.setSkipToFirstNote:
                        seq.skipToFirstNoteOn = messageData;
                        break;

                    case sequencerMessageType.setPreservePlaybackState:
                        seq.preservePlaybackState = messageData;
                }
                break;
            }

            case workletMessageType.soundFontManager:
                try {
                    const sfManager = this.synthesizer.soundfontManager;
                    const type = data[0];
                    const messageData = data[1];
                    let font;
                    switch (type) {
                        case WorkletSoundfontManagerMessageType.addNewSoundFont:
                            font = loadSoundFont(messageData[0]);
                            sfManager.addNewSoundFont(
                                font,
                                messageData[1],
                                messageData[2]
                            );
                            this.postMessageToMainThread({
                                messageType:
                                    returnMessageType.isFullyInitialized,
                                messageData: undefined
                            });
                            break;

                        case WorkletSoundfontManagerMessageType.reloadSoundFont:
                            font = loadSoundFont(messageData);
                            sfManager.reloadManager(font);
                            this.postMessageToMainThread({
                                messageType:
                                    returnMessageType.isFullyInitialized,
                                messageData: undefined
                            });
                            break;

                        case WorkletSoundfontManagerMessageType.deleteSoundFont:
                            sfManager.deleteSoundFont(messageData);
                            break;

                        case WorkletSoundfontManagerMessageType.rearrangeSoundFonts:
                            sfManager.rearrangeSoundFonts(messageData);
                    }
                } catch (e) {
                    this.postMessageToMainThread({
                        messageType: returnMessageType.soundfontError,
                        messageData: e
                    });
                }
                break;

            case workletMessageType.keyModifierManager:
                /**
                 * @type {workletKeyModifierMessageType}
                 */
                const keyMessageType = data[0];
                const man = this.synthesizer.keyModifierManager;
                const keyMessageData = data[1];
                switch (keyMessageType) {
                    default:
                        return;

                    case workletKeyModifierMessageType.addMapping:
                        man.addMapping(...keyMessageData);
                        break;

                    case workletKeyModifierMessageType.clearMappings:
                        man.clearMappings();
                        break;

                    case workletKeyModifierMessageType.deleteMapping:
                        man.deleteMapping(...keyMessageData);
                }
                break;

            case workletMessageType.requestSynthesizerSnapshot:
                const snapshot = SynthesizerSnapshot.createSynthesizerSnapshot(
                    this.synthesizer
                );
                this.postMessageToMainThread({
                    messageType: returnMessageType.synthesizerSnapshot,
                    messageData: snapshot
                });
                break;

            case workletMessageType.setLogLevel:
                SpessaSynthLogging(data[0], data[1], data[2], data[3]);
                break;

            case workletMessageType.setEffectsGain:
                this.synthesizer.reverbGain = data[0];
                this.synthesizer.chorusGain = data[1];
                break;

            case workletMessageType.destroyWorklet:
                this.alive = false;
                this.synthesizer.destroySynthProcessor();
                delete this.synthesizer;
                delete this.sequencer.midiData;
                delete this.sequencer;
                break;

            default:
                util.SpessaSynthWarn("Unrecognized event:", data);
                break;
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * the audio worklet processing logic
     * @param inputs {Float32Array[][]} required by WebAudioAPI
     * @param outputs {Float32Array[][]} the outputs to write to, only the first two channels of each are populated
     * @returns {boolean} true unless it's not alive
     */
    process(inputs, outputs) {
        if (!this.alive) {
            return false;
        }
        // process sequencer
        this.sequencer.processTick();

        if (this.oneOutputMode) {
            const out = outputs[0];
            // 1 output with 32 channels.
            // channels are ordered as follows:
            // midiChannel1L, midiChannel1R,
            // midiChannel2L, midiChannel2R
            // and so on
            /**
             * @type {Float32Array[][]}
             */
            const channelMap = [];
            for (let i = 0; i < 32; i += 2) {
                channelMap.push([out[i], out[i + 1]]);
            }
            this.synthesizer.renderAudioSplit(
                [],
                [], // effects are disabled
                channelMap
            );
        } else {
            // 18 outputs, each a stereo one
            // 0: reverb
            // 1: chorus
            // 2: channel 1
            // 3: channel 2
            // and so on
            this.synthesizer.renderAudioSplit(
                outputs[0], // reverb
                outputs[1], // chorus
                outputs.slice(2)
            );
        }
        return true;
    }
}

// noinspection JSUnresolvedReference
registerProcessor(WORKLET_PROCESSOR_NAME, WorkletSpessaProcessor);
util.SpessaSynthInfo(
    "%cProcessor successfully registered!",
    consoleColors.recognized
);
