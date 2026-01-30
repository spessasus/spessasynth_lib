// A worklet processor for the WorkletSynthesizer
import {
    BasicMIDI,
    SoundBankLoader,
    SpessaSynthCoreUtils as util
} from "spessasynth_core";
import type {
    BasicSynthesizerMessage,
    OfflineRenderWorkletData,
    PassedProcessorParameters
} from "../types.ts";
import type { SequencerOptions } from "../../sequencer/types.ts";
import { consoleColors } from "../../utils/other.ts";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import { DEFAULT_SEQUENCER_OPTIONS } from "../../sequencer/default_sequencer_options.ts";
import { BasicSynthesizerCore } from "../basic/basic_synthesizer_core.ts";

export class WorkletSynthesizerCore extends BasicSynthesizerCore {
    protected alive = true;
    /**
     * Instead of 18 stereo outputs, there's one with 32 channels (no effects).
     */
    private readonly oneOutputMode: boolean;
    private readonly port: MessagePort;

    public constructor(
        sampleRate: number,
        currentTime: number,
        port: MessagePort,
        opts: PassedProcessorParameters
    ) {
        super(
            sampleRate,
            {
                enableEffects: !opts.oneOutput, // One output mode disables effects
                enableEventSystem: opts?.enableEventSystem, // Enable message port?
                initialTime: currentTime
            },
            (data, transfer) => {
                port.postMessage(data, transfer!);
            }
        );
        this.port = port;

        this.oneOutputMode = opts.oneOutput;

        void this.synthesizer.processorInitialized.then(() => {
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
        // Process sequencer
        this.sequencer.processTick();

        if (this.oneOutputMode) {
            const out = outputs[0];
            // 1 output with 32 channels.
            // Channels are ordered as follows:
            // MidiChannel1L, midiChannel1R,
            // MidiChannel2L, midiChannel2R
            // And so on
            const channelMap: Float32Array[][] = [];
            for (let i = 0; i < 32; i += 2) {
                channelMap.push([out[i], out[i + 1]]);
            }
            this.synthesizer.renderAudioSplit(
                [],
                [], // Effects are disabled
                channelMap
            );
        } else {
            // 18 outputs, each a stereo one
            // 0: reverb
            // 1: chorus
            // 2: channel 1
            // 3: channel 2
            // And so on
            this.synthesizer.renderAudioSplit(
                outputs[0], // Reverb
                outputs[1], // Chorus
                outputs.slice(2)
            );
        }
        return true;
    }

    protected handleMessage(m: BasicSynthesizerMessage) {
        if (m.type === "startOfflineRender") {
            this.startOfflineRender(m.data);
            return;
        }
        super.handleMessage(m);
    }

    private startOfflineRender(config: OfflineRenderWorkletData) {
        if (!this.sequencer) {
            return;
        }

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
                    currentTime: this.synthesizer.currentSynthTime
                });
            }
        }

        if (config.snapshot !== undefined) {
            this.synthesizer.applySynthesizerSnapshot(config.snapshot);
        }

        // If sent, start rendering
        util.SpessaSynthInfo(
            "%cRendering enabled! Starting render.",
            consoleColors.info
        );
        this.sequencer.loopCount = config.loopCount;
        // Set voice cap to unlimited
        this.synthesizer.setMasterParameter("voiceCap", Infinity);

        /**
         * Set options
         */
        const seqOptions: SequencerOptions = fillWithDefaults(
            config.sequencerOptions,
            DEFAULT_SEQUENCER_OPTIONS
        );
        this.sequencer.skipToFirstNoteOn = seqOptions.skipToFirstNoteOn;
        this.sequencer.playbackRate = seqOptions.initialPlaybackRate;
        // Autoplay is ignored
        try {
            // Cloned objects don't have methods
            this.sequencer.loadNewSongList([
                BasicMIDI.copyFrom(config.midiSequence)
            ]);
            this.sequencer.play();
        } catch (error) {
            console.error(error);
            this.post({
                type: "sequencerReturn",
                data: {
                    type: "midiError",
                    data: error as Error
                },
                currentTime: this.synthesizer.currentSynthTime
            });
        }
        this.postReady("startOfflineRender", null);
    }
}
