import {
    ALL_CHANNELS_OR_DIFFERENT_ACTION,
    BasicMIDI,
    SoundBankLoader,
    SpessaSynthCoreUtils as util,
    SpessaSynthLogging,
    SpessaSynthProcessor,
    SpessaSynthSequencer,
    SynthesizerSnapshot,
    type SynthProcessorOptions
} from "spessasynth_core";
import type {
    BasicSynthesizerMessage,
    BasicSynthesizerReturnMessage,
    SynthesizerProgress,
    SynthesizerReturn
} from "../types.ts";
import { MIDIData } from "../../sequencer/midi_data.ts";
import { songChangeType } from "../../sequencer/enums.ts";

export type PostMessageSynthCore = (
    data: BasicSynthesizerReturnMessage,
    transfer?: Transferable[]
) => unknown;

// Seconds
export const SEQUENCER_SYNC_INTERVAL = 1;

/**
 * The interface for the audio processing code that uses spessasynth_core and runs on a separate thread.
 */
export abstract class BasicSynthesizerCore {
    public readonly synthesizer: SpessaSynthProcessor;
    public readonly sequencers = new Array<SpessaSynthSequencer>();
    protected readonly post: PostMessageSynthCore;
    protected lastSequencerSync = 0;
    /**
     * Indicates if the processor is alive.
     * @protected
     */
    protected alive = false;

    protected constructor(
        sampleRate: number,
        options: Omit<
            SynthProcessorOptions,
            "reverbProcessor" | "chorusProcessor" | "delayProcessor"
        >,
        postMessage: PostMessageSynthCore
    ) {
        this.synthesizer = new SpessaSynthProcessor(sampleRate, options);
        this.post = postMessage;

        // Prepare synthesizer connections
        this.synthesizer.onEventCall = (event) => {
            this.post({
                type: "eventCall",
                data: event,
                currentTime: this.synthesizer.currentSynthTime
            });
        };
    }

    protected createNewSequencer() {
        const sequencer = new SpessaSynthSequencer(this.synthesizer);
        const sequencerID = this.sequencers.length;
        this.sequencers.push(sequencer);

        // Prepare sequencer connections
        sequencer.onEventCall = (e) => {
            if (e.type === "songListChange") {
                const songs = e.data.newSongList;
                const midiDatas = songs.map((s) => {
                    return new MIDIData(s);
                });
                this.post({
                    type: "sequencerReturn",
                    data: {
                        type: e.type,
                        data: { newSongList: midiDatas },
                        id: sequencerID
                    },
                    currentTime: this.synthesizer.currentSynthTime
                });
                return;
            }
            this.post({
                type: "sequencerReturn",
                data: { ...e, id: sequencerID },
                currentTime: this.synthesizer.currentSynthTime
            });
        };
    }

    protected postReady<K extends keyof SynthesizerReturn>(
        type: K,
        data: SynthesizerReturn[K],
        transferable: Transferable[] = []
    ) {
        this.post(
            {
                type: "isFullyInitialized",
                data: {
                    type,
                    data
                } as {
                    [K in keyof SynthesizerReturn]: {
                        type: K;
                        data: SynthesizerReturn[K];
                    };
                }[keyof SynthesizerReturn],
                currentTime: this.synthesizer.currentSynthTime
            },
            transferable
        );
    }

    protected postProgress<K extends keyof SynthesizerProgress>(
        type: K,
        data: SynthesizerProgress[K]
    ) {
        this.post({
            type: "renderingProgress",
            data: {
                type,
                data
            } as {
                [K in keyof SynthesizerProgress]: {
                    type: K;
                    data: SynthesizerProgress[K];
                };
            }[keyof SynthesizerProgress],
            currentTime: this.synthesizer.currentSynthTime
        });
    }

    protected destroy() {
        this.synthesizer.destroySynthProcessor();
        // @ts-expect-error JS Deletion
        // noinspection JSConstantReassignment
        delete this.synthesizer;
        // @ts-expect-error JS Deletion
        // noinspection JSConstantReassignment
        delete this.sequencer;
    }

    protected handleMessage(m: BasicSynthesizerMessage) {
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
            case "midiMessage": {
                this.synthesizer.processMessage(
                    m.data.messageData,
                    m.data.channelOffset,
                    m.data.force,
                    m.data.options
                );
                break;
            }

            case "customCcChange": {
                // Custom controller change
                channelObject?.setCustomController(
                    m.data.ccNumber,
                    m.data.ccValue
                );
                break;
            }

            case "ccReset": {
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                    this.synthesizer.resetAllControllers();
                } else {
                    channelObject?.resetControllers();
                }
                break;
            }

            case "setChannelVibrato": {
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
            }

            case "stopAll": {
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION) {
                    this.synthesizer.stopAllChannels(m.data === 1);
                } else {
                    channelObject?.stopAllNotes(m.data === 1);
                }
                break;
            }

            case "muteChannel": {
                channelObject?.muteChannel(m.data);
                break;
            }

            case "addNewChannel": {
                this.synthesizer.createMIDIChannel();
                break;
            }

            case "setMasterParameter": {
                this.synthesizer.setMasterParameter(m.data.type, m.data.data);
                break;
            }

            case "setDrums": {
                channelObject?.setDrums(m.data);
                break;
            }

            case "transposeChannel": {
                channelObject?.transposeChannel(m.data.semitones, m.data.force);
                break;
            }

            case "lockController": {
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
            }

            case "sequencerSpecific": {
                const seq = this.sequencers[m.data.id];
                if (!seq) {
                    return;
                }
                const seqMsg = m.data;
                switch (seqMsg.type) {
                    default: {
                        break;
                    }

                    case "loadNewSongList": {
                        try {
                            const sList = seqMsg.data;
                            const songMap = sList.map((s) => {
                                if ("duration" in s) {
                                    // Cloned objects don't have methods
                                    return BasicMIDI.copyFrom(s);
                                }
                                return BasicMIDI.fromArrayBuffer(
                                    s.binary,
                                    s.fileName
                                );
                            });
                            seq.loadNewSongList(songMap);
                        } catch (error) {
                            console.error(error);
                            this.post({
                                type: "sequencerReturn",
                                data: {
                                    type: "midiError",
                                    data: error as Error,
                                    id: m.data.id
                                },
                                currentTime: this.synthesizer.currentSynthTime
                            });
                        }
                        break;
                    }

                    case "pause": {
                        seq.pause();
                        break;
                    }

                    case "play": {
                        seq.play();
                        break;
                    }

                    case "setTime": {
                        seq.currentTime = seqMsg.data;
                        break;
                    }

                    case "changeMIDIMessageSending": {
                        seq.externalMIDIPlayback = seqMsg.data;
                        break;
                    }

                    case "setPlaybackRate": {
                        seq.playbackRate = seqMsg.data;
                        break;
                    }

                    case "setLoopCount": {
                        seq.loopCount = seqMsg.data;
                        break;
                    }

                    case "changeSong": {
                        switch (seqMsg.data.changeType) {
                            case songChangeType.shuffleOff: {
                                seq.shuffleMode = false;
                                break;
                            }

                            case songChangeType.shuffleOn: {
                                seq.shuffleMode = true;
                                break;
                            }

                            case songChangeType.index: {
                                if (seqMsg.data.data !== undefined) {
                                    seq.songIndex = seqMsg.data.data;
                                }
                                break;
                            }
                        }
                        break;
                    }

                    case "getMIDI": {
                        if (!seq.midiData) {
                            throw new Error("No MIDI is loaded!");
                        }
                        this.post({
                            type: "sequencerReturn",
                            data: {
                                type: "getMIDI",
                                data: seq.midiData,
                                id: m.data.id
                            },
                            currentTime: this.synthesizer.currentSynthTime
                        });
                        break;
                    }

                    case "setSkipToFirstNote": {
                        seq.skipToFirstNoteOn = seqMsg.data;
                        break;
                    }
                }
                break;
            }

            case "soundBankManager": {
                try {
                    const sfManager = this.synthesizer.soundBankManager;
                    const sfManMsg = m.data;
                    let font;
                    switch (sfManMsg.type) {
                        case "addSoundBank": {
                            font = SoundBankLoader.fromArrayBuffer(
                                sfManMsg.data.soundBankBuffer
                            );
                            sfManager.addSoundBank(
                                font,
                                sfManMsg.data.id,
                                sfManMsg.data.bankOffset
                            );
                            this.postReady("soundBankManager", null);
                            break;
                        }

                        case "deleteSoundBank": {
                            sfManager.deleteSoundBank(sfManMsg.data);
                            this.postReady("soundBankManager", null);
                            break;
                        }

                        case "rearrangeSoundBanks": {
                            sfManager.priorityOrder = sfManMsg.data;
                            this.postReady("soundBankManager", null);
                        }
                    }
                } catch (error) {
                    this.post({
                        type: "soundBankError",
                        data: error as Error,
                        currentTime: this.synthesizer.currentSynthTime
                    });
                }
                break;
            }

            case "keyModifierManager": {
                const kmMsg = m.data;
                const man = this.synthesizer.keyModifierManager;
                switch (kmMsg.type) {
                    default: {
                        return;
                    }

                    case "addMapping": {
                        man.addMapping(
                            kmMsg.data.channel,
                            kmMsg.data.midiNote,
                            kmMsg.data.mapping
                        );
                        break;
                    }

                    case "clearMappings": {
                        man.clearMappings();
                        break;
                    }

                    case "deleteMapping": {
                        man.deleteMapping(
                            kmMsg.data.channel,
                            kmMsg.data.midiNote
                        );
                    }
                }
                break;
            }

            case "requestSynthesizerSnapshot": {
                const snapshot = SynthesizerSnapshot.create(this.synthesizer);
                this.postReady("synthesizerSnapshot", snapshot);
                break;
            }

            case "requestNewSequencer": {
                this.createNewSequencer();
                break;
            }

            case "setLogLevel": {
                SpessaSynthLogging(
                    m.data.enableInfo,
                    m.data.enableWarning,
                    m.data.enableGroup
                );
                break;
            }

            case "destroyWorklet": {
                this.alive = false;
                this.synthesizer.destroySynthProcessor();
                this.destroy();
                break;
            }

            default: {
                util.SpessaSynthWarn("Unrecognized event!", m);
                break;
            }
        }
    }
}
