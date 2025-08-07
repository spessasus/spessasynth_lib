export abstract class BasicEffectsProcessor {
    // The input of the processor.
    public readonly input: AudioNode;
    protected readonly output: AudioNode;

    protected constructor(input: AudioNode, output: AudioNode) {
        this.input = input;
        this.output = output;
    }

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
