import type { SynthesizerSnapshot } from "spessasynth_core";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import { BasicSynthesizer } from "../basic/basic_synthesizer.ts";
import { DEFAULT_SYNTH_CONFIG } from "../basic/synth_config.ts";
import type { SynthConfig } from "../basic/types.ts";
import type {
    LibSynthesizerSnapshot,
    OfflineRenderWorkletData
} from "../types.ts";
import { WORKLET_PROCESSOR_NAME } from "./worklet_processor_name.js";

/**
 * This synthesizer uses an audio worklet node containing the processor.
 */
export class WorkletSynthesizer extends BasicSynthesizer {
    /**
     * Creates a new instance of an AudioWorklet-based synthesizer.
     * @param context The audio context.
     * @param config Optional configuration for the synthesizer.
     */
    public constructor(
        context: BaseAudioContext,
        config: Partial<SynthConfig> = DEFAULT_SYNTH_CONFIG
    ) {
        // Ensure default values for options
        super(
            context,
            WORKLET_PROCESSOR_NAME,
            fillWithDefaults(config, DEFAULT_SYNTH_CONFIG)
        );
    }

    /**
     * Starts an offline audio render.
     * @param config The configuration to use.
     * @remarks
     * Call this method immediately after you've set up the synthesizer.
     * Do NOT call any other methods after initializing before this one.
     * Chromium seems to ignore worklet messages for OfflineAudioContext.
     */
    public async startOfflineRender(
        config: OfflineRenderWorkletData<LibSynthesizerSnapshot>
    ) {
        if (config.snapshot?.convolverImpulseResponse) {
            if (!this.convolverNode) {
                throw new Error(
                    "Snapshot has impulse response provided but convolverMode is disabled!"
                );
            }
            this.convolverNode.buffer =
                config.snapshot.convolverImpulseResponse;
        }

        const configToSend = {
            ...config,
            snapshot: this.stripConvolverFromSnapshot(config.snapshot)
        };

        this.post(
            {
                type: "startOfflineRender",
                data: configToSend,
                channelNumber: -1
            },
            config.soundBankList.map((b) => b.soundBankBuffer)
        );
        await new Promise((r) =>
            this.awaitWorkerResponse("startOfflineRender", r)
        );
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Returns a `ChannelMergerNode` with all 16 channel outputs merged into a single one, with multiple channels, layered as follows:
     *
     * - Channel1L, Channel1R
     * - ...
     * - Channel16L, Channel16R
     *
     * This is intended for offline audio rendering via OfflineAudioContext to allow extraction of separate channels.
     * Note that the main output is not included, as Web Audio caps the number of channels at 32.
     */
    public getMergedOutput(): ChannelMergerNode {
        // 16 stereo pairs to stay within the 32 channel cap
        const merger = this.context.createChannelMerger(16 * 2);

        // Connect channels
        for (let i = 0; i < 16; i++) {
            const splitter = this.context.createChannelSplitter(2);
            // +2 because outputs 0 and 1 are the main output and the convolver
            const output = i + 2;
            this.worklet.connect(splitter, output);
            splitter.connect(merger, 0, i * 2);
            splitter.connect(merger, 1, i * 2 + 1);
        }

        return merger;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Destroys the synthesizer instance.
     */
    public destroy() {
        this.post({
            channelNumber: 0,
            type: "destroyWorklet",
            data: null
        });
        this.worklet.disconnect();
        // @ts-expect-error destruction!
        // noinspection JSConstantReassignment
        delete this.worklet;
    }

    private stripConvolverFromSnapshot(
        snapshot?: LibSynthesizerSnapshot
    ): SynthesizerSnapshot | undefined {
        if (!snapshot) return undefined;
        // Remove this, so it's not sent to the worklet
        const snapshotCopy = { ...snapshot } as Omit<
            LibSynthesizerSnapshot,
            "convolverImpulseResponse"
        >;
        delete (snapshotCopy as { convolverImpulseResponse?: unknown })
            .convolverImpulseResponse;
        return snapshotCopy;
    }
}
