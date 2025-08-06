import type {
    BasicMIDI,
    CustomController,
    KeyModifier,
    MasterParameterType,
    MIDIController,
    SynthesizerSnapshot,
    SynthMethodOptions,
    SynthProcessorEvent
} from "spessasynth_core";
import type {
    SequencerMessage,
    SequencerOptions,
    SequencerReturnMessage
} from "../sequencer/types";

export interface PassedProcessorParameters {
    midiChannels: number;
    enableEventSystem: boolean;
}
export interface StartRenderingDataConfig {
    /**
     * The MIDI to render.
     */
    midiSequence: BasicMIDI;
    /**
     * The snapshot to apply.*
     */
    snapshot?: SynthesizerSnapshot;
    /**
     * If the synth should use one output with 32 channels (2 audio channels for each midi channel).
     */
    oneOutput: boolean;
    /**
     * The amount times to loop the song.
     */
    loopCount: number;

    /**
     * The list of sound banks to render this file with.
     */
    soundBankList: ArrayBuffer[];

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
    // Id<string>
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

export type WorkletMessage = {
    [K in keyof WorkletMessageData]: {
        channelNumber: number;
        type: K;
        data: WorkletMessageData[K];
    };
}[keyof WorkletMessageData];

interface WorkletMessageData {
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

    startOfflineRender: StartRenderingDataConfig;

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

interface WorkletReturnMessageData {
    eventCall: SynthProcessorEvent;
    sequencerReturn: SequencerReturnMessage;
    synthesizerSnapshot: SynthesizerSnapshot;
    isFullyInitialized: null;
    // An error message related to the sound bank. It contains a string description of the error.
    soundBankError: Error;
}

export type WorkletReturnMessage = {
    [K in keyof WorkletReturnMessageData]: {
        type: K;
        data: WorkletReturnMessageData[K];
    };
}[keyof WorkletReturnMessageData];
