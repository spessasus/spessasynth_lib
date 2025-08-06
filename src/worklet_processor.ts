import { consoleColors } from "./utils/other.js";
import {
    ALL_CHANNELS_OR_DIFFERENT_ACTION,
    BasicMIDI,
    SoundBankLoader,
    SpessaSynthCoreUtils as util,
    SpessaSynthLogging,
    SpessaSynthProcessor,
    SpessaSynthSequencer,
    SynthesizerSnapshot
} from "spessasynth_core";
import { WORKLET_PROCESSOR_NAME } from "./synthesizer/worklet_url.js";
import { songChangeType } from "./sequencer/enums.js";
import { fillWithDefaults } from "./utils/fill_with_defaults.js";
import { DEFAULT_SEQUENCER_OPTIONS } from "./sequencer/default_sequencer_options.js";
import type {
    PassedProcessorParameters,
    StartRenderingDataConfig,
    WorkletMessage,
    WorkletReturnMessage
} from "./synthesizer/types";
import type {
    SequencerOptions,
    SequencerReturnMessage
} from "./sequencer/types";
import { MIDIData } from "./sequencer/midi_data.ts";

// A worklet processor wrapper for the synthesizer core
class WorkletSpessaProcessor extends AudioWorkletProcessor {
    /**
     * If the worklet is alive.
     */
    public alive = true;

    /**
     * Instead of 18 stereo outputs, there's one with 32 channels (no effects).
     */
    public oneOutputMode = false;

    public synthesizer: SpessaSynthProcessor;
    public sequencer: SpessaSynthSequencer | undefined;

    /**
     * Creates a new worklet synthesis system. contains all channels.
     */
    public constructor(options: {
        processorOptions: PassedProcessorParameters;
    }) {
        super();
        const opts = options.processorOptions;

        // One output is indicated by setting midiChannels to 1
        this.oneOutputMode = opts.midiChannels === 1;

        // Prepare synthesizer connections
        const postSyn = (m: WorkletReturnMessage) => {
            this.postMessageToMainThread(m);
        };

        /**
         * Initialize the synthesis engine.
         */
        this.synthesizer = new SpessaSynthProcessor(
            sampleRate, // AudioWorkletGlobalScope
            {
                effectsEnabled: !this.oneOutputMode, // One output mode disables effects
                enableEventSystem: opts?.enableEventSystem, // Enable message port?
                midiChannels: 16, // Midi channel count (16)
                initialTime: currentTime // AudioWorkletGlobalScope, sync with audioContext time
            }
        );
        this.synthesizer.onEventCall = (event) => {
            postSyn({
                type: "eventCall",
                data: event
            });
        };

        void this.synthesizer.processorInitialized.then(() => {
            // Initialize the sequencer engine
            this.sequencer = new SpessaSynthSequencer(this.synthesizer);

            const postSeq = (m: SequencerReturnMessage) => {
                this.postMessageToMainThread({
                    type: "sequencerReturn",
                    data: m
                });
            };

            this.sequencer.onEventCall = (e) => {
                if (e.type === "songListChange") {
                    const songs = e.data.newSongList;
                    const midiDatas = songs.map((s) => {
                        return new MIDIData(s);
                    });
                    postSeq({
                        type: e.type,
                        data: { newSongList: midiDatas }
                    });
                    return;
                }
                postSeq(e);
            };

            // Receive messages from the main thread
            this.port.onmessage = (e: MessageEvent<WorkletMessage>) =>
                this.handleMessage(e.data);
            this.postReady();
        });
    }

    public startRendering(config: StartRenderingDataConfig) {
        if (!this.sequencer) {
            return;
        }

        // Load the bank list
        config.soundBankList.forEach((b, i) => {
            try {
                this.synthesizer.soundBankManager.addSoundBank(
                    SoundBankLoader.fromArrayBuffer(b),
                    `bank-${i}`
                );
            } catch (e) {
                this.postMessageToMainThread({
                    type: "soundBankError",
                    data: e as Error
                });
            }
        });

        if (config.snapshot !== undefined) {
            this.synthesizer.applySynthesizerSnapshot(config.snapshot);
        }

        // If sent, start rendering
        util.SpessaSynthInfo(
            "%cRendering enabled! Starting render.",
            consoleColors.info
        );
        this.sequencer.loopCount = config.loopCount;
        // Set voice cap to unlimited
        this.synthesizer.setMasterParameter("voiceCap", Infinity);

        /**
         * Set options
         */
        const seqOptions: SequencerOptions = fillWithDefaults(
            config.sequencerOptions,
            DEFAULT_SEQUENCER_OPTIONS
        );
        this.sequencer.skipToFirstNoteOn = seqOptions.skipToFirstNoteOn;
        this.sequencer.playbackRate = seqOptions.initialPlaybackRate;
        // Autoplay is ignored
        try {
            // Cloned objects don't have methods
            this.sequencer.loadNewSongList([
                BasicMIDI.copyFrom(config.midiSequence)
            ]);
            this.sequencer.play();
        } catch (e) {
            console.error(e);
            this.postMessageToMainThread({
                type: "sequencerReturn",
                data: {
                    type: "midiError",
                    data: e as Error
                }
            });
        }
    }

    public postReady() {
        this.postMessageToMainThread({
            type: "isFullyInitialized",
            data: null
        });
    }

    public postMessageToMainThread(data: WorkletReturnMessage) {
        this.port.postMessage(data);
    }

    public handleMessage(m: WorkletMessage) {
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
        switch (m.type) {
            case "midiMessage":
                this.synthesizer.processMessage(
                    m.data.messageData,
                    m.data.channelOffset,
                    m.data.force,
                    m.data.options
                );
                break;

            case "customCcChange":
                // Custom controller change
                channelObject?.setCustomController(
                    m.data.ccNumber,
                    m.data.ccValue
                );
                break;

            case "ccReset":
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                    this.synthesizer.resetAllControllers();
                } else {
                    channelObject?.resetControllers();
                }
                break;

            case "setChannelVibrato":
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                    for (const chan of this.synthesizer.midiChannels) {
                        if (m.data.rate === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                            chan.disableAndLockGSNRPN();
                        } else {
                            chan.setVibrato(
                                m.data.depth,
                                m.data.rate,
                                m.data.delay
                            );
                        }
                    }
                } else if (m.data.rate === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                    channelObject?.disableAndLockGSNRPN();
                } else {
                    channelObject?.setVibrato(
                        m.data.depth,
                        m.data.rate,
                        m.data.delay
                    );
                }
                break;

            case "stopAll":
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                    this.synthesizer.stopAllChannels(m.data === 1);
                } else {
                    channelObject?.stopAllNotes(m.data === 1);
                }
                break;

            case "killNotes":
                this.synthesizer.killVoices(m.data);
                break;

            case "muteChannel":
                channelObject?.muteChannel(m.data);
                break;

            case "addNewChannel":
                this.synthesizer.createMIDIChannel();
                break;

            case "setMasterParameter":
                this.synthesizer.setMasterParameter(m.data.type, m.data.data);
                break;

            case "setDrums":
                channelObject?.setDrums(m.data);
                break;

            case "transposeChannel":
                channelObject?.transposeChannel(m.data.semitones, m.data.force);
                break;

            case "lockController":
                if (
                    m.data.controllerNumber === ALL_CHANNELS_OR_DIFFERENT_ACTION
                ) {
                    channelObject?.setPresetLock(m.data.isLocked);
                } else {
                    if (!channelObject) {
                        return;
                    }
                    channelObject.lockedControllers[m.data.controllerNumber] =
                        m.data.isLocked;
                }
                break;

            case "startOfflineRender":
                this.startRendering(m.data);
                break;

            case "sequencerSpecific": {
                if (!this.sequencer) {
                    return;
                }
                const seq = this.sequencer;
                const seqMsg = m.data;
                switch (seqMsg.type) {
                    default:
                        break;

                    case "loadNewSongList":
                        try {
                            const sList = seqMsg.data;
                            const songMap = sList.map((s) => {
                                if ("duration" in s) {
                                    // Cloned objects don't have methods
                                    return BasicMIDI.copyFrom(s);
                                }
                                return BasicMIDI.fromArrayBuffer(
                                    s.binary,
                                    s.altName
                                );
                            });
                            seq.loadNewSongList(songMap);
                        } catch (e) {
                            console.error(e);
                            this.postMessageToMainThread({
                                type: "sequencerReturn",
                                data: {
                                    type: "midiError",
                                    data: e as Error
                                }
                            });
                        }
                        break;

                    case "pause":
                        seq.pause();
                        break;

                    case "play":
                        seq.play();
                        break;

                    case "setTime":
                        seq.currentTime = seqMsg.data;
                        break;

                    case "changeMIDIMessageSending":
                        seq.externalMIDIPlayback = seqMsg.data;
                        break;

                    case "setPlaybackRate":
                        seq.playbackRate = seqMsg.data;
                        break;

                    case "setLoopCount":
                        seq.loopCount = seqMsg.data;
                        break;

                    case "changeSong":
                        switch (seqMsg.data.changeType) {
                            case songChangeType.shuffleOff:
                                seq.shuffleMode = false;
                                break;

                            case songChangeType.shuffleOn:
                                seq.shuffleMode = true;
                                break;

                            case songChangeType.index:
                                if (seqMsg.data.data)
                                    seq.songIndex = seqMsg.data.data;
                                break;
                        }
                        break;

                    case "getMIDI":
                        this.postMessageToMainThread({
                            type: "sequencerReturn",
                            data: {
                                type: "getMIDI",
                                data: seq.midiData
                            }
                        });
                        break;

                    case "setSkipToFirstNote":
                        seq.skipToFirstNoteOn = seqMsg.data;
                        break;
                }
                break;
            }

            case "soundBankManager":
                try {
                    const sfManager = this.synthesizer.soundBankManager;
                    const sfManMsg = m.data;
                    let font;
                    switch (sfManMsg.type) {
                        case "addSoundBank":
                            font = SoundBankLoader.fromArrayBuffer(
                                sfManMsg.data.soundBankBuffer
                            );
                            sfManager.addSoundBank(
                                font,
                                sfManMsg.data.id,
                                sfManMsg.data.bankOffset
                            );
                            this.postReady();
                            break;

                        case "deleteSoundBank":
                            sfManager.deleteSoundBank(sfManMsg.data);
                            this.postReady();
                            break;

                        case "rearrangeSoundBanks":
                            sfManager.priorityOrder = sfManMsg.data;
                            this.postReady();
                    }
                } catch (e) {
                    this.postMessageToMainThread({
                        type: "soundBankError",
                        data: e as Error
                    });
                }
                break;

            case "keyModifierManager": {
                const kmMsg = m.data;
                const man = this.synthesizer.keyModifierManager;
                switch (kmMsg.type) {
                    default:
                        return;

                    case "addMapping":
                        man.addMapping(
                            kmMsg.data.channel,
                            kmMsg.data.midiNote,
                            kmMsg.data.mapping
                        );
                        break;

                    case "clearMappings":
                        man.clearMappings();
                        break;

                    case "deleteMapping":
                        man.deleteMapping(
                            kmMsg.data.channel,
                            kmMsg.data.midiNote
                        );
                }
                break;
            }

            case "requestSynthesizerSnapshot": {
                const snapshot = SynthesizerSnapshot.create(this.synthesizer);
                this.postMessageToMainThread({
                    type: "synthesizerSnapshot",
                    data: snapshot
                });
                break;
            }

            case "setLogLevel":
                SpessaSynthLogging(
                    m.data.enableInfo,
                    m.data.enableWarning,
                    m.data.enableGroup
                );
                break;

            case "destroyWorklet":
                this.alive = false;
                this.synthesizer.destroySynthProcessor();
                delete this.sequencer;
                break;

            default:
                util.SpessaSynthWarn("Unrecognized event!", m);
                break;
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The audio worklet processing logic
     * @param _inputs required by WebAudioAPI
     * @param outputs the outputs to write to, only the first two channels of each are populated
     * @returns {boolean} true unless it's not alive
     */
    public process(
        _inputs: Float32Array[][],
        outputs: Float32Array[][]
    ): boolean {
        if (!this.alive || !this.sequencer) {
            return false;
        }
        // Process sequencer
        this.sequencer.processTick();

        if (this.oneOutputMode) {
            const out = outputs[0];
            // 1 output with 32 channels.
            // Channels are ordered as follows:
            // MidiChannel1L, midiChannel1R,
            // MidiChannel2L, midiChannel2R
            // And so on
            const channelMap: Float32Array[][] = [];
            for (let i = 0; i < 32; i += 2) {
                channelMap.push([out[i], out[i + 1]]);
            }
            this.synthesizer.renderAudioSplit(
                [],
                [], // Effects are disabled
                channelMap
            );
        } else {
            // 18 outputs, each a stereo one
            // 0: reverb
            // 1: chorus
            // 2: channel 1
            // 3: channel 2
            // And so on
            this.synthesizer.renderAudioSplit(
                outputs[0], // Reverb
                outputs[1], // Chorus
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
