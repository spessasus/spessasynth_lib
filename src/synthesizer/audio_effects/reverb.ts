import { reverbBufferBinary } from "./compressed_reverb_decoder.js";
import { BasicEffectsProcessor } from "./basic_effects_processor.ts";
import type { ReverbConfig } from "./types.ts";
import { DEFAULT_REVERB_CONFIG } from "./effects_config.ts";

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
        const convolver = context.createConvolver();
        super(convolver, convolver);
        this.conv = convolver;
        const reverbBuffer = config.impulseResponse;
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
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Updates the reverb with a given config.
     * @param config The config to use.
     */
    public update(config: Partial<ReverbConfig>) {
        if (config.impulseResponse) {
            this.conv.buffer = config.impulseResponse;
        }
    }
}
