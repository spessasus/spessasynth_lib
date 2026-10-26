import {
    BasicMIDI,
    MIDIChannel,
    SoundBankLoader,
    SpessaLog,
    SpessaSynthProcessor,
    SpessaSynthSequencer,
    type SynthesizerEvent
} from "spessasynth_core";
import { MIDIData } from "../../sequencer/midi_data";
import type {
    BasicSynthesizerMessage,
    BasicSynthesizerReturnMessage,
    SynthesizerProgress,
    SynthesizerReturn
} from "../types";
import { ReverbCapture } from "./reverb_passthrough";
import { ALL_CHANNELS_OR_DIFFERENT_ACTION } from "./synth_config";
import type { SynthCoreConfig } from "./types";

export type PostMessageSynthCore = (
    data: BasicSynthesizerReturnMessage[],
    transfer?: Transferable[]
) => unknown;

// Seconds
const SEQUENCER_SYNC_INTERVAL = 1;

/**
 * The events that the main thread needs to mirror the synthesizer state.
 * They are sent even if the event system is disabled.
 */
const STATE_SYNC_EVENTS = new Set<keyof SynthesizerEvent>([
    "channelAdded",
    "presetListChange",
    "programChange",
    "globalParamChange",
    "channelParamChange",
    "reset"
]);

/**
 * The interface for the audio processing code that uses `spessasynth_core` and runs on a separate thread.
 * It runs in a Web Worker for {@link WorkerSynthesizer} and in an AudioWorklet for {@link WorkletSynthesizer}.
 *
 * It provides raw access to `spessasynth_core` {@link SpessaSynthProcessor} and {@link SpessaSynthSequencer} instances.
 * @group Synthesizer.Basic
 */
export abstract class BasicSynthesizerCore {
    /**
     * The synthesizer instance.
     * This property allows for direct access to the audio engine.
     */
    public readonly synthesizer: SpessaSynthProcessor;
    /**
     * The array of sequencers to use with the synthesizer.
     * This property allows for direct access to the sequencers and their MIDI data.
     */
    public readonly sequencers = new Array<SpessaSynthSequencer>();

    protected readonly postInternal: PostMessageSynthCore;

    /**
     * For syncing voice counts, implemented separately in the `process()` method.
     * @internal
     */
    protected readonly voiceCounts = new Array<number>(16).fill(0);

    /**
     * If the events not needed for the state sync should be sent to the main thread.
     * The processor's own event system always stays enabled.
     * @internal
     */
    protected eventsEnabled;

    /**
     * In this mode, the reverb is captured and sent to the main thread for a `ConvolverNode` to process.
     * @internal
     */
    protected readonly convolverMode;

    protected readonly reverbCapture: ReverbCapture | undefined;
    /**
     * Set once the core is destroyed. Messages are ignored from then on.
     * @internal
     */
    protected destroyed = false;
    protected lastSequencerSync = 0;
    /**
     * A message queue for sending many messages in bulk as one.
     * @internal
     */
    protected messageQueue = new Array<BasicSynthesizerReturnMessage>();
    /**
     * The transferable part of the queue.
     * @internal
     */
    protected messageQueueTransferable = new Array<Transferable>();
    /**
     * If the queue is active, all messages will be queued. If not, they will be sent immediately.
     * @internal
     */
    protected messageQueueActive = false;

    protected constructor(
        synthCoreConfig: SynthCoreConfig,
        postMessage: PostMessageSynthCore
    ) {
        this.reverbCapture = synthCoreConfig.convolverMode
            ? new ReverbCapture(synthCoreConfig.sampleRate)
            : undefined;
        this.synthesizer = new SpessaSynthProcessor(
            synthCoreConfig.sampleRate,
            {
                ...synthCoreConfig.processorConfig,
                // The main thread mirrors the synthesizer state from the events, so they are filtered here instead
                eventsEnabled: true,
                initialTime: synthCoreConfig.initialTime,
                gsReverbProcessor: this.reverbCapture?.gsReverb,
                xgReverbBlock: this.reverbCapture?.xgReverb
            }
        );
        this.eventsEnabled =
            synthCoreConfig.processorConfig.eventsEnabled ?? true;
        this.convolverMode = synthCoreConfig.convolverMode;
        this.postInternal = postMessage;

        // Prepare synthesizer connections
        this.synthesizer.onEventCall = (event) => {
            if (event.type === "channelAdded") {
                const l = this.synthesizer.midiChannels.length;
                for (let i = this.voiceCounts.length; i < l; i++)
                    this.voiceCounts.push(0);
            }
            if (!this.eventsEnabled && !STATE_SYNC_EVENTS.has(event.type))
                return;
            this.post({
                type: "eventCall",
                data: event,
                currentTime: this.synthesizer.currentTime
            });
        };
    }

    /**
     * Starts processing an audio block: queues the messages and advances the sequencers.
     * Call before rendering the block.
     */
    protected startBlock() {
        this.messageQueueActive = true;
        for (const seq of this.sequencers) seq.processTick();
    }

    /**
     * Finishes processing an audio block: syncs the sequencers and voice counts, then sends the queued messages.
     * Call after rendering the block.
     */
    protected finishBlock() {
        const t = this.synthesizer.currentTime;
        if (t - this.lastSequencerSync > SEQUENCER_SYNC_INTERVAL) {
            for (let id = 0; id < this.sequencers.length; id++) {
                this.post({
                    type: "sequencerReturn",
                    data: {
                        type: "sync",
                        data: this.sequencers[id].currentTime,
                        id
                    },
                    currentTime: t
                });
            }
            this.lastSequencerSync = t;
        }

        // Update voice count
        const c = this.synthesizer.midiChannels;
        const cv = this.voiceCounts;
        let updateChannels = false;
        for (let i = 0; i < c.length; i++) {
            updateChannels ||= c[i].voiceCount !== cv[i];
            cv[i] = c[i].voiceCount;
        }
        if (updateChannels)
            this.post({
                type: "voiceCountChange",
                currentTime: t,
                data: cv
            });

        // Flush the queue
        this.messageQueueActive = false;
        if (this.messageQueue.length > 0)
            this.postInternal(this.messageQueue, this.messageQueueTransferable);
        this.messageQueue.length = 0;
        this.messageQueueTransferable.length = 0;
    }

    protected post(
        data: BasicSynthesizerReturnMessage,
        transfer?: Transferable[]
    ) {
        if (this.messageQueueActive) {
            this.messageQueue.push(data);
            if (transfer) this.messageQueueTransferable.push(...transfer);
        } else {
            this.postInternal([data], transfer);
        }
    }

    protected createNewSequencer() {
        const sequencer = new SpessaSynthSequencer(this.synthesizer);
        const sequencerID = this.sequencers.length;
        this.sequencers.push(sequencer);

        // Prepare sequencer connections
        // Always sent, the main thread sequencer relies on these to track its state
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

    /**
     * Rejects the main thread promise waiting for the given response type.
     * @param type The response type that will not arrive.
     * @param error The reason of the failure.
     */
    protected postError(type: keyof SynthesizerReturn, error: Error) {
        this.post({
            type: "coreResponseError",
            data: {
                type,
                error
            },
            currentTime: this.synthesizer.currentTime
        });
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
            },
            currentTime: this.synthesizer.currentTime
        });
    }

    protected destroy() {
        this.destroyed = true;
        this.synthesizer.destroy();
        this.sequencers.length = 0;
    }

    protected handleMessage(m: BasicSynthesizerMessage) {
        if (this.destroyed) return;
        const channel = m.channelNumber;

        let channelObject: MIDIChannel | undefined;
        if (channel >= 0) {
            channelObject = this.synthesizer.midiChannels[channel];
            if (channelObject === undefined) {
                SpessaLog.warn(
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
                this.synthesizer.reset();
                break;
            }

            case "stopAll": {
                if (channel === ALL_CHANNELS_OR_DIFFERENT_ACTION)
                    this.synthesizer.stopAll(m.data === 1);
                else channelObject?.stopAllNotes(m.data === 1);

                break;
            }

            case "addNewChannel": {
                this.synthesizer.createMIDIChannel();
                break;
            }

            case "lockGlobalMIDIParameter": {
                this.synthesizer.lockMIDIParameter(
                    m.data.parameter,
                    m.data.isLocked
                );
                break;
            }

            case "setGlobalSystemParameter": {
                if (m.data.parameter === "eventsEnabled") {
                    // Filtered here, the processor must keep emitting the state sync events
                    this.eventsEnabled = m.data.value;
                    break;
                }
                this.synthesizer.setSystemParameter(
                    m.data.parameter,
                    m.data.value
                );
                break;
            }

            case "lockChannelMIDIParameter": {
                channelObject?.lockMIDIParameter(
                    m.data.parameter,
                    m.data.isLocked
                );
                break;
            }

            case "setChannelSystemParameter": {
                channelObject?.setSystemParameter(
                    m.data.parameter,
                    m.data.value
                );
                break;
            }

            case "setDrums": {
                channelObject?.setDrums(m.data);
                break;
            }

            case "lockController": {
                channelObject?.lockController(
                    m.data.controller,
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
                            SpessaLog.warn(error);
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
                            case "shuffleOff": {
                                seq.shuffleMode = false;
                                break;
                            }

                            case "shuffleOn": {
                                seq.shuffleMode = true;
                                break;
                            }

                            case "index": {
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
                            this.post({
                                type: "sequencerReturn",
                                data: {
                                    type: "getMIDIError",
                                    data: new Error("No MIDI is loaded!"),
                                    id: m.data.id
                                },
                                currentTime: this.synthesizer.currentTime
                            });
                            break;
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
                    this.postError("soundBankManager", error as Error);
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
                SpessaLog.setLogLevel(
                    m.data.enableInfo,
                    m.data.enableWarning,
                    m.data.enableGroup
                );
                break;
            }

            case "destroyWorklet": {
                this.destroy();
                break;
            }

            default: {
                SpessaLog.warn("Unrecognized event!", m);
                break;
            }
        }
    }
}
