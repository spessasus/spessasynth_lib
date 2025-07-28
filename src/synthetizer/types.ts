import type {
    BasicMIDI,
    ChannelProperty,
    CustomController,
    KeyModifier,
    MasterParameterType,
    MIDIController,
    ProcessorEventType,
    SynthesizerSnapshot,
    SynthMethodOptions
} from "spessasynth_core";
import type {
    SequencerMessage,
    SequencerOptions,
    SequencerReturnMessage
} from "../sequencer/types";

export type StartRenderingDataConfig = Partial<{
    // The MIDI to render.
    parsedMIDI: BasicMIDI;
    // The snapshot to apply.
    snapshot: SynthesizerSnapshot;
    // If the synth should use one output with 32 channels (2 audio channels for each midi channel).
    oneOutput: boolean;
    // The times to loop the song.
    loopCount: number;
    // The options to pass to the sequencer.
    sequencerOptions: Partial<SequencerOptions>;
}>;

export type WorkletSBKManagerData = {
    // buffer<ArrayBuffer>
    reloadSoundBank: ArrayBuffer;
    addNewSoundBank: {
        soundBankBuffer: ArrayBuffer;
        id: string;
        bankOffset: number;
    };
    // id<string>
    deleteSoundBank: string;
    // newOrder<string[]> // where string is the id
    rearrangeSoundBanks: string[];
};
export type WorkletKMManagerData = {
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
};

export type WorkletMessage = {
    [K in keyof WorkletMessageData]: {
        channelNumber: number;
        messageType: K;
        messageData: WorkletMessageData[K];
    };
}[keyof WorkletMessageData];

type WorkletMessageData = {
    midiMessage: {
        messageData: Uint8Array;
        channelOffset: number;
        force: boolean;
        options: SynthMethodOptions;
    };
    // note: if channel is -1 then reset all channels
    ccReset: null;
    // note: if channel is -1 then stop all channels note 2: if rate is -1, it means locking
    setChannelVibrato: {
        rate: number;
        depth: number;
        delay: number;
    };
    // force: (0 false, 1 true) note: if channel is -1 then stop all channels
    stopAll: number;
    // amount
    killNotes: number;
    // is muted?
    muteChannel: boolean;
    addNewChannel: null;
    customCcChange: {
        ccNumber: CustomController;
        ccValue: number;
    };
    // semitones
    transposeChannel: {
        semitones: number;
        force: boolean;
    };
    // is drums?
    setDrums: boolean;
    // note: if cc num is -1, then preset is locked
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
    soundBankManager: WorkletSBKManagerObject<keyof WorkletSBKManagerData>;
    keyModifierManager: WorkletKMManagerObject<keyof WorkletKMManagerData>;
    destroyWorklet: null;
};

type WorkletSBKManagerObject<T extends keyof WorkletSBKManagerData> = {
    type: T;
    data: WorkletSBKManagerData[T];
};

type WorkletKMManagerObject<T extends keyof WorkletKMManagerData> = {
    type: T;
    data: WorkletKMManagerData[T];
};

type MasterParameterObject<T extends keyof MasterParameterType> = {
    type: T;
    data: MasterParameterType[T];
};

type EventCallObject<T extends keyof ProcessorEventType> = {
    type: T;
    data: ProcessorEventType[T];
};

export type WorkletReturnMessage =
    | {
          type: "channelPropertyChange";
          data: {
              channelNumber: number;
              property: ChannelProperty;
          };
      }
    | {
          type: "eventCall";
          data: EventCallObject<keyof ProcessorEventType>;
      }
    | {
          type: "masterParameterChange";
          data: MasterParameterObject<keyof MasterParameterType>;
      }
    | {
          type: "sequencerSpecific";
          data: SequencerReturnMessage;
      }
    | {
          type: "synthesizerSnapshot";
          data: SynthesizerSnapshot;
      }
    | {
          type: "isFullyInitialized";
          data: null;
      }
    | {
          type: "soundBankError";
          // An error message related to the sound bank. It contains a string description of the error.
          data: string;
      };
