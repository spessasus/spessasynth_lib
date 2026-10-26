// A worklet processor for the WorkletSynthesizer
import {
    BasicMIDI,
    SoundBankLoader,
    SpessaLog,
    type SynthesizerSnapshot
} from "spessasynth_core";
import { DEFAULT_SEQUENCER_OPTIONS } from "../../sequencer/default_sequencer_options";
import type { SequencerOptions } from "../../sequencer/types";
import { fillWithDefaults } from "../../utils/fill_with_defaults";
import { ConsoleColors } from "../../utils/other";
import { BasicSynthesizerCore } from "../basic/basic_synthesizer_core";
import {
    TOTAL_OUTPUT_COUNT,
    VISUAL_CHANNEL_OUTPUTS_START
} from "../basic/synth_config";
import type { SynthCoreConfig } from "../basic/types";
import type {
    BasicSynthesizerMessage,
    OfflineRenderWorkletData
} from "../types";

export class WorkletSynthesizerCore extends BasicSynthesizerCore {
    private readonly port: MessagePort;
    /**
     * The visual channel outputs, reused to avoid allocating an array in every `process()` call.
     */
    private readonly channelOutputs = new Array<Float32Array[]>(
        TOTAL_OUTPUT_COUNT - VISUAL_CHANNEL_OUTPUTS_START
    );

    public constructor(synthCoreConfig: SynthCoreConfig, port: MessagePort) {
        super(synthCoreConfig, (data, transfer) => {
            port.postMessage(data, transfer!);
        });
        this.port = port;

        void this.synthesizer.ready.then(() => {
            // Receive messages from the main thread
            this.port.onmessage = (e: MessageEvent<BasicSynthesizerMessage>) =>
                this.handleMessage(e.data);
            this.postReady("sf3Decoder", null);
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The audio worklet processing logic
     * @param _inputs required by WebAudioAPI
     * @param outputs the outputs to write to, only the first two channels of each are populated
     * @returns True unless the core has been destroyed.
     */
    public process(
        _inputs: Float32Array[][],
        outputs: Float32Array[][]
    ): boolean {
        if (this.destroyed) {
            return false;
        }
        this.startBlock();

        // 18 outputs, each a stereo one
        // 0: Main output (the complete audio, with effects)
        // 1: Convolver dry (for main thread convolution, unused without convolverMode)
        // 2-17: MIDI Channel outputs (visualization only, not to be connected to audio output!)
        const channelOutputs = this.channelOutputs;
        for (let i = 0; i < channelOutputs.length; i++)
            channelOutputs[i] = outputs[i + VISUAL_CHANNEL_OUTPUTS_START];
        this.synthesizer.process(
            outputs[0][0],
            outputs[0][1],
            undefined,
            undefined,
            this.channelOutputs
        );

        // Send reverb
        this.reverbCapture?.moveCapturedData(
            outputs[1][0],
            outputs[1][1],
            0,
            outputs[1][0].length
        );

        this.finishBlock();
        return true;
    }

    protected handleMessage(m: BasicSynthesizerMessage) {
        if (m.type === "startOfflineRender") {
            this.startOfflineRender(m.data);
            return;
        }
        super.handleMessage(m);
    }

    private startOfflineRender(
        config: OfflineRenderWorkletData<SynthesizerSnapshot>
    ) {
        // Create a new sequencer if there are none
        // (common use case, example  offline_audio.js)
        if (this.sequencers.length === 0) this.createNewSequencer();

        // Use the first sequencer
        const sq = this.sequencers[0];

        // Load the bank list
        for (const [i, b] of config.soundBankList.entries()) {
            try {
                this.synthesizer.soundBankManager.addSoundBank(
                    SoundBankLoader.fromArrayBuffer(b.soundBankBuffer),
                    `bank-${i}`,
                    b.bankOffset
                );
            } catch (error) {
                this.post({
                    type: "soundBankError",
                    data: error as Error,
                    currentTime: this.synthesizer.currentTime
                });
            }
        }

        if (config.snapshot !== undefined) {
            this.synthesizer.applySnapshot(config.snapshot);
        }

        // If sent, start rendering
        SpessaLog.info(
            "%cStarting to render the audio data!",
            ConsoleColors.info
        );
        sq.loopCount = config.loopCount;
        // Set voice cap to unlimited
        this.synthesizer.setSystemParameter("autoAllocateVoices", true);
        // The snapshot may have disabled the events, but the main thread needs them for the state sync
        this.synthesizer.setSystemParameter("eventsEnabled", true);

        /**
         * Set options
         */
        const seqOptions: SequencerOptions = fillWithDefaults(
            config.sequencerOptions,
            DEFAULT_SEQUENCER_OPTIONS
        );
        sq.skipToFirstNoteOn = seqOptions.skipToFirstNoteOn;
        sq.playbackRate = seqOptions.initialPlaybackRate;
        // Autoplay is ignored
        try {
            // Cloned objects don't have methods
            sq.loadNewSongList([BasicMIDI.copyFrom(config.midiSequence)]);
            sq.play();
        } catch (error) {
            SpessaLog.warn(error);
            this.post({
                type: "sequencerReturn",
                data: {
                    type: "midiError",
                    data: error as Error,
                    id: 0
                },
                currentTime: this.synthesizer.currentTime
            });
        }
        this.postReady("startOfflineRender", null);
    }
}
