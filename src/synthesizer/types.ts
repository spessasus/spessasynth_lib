import type {
    BasicMIDI,
    CustomController,
    DLSWriteOptions,
    KeyModifier,
    MasterParameterType,
    MIDIController,
    SoundFont2WriteOptions,
    SynthesizerSnapshot,
    SynthMethodOptions,
    SynthProcessorEvent
} from "spessasynth_core";
import type {
    SequencerMessage,
    SequencerOptions,
    SequencerReturnMessage
} from "../sequencer/types";
import type { WorkerRenderAudioOptions } from "./worker/render_audio_worker.ts";

export interface PassedProcessorParameters {
    /**
     * If the synthesizer should send events.
     */
    enableEventSystem: boolean;
    /**
     * If the synth should use one output with 32 channels (2 audio channels for each midi channel).
     */
    oneOutput: boolean;
}

export interface OfflineRenderWorkletData {
    /**
     * The MIDI to render.
     */
    midiSequence: BasicMIDI;
    /**
     * The snapshot to apply.
     */
    snapshot?: SynthesizerSnapshot;
    /**
     * The amount times to loop the song.
     */
    loopCount: number;

    /**
     * The list of sound banks to render this file with.
     */
    soundBankList: {
        bankOffset: number;
        soundBankBuffer: ArrayBuffer;
    }[];

    /**
     * The options to pass to the sequencer.
     */
    sequencerOptions: Partial<SequencerOptions>;
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

export interface WorkletKMManagerData {
    addMapping: {
        channel: number;
        midiNote: number;
        mapping: KeyModifier;
    };
    deleteMapping: {
        channel: number;
        midiNote: number;
    };
    clearMappings: null;
}

export type BasicSynthesizerMessage = {
    [K in keyof BasicSynthesizerMessageData]: {
        channelNumber: number;
        type: K;
        data: BasicSynthesizerMessageData[K];
    };
}[keyof BasicSynthesizerMessageData];

export interface WorkerBankWriteOptions {
    /**
     * Trim the sound bank to only include samples used in the current MIDI file.
     */
    trim: boolean;

    /**
     * The sound bank ID to write.
     */
    bankID: string;

    /**
     * If the embedded sound bank should be written instead if it exists.
     */
    writeEmbeddedSoundBank: boolean;
}

export type WorkerDLSWriteOptions = Omit<DLSWriteOptions, "progressFunction"> &
    WorkerBankWriteOptions;

export type WorkerSoundFont2WriteOptions = Omit<
    SoundFont2WriteOptions,
    "compressionFunction" | "progressFunction"
> &
    WorkerBankWriteOptions;

interface BasicSynthesizerMessageData {
    // WORKER SPECIFIC
    workerInitialization: {
        sampleRate: number;
        currentTime: number;
    };
    renderAudio: {
        sampleRate: number;
        options: WorkerRenderAudioOptions;
    };
    writeSF2: WorkerSoundFont2WriteOptions;
    writeDLS: WorkerDLSWriteOptions;

    // WORKLET SPECIFIC
    startOfflineRender: OfflineRenderWorkletData;

    // SHARED
    midiMessage: {
        messageData: Uint8Array;
        channelOffset: number;
        force: boolean;
        options: SynthMethodOptions;
    };
    // Note: if channel is -1 then reset all channels
    ccReset: null;
    // Note: if channel is -1 then stop all channels note 2: if rate is -1, it means locking
    setChannelVibrato: {
        rate: number;
        depth: number;
        delay: number;
    };
    // Force: (0 false, 1 true) note: if channel is -1 then stop all channels
    stopAll: number;
    // Amount
    killNotes: number;
    // Is muted?
    muteChannel: boolean;
    addNewChannel: null;
    customCcChange: {
        ccNumber: CustomController;
        ccValue: number;
    };
    // Semitones
    transposeChannel: {
        semitones: number;
        force: boolean;
    };
    // Is drums?
    setDrums: boolean;
    // Note: if cc num is -1, then preset is locked
    lockController: {
        controllerNumber: MIDIController | -1;
        isLocked: boolean;
    };
    sequencerSpecific: SequencerMessage;
    requestSynthesizerSnapshot: null;
    setLogLevel: {
        enableInfo: boolean;
        enableWarning: boolean;
        enableGroup: boolean;
    };

    setMasterParameter: {
        [K in keyof MasterParameterType]: {
            type: K;
            data: MasterParameterType[K];
        };
    }[keyof MasterParameterType];
    soundBankManager: {
        [K in keyof WorkletSBKManagerData]: {
            type: K;
            data: WorkletSBKManagerData[K];
        };
    }[keyof WorkletSBKManagerData];
    keyModifierManager: {
        [K in keyof WorkletKMManagerData]: {
            type: K;
            data: WorkletKMManagerData[K];
        };
    }[keyof WorkletKMManagerData];
    destroyWorklet: null;
}

interface BasicSynthesizerReturnMessageData {
    eventCall: SynthProcessorEvent;
    sequencerReturn: SequencerReturnMessage;
    isFullyInitialized: {
        [K in keyof SynthesizerReturn]: {
            type: K;
            data: SynthesizerReturn[K];
        };
    }[keyof SynthesizerReturn];
    // An error message related to the sound bank. It contains a string description of the error.
    soundBankError: Error;
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
    };
}[keyof BasicSynthesizerReturnMessageData];

export interface SynthesizerProgress {
    renderAudio: number;
    writeSoundBank: {
        sampleName: string;
        sampleIndex: number;
        sampleCount: number;
    };
}

export interface SynthesizerReturn {
    sf3Decoder: null;
    soundBankManager: null;
    startOfflineRender: null;
    synthesizerSnapshot: SynthesizerSnapshot;
    renderAudio: {
        reverb: [Float32Array, Float32Array];
        chorus: [Float32Array, Float32Array];
        dry: [Float32Array, Float32Array][];
    };
    writeSoundBank: {
        binary: ArrayBuffer;
        bankName: string;
    };
}
