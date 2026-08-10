import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import { BasicSynthesizer } from "../basic/basic_synthesizer.ts";
import { DEFAULT_SYNTH_CONFIG } from "../basic/synth_config.ts";
import type { SynthConfig } from "../basic/types.ts";
import type { OfflineRenderWorkletData } from "../types.ts";
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
    public async startOfflineRender(config: OfflineRenderWorkletData) {
        this.post(
            {
                type: "startOfflineRender",
                data: config,
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
     * Destroys the synthesizer instance.
     */
    public destroy() {
        // noinspection JSCheckFunctionSignatures
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
}
