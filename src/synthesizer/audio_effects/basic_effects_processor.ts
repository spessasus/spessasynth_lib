import type { BasicEffectConfig } from "./types.ts";

export abstract class BasicEffectsProcessor {
    // The input of the processor.
    public readonly input: AudioNode;
    protected readonly output: AudioNode;

    protected constructor(input: AudioNode, output: AudioNode) {
        this.input = input;
        this.output = output;
    }

    public abstract get config(): BasicEffectConfig;

    public abstract update(config: BasicEffectConfig): void;

    /**
     * Connects the processor to a given node.
     * @param destinationNode The node to connect to.
     */
    public connect(destinationNode: AudioNode) {
        return this.output.connect(destinationNode);
    }

    /**
     * Disconnects the processor from a given node.
     * @param destinationNode The node to disconnect from.
     */
    public disconnect(destinationNode?: AudioNode) {
        if (!destinationNode) {
            return this.output.disconnect();
        }
        return this.output.disconnect(destinationNode);
    }

    /**
     * Disconnects the effect processor.
     */
    public delete() {
        this.input.disconnect();
        this.output.disconnect();
    }
}
