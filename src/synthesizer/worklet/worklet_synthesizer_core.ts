// A worklet processor for the WorkletSynthesizer
import {
    BasicMIDI,
    SoundBankLoader,
    SpessaLog,
    type SynthesizerSnapshot
} from "spessasynth_core";
import { DEFAULT_SEQUENCER_OPTIONS } from "../../sequencer/default_sequencer_options.ts";
import type { SequencerOptions } from "../../sequencer/types.ts";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import { ConsoleColors } from "../../utils/other.ts";
import {
    BasicSynthesizerCore,
    SEQUENCER_SYNC_INTERVAL
} from "../basic/basic_synthesizer_core.ts";
import { VISUAL_CHANNEL_OUTPUTS_START } from "../basic/synth_config.ts";
import type { SynthCoreConfig } from "../basic/types.ts";
import type {
    BasicSynthesizerMessage,
    OfflineRenderWorkletData
} from "../types.ts";

export class WorkletSynthesizerCore extends BasicSynthesizerCore {
    protected alive = true;
    private readonly port: MessagePort;

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
     * @returns true unless it's not alive
     */
    public process(
        _inputs: Float32Array[][],
        outputs: Float32Array[][]
    ): boolean {
        if (!this.alive) {
            return false;
        }
        // Start the queue
        this.messageQueueActive = true;
        // Process sequencer
        for (const sq of this.sequencers) {
            sq.processTick();
        }

        // 18 outputs, each a stereo one
        // 0: Effects
        // 1: Convolver
        // 2: channel 1
        // 3: channel 2
        // And so on
        this.synthesizer.process(
            outputs[0][0],
            outputs[0][1],
            undefined,
            undefined,
            outputs.slice(VISUAL_CHANNEL_OUTPUTS_START)
        );

        // Send reverb
        if (this.reverbCapture) {
            outputs[1][0].set(this.reverbCapture.capturedData);
            outputs[1][1].set(this.reverbCapture.capturedData);
        }

        const t = this.synthesizer.currentTime;
        if (
            this.eventsEnabled &&
            t - this.lastSequencerSync > SEQUENCER_SYNC_INTERVAL
        ) {
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

        this.flushQueue();
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
            console.error(error);
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
