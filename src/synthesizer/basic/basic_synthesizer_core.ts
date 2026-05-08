import {
    BasicMIDI,
    MIDIChannel,
    SoundBankLoader,
    SpessaSynthLog,
    SpessaSynthProcessor,
    SpessaSynthSequencer,
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
import { ALL_CHANNELS_OR_DIFFERENT_ACTION } from "./synth_config.ts";

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
     * For syncing voice counts, implemented separately in the `process()` method.
     * @protected
     */
    protected readonly voiceCounts = new Array<number>(16).fill(0);
    /**
     * Indicates if the processor is alive.
     * @protected
     */
    protected alive = false;
    protected readonly eventsEnabled;

    protected constructor(
        sampleRate: number,
        options: Partial<SynthProcessorOptions>,
        postMessage: PostMessageSynthCore
    ) {
        this.synthesizer = new SpessaSynthProcessor(sampleRate, options);
        this.eventsEnabled = options.eventsEnabled ?? false;
        this.post = postMessage;

        // Prepare synthesizer connections
        this.synthesizer.onEventCall = (event) => {
            if (event.type === "newChannel") {
                const l = this.synthesizer.midiChannels.length;
                for (let i = this.voiceCounts.length; i < l; i++)
                    this.voiceCounts.push(0);
            }
            this.post({
                type: "eventCall",
                data: event,
                currentTime: this.synthesizer.currentTime
            });
        };
    }

    protected createNewSequencer() {
        const sequencer = new SpessaSynthSequencer(this.synthesizer);
        const sequencerID = this.sequencers.length;
        this.sequencers.push(sequencer);

        // Prepare sequencer connections
        sequencer.onEventCall = (e) => {
            if (!this.eventsEnabled) return; // Processor already respects enabling/disabling event system
            if (e.type === "songListChange") {
                const songs = e.data.newSongList;
                const midiDatas = songs.map((s) => {
                    return new MIDIData(s);
                });
                this.post({
                    type: "sequencerReturn",
                    data: {
                        type: e.type,
                        data: {
                            newSongList: midiDatas,
                            shuffledSongIndexes: sequencer.shuffledSongIndexes
                        },
                        id: sequencerID
                    },
                    currentTime: this.synthesizer.currentTime
                });
                return;
            }
            this.post({
                type: "sequencerReturn",
                data: { ...e, id: sequencerID },
                currentTime: this.synthesizer.currentTime
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
                currentTime: this.synthesizer.currentTime
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
            currentTime: this.synthesizer.currentTime
        });
    }

    protected destroy() {
        this.synthesizer.destroySynthProcessor();
        // @ts-expect-error JS Deletion
        // noinspection JSConstantReassignment
        delete this.synthesizer;
        // @ts-expect-error JS Deletion
        // noinspection JSConstantReassignment
        delete this.sequencers;
    }

    protected handleMessage(m: BasicSynthesizerMessage) {
        const channel = m.channelNumber;

        let channelObject: MIDIChannel | undefined;
        if (channel >= 0) {
            channelObject = this.synthesizer.midiChannels[channel];
            if (channelObject === undefined) {
                SpessaSynthLog.warn(
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
                    m.data.options
                );
                break;
            }

            case "ccReset": {
                this.synthesizer.resetAllControllers();
                break;
            }

            case "stopAll": {
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION)
                    this.synthesizer.stopAllChannels(m.data === 1);
                else channelObject?.stopAllNotes(m.data === 1);

                break;
            }

            case "addNewChannel": {
                this.synthesizer.createMIDIChannel();
                break;
            }

            case "setGlobalMasterParameter": {
                this.synthesizer.setMasterParameter(m.data.type, m.data.data);
                break;
            }

            case "setChannelMasterParameter": {
                channelObject?.setMasterParameter(m.data.type, m.data.data);
                break;
            }

            case "setDrums": {
                channelObject?.setDrums(m.data);
                break;
            }

            case "lockController": {
                channelObject?.lockController(
                    m.data.controllerNumber,
                    m.data.isLocked
                );
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
                                currentTime: this.synthesizer.currentTime
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
                            currentTime: this.synthesizer.currentTime
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
                        currentTime: this.synthesizer.currentTime
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
                const snapshot = this.synthesizer.getSnapshot();
                this.postReady("synthesizerSnapshot", snapshot);
                break;
            }

            case "requestNewSequencer": {
                this.createNewSequencer();
                break;
            }

            case "setLogLevel": {
                SpessaSynthLog.setLogLevel(
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
                SpessaSynthLog.warn("Unrecognized event!", m);
                break;
            }
        }
    }
}
