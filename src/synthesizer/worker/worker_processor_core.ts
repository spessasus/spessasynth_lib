// The core audio engine for the worker synthesizer.
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
import type {
    BasicSynthesizerMessage,
    BasicSynthesizerReturnMessage,
    SynthesizerReturn
} from "../types.ts";
import { songChangeType } from "../../sequencer/enums.ts";
import type { SequencerReturnMessage } from "../../sequencer/types.ts";
import { MIDIData } from "../../sequencer/midi_data.ts";
import { renderAudioWorker } from "./render_audio_worker.ts";

const BLOCK_SIZE = 128;

type AudioChunk = [Float32Array, Float32Array];
type AudioChunks = AudioChunk[];

export class WorkerSynthesizerCore {
    public readonly synthesizer: SpessaSynthProcessor;
    public readonly sequencer: SpessaSynthSequencer;
    protected postMessageToMainThread: (
        data: BasicSynthesizerReturnMessage,
        transfer?: Transferable[]
    ) => unknown;
    /**
     * The message port to the playback audio worklet.
     */
    protected workletMessagePort: MessagePort;
    protected isRendering = false;

    public constructor(
        synthesizerConfiguration: {
            sampleRate: number;
            initialTime: number;
        },
        workletMessagePort: MessagePort,
        mainThreadCallback: typeof Worker.prototype.postMessage
    ) {
        mainThreadCallback("hai", []);
        this.postMessageToMainThread =
            mainThreadCallback as typeof this.postMessageToMainThread;
        this.workletMessagePort = workletMessagePort;
        this.workletMessagePort.onmessage = this.renderAndSendChunk.bind(this);

        this.synthesizer = new SpessaSynthProcessor(
            synthesizerConfiguration.sampleRate,
            {
                initialTime: synthesizerConfiguration.initialTime
            }
        );
        this.sequencer = new SpessaSynthSequencer(this.synthesizer);

        this.synthesizer.onEventCall = (event) => {
            this.postMessageToMainThread({
                type: "eventCall",
                data: event
            });
        };
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
        void this.synthesizer.processorInitialized.then(() => {
            this.postReady("sf3Decoder", null);
            this.startAudioLoop();
        });
    }

    /**
     * Handles a message received from the main thread.
     * @param m The message received.
     */
    public handleMessage(m: BasicSynthesizerMessage) {
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
            case "renderAudio":
                const rendered = renderAudioWorker.call(
                    this,
                    m.data.sampleRate,
                    m.data.options
                );
                const transferable: Transferable[] = [];
                rendered.reverb.forEach((r) => transferable.push(r.buffer));
                rendered.chorus.forEach((c) => transferable.push(c.buffer));
                rendered.dry.forEach((d) =>
                    transferable.push(...d.map((c) => c.buffer))
                );
                this.postReady("renderAudio", rendered, transferable);
                break;

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
                this.killWorklet();
                throw new Error(
                    "StartOfflineRender is not supported in the WorkerSynthesizer."
                );

            case "sequencerSpecific": {
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
                            this.postReady("soundBankManager", null);
                            break;

                        case "deleteSoundBank":
                            sfManager.deleteSoundBank(sfManMsg.data);
                            this.postReady("soundBankManager", null);
                            break;

                        case "rearrangeSoundBanks":
                            sfManager.priorityOrder = sfManMsg.data;
                            this.postReady("soundBankManager", null);
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
                this.postReady("synthesizerSnapshot", snapshot);
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
                this.synthesizer.destroySynthProcessor();
                this.killWorklet();
                break;

            default:
                util.SpessaSynthWarn("Unrecognized event!", m);
                break;
        }
    }

    protected stopAudioLoop() {
        this.synthesizer.stopAllChannels(true);
        this.sequencer.pause();
        this.isRendering = false;
    }

    protected startAudioLoop() {
        this.isRendering = true;
        this.renderAndSendChunk();
    }

    protected killWorklet() {
        // Null indicates end of life
        this.workletMessagePort.postMessage(null);
        this.stopAudioLoop();
    }

    protected renderAndSendChunk() {
        if (!this.isRendering) {
            return;
        }
        // Data is encoded into a single f32 array as follows
        // RevL, revR
        // ChrL, chrR,
        // Dry1L, dry1R
        // DryNL, dryNR
        // Dry16L, dry16R
        // To improve performance
        const byteStep = BLOCK_SIZE * Float32Array.BYTES_PER_ELEMENT;
        const data = new Float32Array(BLOCK_SIZE * 36);
        let byteOffset = 0;
        const revR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        byteOffset += byteStep;
        const revL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        const rev = [revL, revR];
        byteOffset += byteStep;
        const chrL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        byteOffset += byteStep;
        const chrR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
        const chr = [chrL, chrR];
        const dry: AudioChunks = [];
        for (let i = 0; i < 16; i++) {
            byteOffset += byteStep;
            const dryL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
            byteOffset += byteStep;
            const dryR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
            dry.push([dryL, dryR]);
        }
        this.sequencer.processTick();
        this.synthesizer.renderAudioSplit(rev, chr, dry);
        this.workletMessagePort.postMessage(data, [data.buffer]);
    }

    protected postReady<K extends keyof SynthesizerReturn>(
        type: K,
        data: SynthesizerReturn[K],
        transferable: Transferable[] = []
    ) {
        this.postMessageToMainThread(
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
                }[keyof SynthesizerReturn]
            },
            transferable
        );
    }
}
