import type { SynthesizerSnapshot } from "spessasynth_core";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import { BasicSynthesizer } from "../basic/basic_synthesizer.ts";
import {
    DEFAULT_SYNTH_CONFIG,
    TOTAL_OUTPUT_COUNT
} from "../basic/synth_config.ts";
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
     * Returns a `ChannelMergerNode` with all outputs merged int o a single one, with multiple channels, layered as follows:
     *
     * - EffectsL, EffectsR
     * - Channel1L, Channel2R
     * - ...
     * - Channel16L, Channel16R
     *
     * This is intended for offline audio rendering via OfflineAudioContext to allow extraction of separate channels
     * and is the replacement for one output mode.
     */
    public getMergedOutput(): ChannelMergerNode {
        const merger = this.context.createChannelMerger(TOTAL_OUTPUT_COUNT * 2);
        // Connect effects, both convolver and dry
        const effectsSplitter = this.context.createChannelSplitter(2);

        // Forced connection at the first output for shared effects
        this.worklet.connect(effectsSplitter, 0);
        this.convolverNode?.connect(effectsSplitter);

        effectsSplitter.connect(merger, 0, 0);
        effectsSplitter.connect(merger, 1, 1);

        // Connect channels
        for (let i = 0; i < 16; i++) {
            const splitter = this.context.createChannelSplitter(2);
            // +1 because convolver + worklet are packed into one pair
            const output = i + 1;
            this.worklet.connect(splitter, output);
            splitter.connect(merger, 0, output * 2);
            splitter.connect(merger, 1, output * 2 + 1);
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
