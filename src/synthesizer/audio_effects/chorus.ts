/**
 * Fancy_chorus.js
 * purpose: creates a simple chorus effect node
 */
import type { ChorusConfig } from "./types";
import { fillWithDefaults } from "../../utils/fill_with_defaults.ts";
import { BasicEffectsProcessor } from "./basic_effects_processor.ts";

interface ChorusNode {
    oscillator: OscillatorNode;
    oscillatorGain: GainNode;
    delay: DelayNode;
}

const NODES_AMOUNT = 4;
const DEFAULT_DELAY = 0.03;
const DELAY_VARIATION = 0.013;
const STEREO_DIFF = 0.03;

const OSC_FREQ = 0.2;
const OSC_FREQ_VARIATION = 0.05;
const OSC_GAIN = 0.003;

export const DEFAULT_CHORUS_CONFIG: ChorusConfig = {
    nodesAmount: NODES_AMOUNT,
    defaultDelay: DEFAULT_DELAY,
    delayVariation: DELAY_VARIATION,
    stereoDifference: STEREO_DIFF,
    oscillatorFrequency: OSC_FREQ,
    oscillatorFrequencyVariation: OSC_FREQ_VARIATION,
    oscillatorGain: OSC_GAIN
};

export class ChorusProcessor extends BasicEffectsProcessor {
    private readonly chorusLeft: ChorusNode[] = [];
    private readonly chorusRight: ChorusNode[] = [];

    /**
     * Creates a fancy chorus effect.
     * @param context The audio context.
     * @param config The configuration for the chorus.
     */
    public constructor(
        context: BaseAudioContext,
        config: Partial<ChorusConfig> = DEFAULT_CHORUS_CONFIG
    ) {
        super(context.createChannelSplitter(2), context.createChannelMerger(2));
        this.update(config);
    }

    private _config: ChorusConfig = DEFAULT_CHORUS_CONFIG;

    public get config() {
        return this._config;
    }

    /**
     * Updates the chorus with a given config.
     * @param chorusConfig The config to use.
     */
    public update(chorusConfig: Partial<ChorusConfig>) {
        this.deleteNodes();
        const config = fillWithDefaults(chorusConfig, DEFAULT_CHORUS_CONFIG);
        this._config = config;
        let freq = config.oscillatorFrequency;
        let delay = config.defaultDelay;
        for (let i = 0; i < config.nodesAmount; i++) {
            // Left node
            this.createChorusNode(
                freq,
                delay,
                this.chorusLeft,
                0,
                this.output,
                0,
                config
            );
            // Right node
            this.createChorusNode(
                freq,
                delay + config.stereoDifference,
                this.chorusRight,
                1,
                this.output,
                1,
                config
            );
            freq += config.oscillatorFrequencyVariation;
            delay += config.delayVariation;
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disconnects and deletes the chorus effect.
     */
    public delete() {
        super.delete();
        this.deleteNodes();
    }

    private deleteNodes() {
        this.input.disconnect();
        for (const node of this.chorusLeft) {
            node.delay.disconnect();
            node.oscillator.disconnect();
            node.oscillator.stop();
            node.oscillatorGain.disconnect();
        }
        for (const node of this.chorusRight) {
            node.delay.disconnect();
            node.oscillator.disconnect();
            node.oscillator.stop();
            node.oscillatorGain.disconnect();
        }
        this.chorusLeft.length = 0;
        this.chorusRight.length = 0;
    }

    private createChorusNode(
        freq: number,
        delay: number,
        list: ChorusNode[],
        input: number,
        output: AudioNode,
        outputNum: number,
        config: ChorusConfig
    ) {
        const context = output.context;
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = freq;
        const gainNode = context.createGain();
        gainNode.gain.value = config.oscillatorGain;
        const delayNode = context.createDelay();
        delayNode.delayTime.value = delay;

        oscillator.connect(gainNode);
        gainNode.connect(delayNode.delayTime);
        oscillator.start(context.currentTime /*+ delay*/);

        this.input.connect(delayNode, input);
        delayNode.connect(output, 0, outputNum);

        list.push({
            oscillator: oscillator,
            oscillatorGain: gainNode,
            delay: delayNode
        });
    }
}
