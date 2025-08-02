/**
 * Fancy_chorus.js
 * purpose: creates a simple chorus effect node
 */
import type { ChorusConfig } from "./types";

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

export class FancyChorus {
    // The input of the processor.
    public input: AudioNode;

    private merger: ChannelMergerNode;
    private chorusLeft: ChorusNode[];
    private chorusRight: ChorusNode[];

    /**
     * Creates a fancy chorus effect.
     * @param output The target output node.
     * @param config The configuration for the chorus.
     */
    public constructor(
        output: AudioNode,
        config: ChorusConfig = DEFAULT_CHORUS_CONFIG
    ) {
        const context = output.context;

        this.input = context.createChannelSplitter(2);

        const merger = context.createChannelMerger(2);
        const chorusNodesLeft: ChorusNode[] = [];
        const chorusNodesRight: ChorusNode[] = [];
        let freq = config.oscillatorFrequency;
        let delay = config.defaultDelay;
        for (let i = 0; i < config.nodesAmount; i++) {
            // Left node
            this.createChorusNode(
                freq,
                delay,
                chorusNodesLeft,
                0,
                merger,
                0,
                context,
                config
            );
            // Right node
            this.createChorusNode(
                freq,
                delay + config.stereoDifference,
                chorusNodesRight,
                1,
                merger,
                1,
                context,
                config
            );
            freq += config.oscillatorFrequencyVariation;
            delay += config.delayVariation;
        }

        merger.connect(output);
        this.merger = merger;
        this.chorusLeft = chorusNodesLeft;
        this.chorusRight = chorusNodesRight;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disconnects and deletes the chorus effect.
     */
    public delete() {
        this.input.disconnect();
        this.merger.disconnect();
        for (const chorusLeftElement of this.chorusLeft) {
            chorusLeftElement.delay.disconnect();
            chorusLeftElement.oscillator.disconnect();
            chorusLeftElement.oscillatorGain.disconnect();
        }
        for (const chorusRightElement of this.chorusRight) {
            chorusRightElement.delay.disconnect();
            chorusRightElement.oscillator.disconnect();
            chorusRightElement.oscillatorGain.disconnect();
        }
        this.chorusLeft = [];
        this.chorusRight = [];
    }

    private createChorusNode(
        freq: number,
        delay: number,
        list: ChorusNode[],
        input: number,
        output: AudioNode,
        outputNum: number,
        context: BaseAudioContext,
        config: ChorusConfig
    ) {
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
