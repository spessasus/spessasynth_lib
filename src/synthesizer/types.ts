import {
    type BasicMIDI,
    type ChannelMIDIParameter,
    type ChannelSystemParameter,
    type GlobalMIDIParameter,
    type GlobalSystemParameter,
    type MIDIController,
    type RMIDIWriteOptions,
    type SoundBankWriteOptions,
    type SoundFont2WriteOptions,
    type SynthesizerEvent as CoreSynthesizerEvent,
    type SynthesizerSnapshot,
    type SynthMethodOptions
} from "spessasynth_core";
import type {
    SequencerMessage,
    SequencerOptions,
    SequencerReturnMessage
} from "../sequencer/types";
import type {
    RenderedAudioWorkerChunks,
    WorkerRenderAudioOptions
} from "./worker/render_audio_worker";
import type { SynthCoreConfig } from "./basic/types";

export * from "./basic/types";

/**
 * An extension of `spessasynth_core`s {@link SynthesizerSnapshot}.
 *
 * @group Synthesizer.Basic
 */
export interface LibSynthesizerSnapshot extends SynthesizerSnapshot {
    /**
     * Optional convolver impulse response stored on the main thread.
     */
    convolverImpulseResponse?: AudioBuffer;
}

/**
 * Options for rendering the audio using {@link WorkletSynthesizer}
 *
 * @group Synthesizer.Worklet
 */
export interface OfflineRenderWorkletData<T extends SynthesizerSnapshot> {
    /**
     * The MIDI sequence to render.
     */
    midiSequence: BasicMIDI;
    /**
     * Optional, the snapshot to apply before starting the render.
     *
     * > **Warning**
     * >
     * > {@link GlobalSystemParameter}s and {@link ChannelSystemParameter}s will be replaced with the snapshot's ones.
     */
    snapshot?: T;
    /**
     * The amount times to loop the song.
     */
    loopCount: number;

    /**
     * The list of sound banks to render this file with.
     */
    soundBankList: {
        /**
         * The bank MSB offset for this sound bank.
         */
        bankOffset: number;
        /**
         * The binary representation of the sound bank file.
         */
        soundBankBuffer: ArrayBuffer;
    }[];

    /**
     * The options to pass to the playback sequencer.
     */
    sequencerOptions?: Partial<SequencerOptions>;
}

export interface WorkletSBKManagerData {
    addSoundBank: {
        soundBankBuffer: ArrayBuffer;
        id: string;
        bankOffset: number;
    };
    // ID<string>
    deleteSoundBank: string;
    // NewOrder<string[]> // where string is the id
    rearrangeSoundBanks: string[];
}

export type BasicSynthesizerMessage = {
    [K in keyof BasicSynthesizerMessageData]: {
        channelNumber: number;
        type: K;
        data: BasicSynthesizerMessageData[K];
    };
}[keyof BasicSynthesizerMessageData];

/**
 * Configuration for writing a sound bank in a {@link WorkerSynthesizer}.
 *
 * @group Synthesizer.Worker
 */
export interface WorkerBankWriteOptions {
    /**
     * Trim the sound bank to only include samples used in the current MIDI file.
     */
    trim: boolean;

    /**
     * Which sequencer to grab the MIDI from if trimming. Defaults to the first one (0).
     */
    sequencerID: number;

    /**
     * The sound bank ID in the sound bank manager to write.
     */
    bankID: string;

    /**
     * If the embedded sound bank should be written instead if it exists.
     */
    writeEmbeddedSoundBank: boolean;
}

/**
 * Configuration for writing the DLS file.
 *
 * @group Synthesizer.Worker
 */
export type WorkerDLSWriteOptions = Omit<
    SoundBankWriteOptions,
    "progressFunction"
> &
    WorkerBankWriteOptions;

/**
 * Configuration for writing the SF2 file.
 *
 * @group Synthesizer.Worker
 */
export type WorkerSoundFont2WriteOptions = Omit<
    SoundFont2WriteOptions,
    "progressFunction"
> &
    WorkerBankWriteOptions & {
        /**
         * If the samples should be changed. The values are:
         * - `keep` - keep samples as-is.
         * - `compress` - compress the samples with your compression function provided to the {@link WorkerSynthesizerCore} and change SF2 to SF3.
         * - `decompress` - decompress the compressed samples and change SF3 to SF2.
         */
        compressionAction: "keep" | "compress" | "decompress";

        /**
         * The compression quality to call your provided compressionFunction with, if compressing.
         */
        compressionQuality: number;
    };

/**
 * A function which compresses samples into Ogg Vorbis for SF3 writing in the {@link WorkerSynthesizer}.
 * @param audioData The PCM audio data.
 * @param sampleRate The sample rate, in Hertz.
 * @param quality The quality of the encoding.
 * This parameter will have the value passed from {@link WorkerSynthesizer.writeSF2} so it can be ignored if that is not needed.
 * @returns The binary compressed audio data.
 *
 * @group Synthesizer.Worker
 */
export type WorkerSampleEncodingFunction = (
    audioData: Float32Array,
    sampleRate: number,
    quality: number
) => Promise<Uint8Array>;

/**
 * Configuration for writing the RMIDI file.
 *
 * @group Synthesizer.Worker
 */
export type WorkerRMIDIWriteOptions = Omit<RMIDIWriteOptions, "soundBank"> & {
    /**
     * If a snapshot of the current synthesizer instance should be applied to the MIDI file.
     */
    applySnapshot: boolean;
} & (
        | ({
              /**
               * Format to save the sound bank in.
               */
              format: "sf2";
          } & WorkerSoundFont2WriteOptions)
        | ({
              /**
               * Format to save the sound bank in.
               */
              format: "dls";
          } & WorkerDLSWriteOptions)
    );

interface BasicSynthesizerMessageData {
    // WORKER SPECIFIC
    workerInitialization: SynthCoreConfig;
    renderAudio: {
        sampleRate: number;
        options: WorkerRenderAudioOptions;
    };
    writeSF2: WorkerSoundFont2WriteOptions;
    writeDLS: WorkerDLSWriteOptions;
    writeRMIDI: WorkerRMIDIWriteOptions;

    // WORKLET SPECIFIC
    startOfflineRender: OfflineRenderWorkletData<SynthesizerSnapshot>;

    // SHARED
    midiMessage: {
        messageData: Uint8Array;
        channelOffset: number;
        options: SynthMethodOptions;
    };
    ccReset: null;
    // Force: (0 false, 1 true) note: if channel is -1 then stop all channels
    stopAll: number;
    // Is muted?
    addNewChannel: null;
    // Is drums?
    setDrums: boolean;
    lockController: {
        controller: MIDIController;
        isLocked: boolean;
    };
    sequencerSpecific: SequencerMessage;
    requestSynthesizerSnapshot: null;
    requestNewSequencer: null;
    setLogLevel: {
        enableInfo: boolean;
        enableWarning: boolean;
        enableGroup: boolean;
    };

    lockChannelMIDIParameter: {
        [K in keyof ChannelMIDIParameter]: {
            parameter: K;
            isLocked: boolean;
        };
    }[keyof ChannelMIDIParameter];
    setChannelSystemParameter: {
        [K in keyof ChannelSystemParameter]: {
            parameter: K;
            value: ChannelSystemParameter[K];
        };
    }[keyof ChannelSystemParameter];
    lockGlobalMIDIParameter: {
        [K in keyof GlobalMIDIParameter]: {
            parameter: K;
            isLocked: boolean;
        };
    }[keyof GlobalMIDIParameter];
    setGlobalSystemParameter: {
        [K in keyof GlobalSystemParameter]: {
            parameter: K;
            value: GlobalSystemParameter[K];
        };
    }[keyof GlobalSystemParameter];
    soundBankManager: {
        [K in keyof WorkletSBKManagerData]: {
            type: K;
            data: WorkletSBKManagerData[K];
        };
    }[keyof WorkletSBKManagerData];
    destroyWorklet: null;
}

/**
 * All event types which get emitted by {@link BasicSynthesizer}.
 *
 * They can be listened for in {@link SynthEventHandler}.
 * @group Synthesizer.Events
 */
export interface LibSynthesizerEvent extends CoreSynthesizerEvent {
    /**
     * This event is triggered when the loaded sound bank was invalid.
     *
     * The data is the error message from the parser, a JavaScript `Error` object.
     */
    soundBankError: Error;
}
export type LibSynthesizerEventCallback = {
    [K in keyof LibSynthesizerEvent]: {
        type: K;
        data: LibSynthesizerEvent[K];
    };
}[keyof LibSynthesizerEvent];

interface BasicSynthesizerReturnMessageData {
    eventCall: LibSynthesizerEventCallback;
    sequencerReturn: SequencerReturnMessage;
    isFullyInitialized: {
        [K in keyof SynthesizerReturn]: {
            type: K;
            data: SynthesizerReturn[K];
        };
    }[keyof SynthesizerReturn];
    // An error message related to the sound bank. It contains a string description of the error.
    soundBankError: Error;
    voiceCountChange: number[];
    renderingProgress: {
        [K in keyof SynthesizerProgress]: {
            type: K;
            data: SynthesizerProgress[K];
        };
    }[keyof SynthesizerProgress];
}

export type BasicSynthesizerReturnMessage = {
    [K in keyof BasicSynthesizerReturnMessageData]: {
        type: K;
        data: BasicSynthesizerReturnMessageData[K];
        currentTime: number;
    };
}[keyof BasicSynthesizerReturnMessageData];

export interface SynthesizerProgress {
    renderAudio: number;
    /**
     * Progress amount (0-1)
     */
    workerSynthWriteFile: number;
}

export interface SynthesizerReturn {
    sf3Decoder: null;
    soundBankManager: null;
    startOfflineRender: null;
    synthesizerSnapshot: SynthesizerSnapshot;
    renderAudio: RenderedAudioWorkerChunks;
    workerSynthWriteFile: {
        /**
         * The binary data of the file.
         */
        binary: ArrayBuffer;
        /**
         * The suggested name of the file.
         */
        fileName: string;
    };
}
