import { reverbBufferBinary } from "./compressed_reverb_decoder.js";
import { BasicEffectsProcessor } from "./basic_effects_processor.ts";
import type { ReverbConfig } from "./types.ts";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";

export const DEFAULT_REVERB_CONFIG: ReverbConfig = {
    impulseResponse: undefined // Will load the integrated one
};

export class ReverbProcessor extends BasicEffectsProcessor {
    /**
     * Indicates that the reverb is ready.
     */
    public readonly isReady: Promise<AudioBuffer>;
    private conv: ConvolverNode;

    /**
     * Creates a new reverb processor.
     * @param context The context to use.
     * @param config The reverb configuration.
     */
    public constructor(
        context: BaseAudioContext,
        config: Partial<ReverbConfig> = DEFAULT_REVERB_CONFIG
    ) {
        const fullConfig = fillWithDefaults(config, DEFAULT_REVERB_CONFIG);
        const convolver = context.createConvolver();
        super(convolver, convolver);
        this.conv = convolver;
        const reverbBuffer = fullConfig.impulseResponse;
        if (reverbBuffer) {
            convolver.buffer = reverbBuffer;
            this.isReady = new Promise<AudioBuffer>((r) => r(reverbBuffer));
        } else {
            // Decode
            this.isReady = context.decodeAudioData(reverbBufferBinary.slice(0));
            void this.isReady.then((b) => {
                convolver.buffer = b;
            });
        }
        this._config = fullConfig;
    }

    private _config: ReverbConfig;

    public get config() {
        return this._config;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Updates the reverb with a given config.
     * @param config The config to use.
     */
    public update(config: Partial<ReverbConfig>) {
        const fullConfig = fillWithDefaults(config, DEFAULT_REVERB_CONFIG);
        if (fullConfig.impulseResponse) {
            this.conv.buffer = fullConfig.impulseResponse;
        }
        this._config = fullConfig;
    }
}
