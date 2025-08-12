import { SpessaSynthCoreUtils as util } from "spessasynth_core";
import { consoleColors } from "../utils/other.js";
import type { Sequencer } from "../sequencer/sequencer";
import type { BasicSynthesizer } from "../synthesizer/basic/basic_synthesizer.ts";

/**
 * Midi_handler.js
 * purpose: handles the connection between MIDI devices and synthesizer/sequencer via Web MIDI API
 */

class LibMIDIInput {
    public readonly input: MIDIInput;
    private readonly connectedSynths = new Set<BasicSynthesizer>();

    public constructor(input: MIDIInput) {
        this.input = input;
        this.input.onmidimessage = (e) =>
            this.connectedSynths.forEach((s) => {
                if (e.data) s.sendMessage(e.data);
            });
    }

    /**
     * Connects the input to a given synth.
     * @param synth The synth to connect to.
     */
    public connect(synth: BasicSynthesizer) {
        this.connectedSynths.add(synth);
    }

    /**
     * Disconnects the input from a given synth.
     * @param synth The synth to disconnect from.
     */
    public disconnect(synth: BasicSynthesizer) {
        this.connectedSynths.delete(synth);
    }
}

class LibMIDIOutput {
    public readonly output: MIDIOutput;

    public constructor(output: MIDIOutput) {
        this.output = output;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Connects a given sequencer to the output.
     * @param seq The sequencer to connect.
     */
    public connect(seq: Sequencer) {
        seq.connectMIDIOutput(this.output);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disconnects a given sequencer from the output.
     * @param seq The sequencer to disconnect.
     */
    public disconnect(seq: Sequencer) {
        seq.connectMIDIOutput(undefined);
    }
}

// noinspection JSUnusedGlobalSymbols
/**
 * A class for handling physical MIDI devices.
 */
export class MIDIDeviceHandler {
    /**
     * The available MIDI inputs.
     */
    public readonly inputs: Set<LibMIDIInput>;
    /**
     * The available MIDI outputs.
     */
    public readonly outputs: Set<LibMIDIOutput>;

    private constructor(access: MIDIAccess) {
        this.inputs = new Set(
            Array.from(access.inputs.values()).map((i) => new LibMIDIInput(i))
        );
        this.outputs = new Set(
            Array.from(access.outputs.values()).map((o) => new LibMIDIOutput(o))
        );
    }

    /**
     * Attempts to initialize the MIDI Device Handler.
     * @returns The handler.
     * @throws An error if the MIDI Devices fail to initialize.
     */
    public static async createMIDIDeviceHandler(): Promise<MIDIDeviceHandler> {
        if (navigator.requestMIDIAccess) {
            // Prepare the midi access
            try {
                const response = await navigator.requestMIDIAccess({
                    sysex: true,
                    software: true
                });
                util.SpessaSynthInfo(
                    "%cMIDI handler created!",
                    consoleColors.recognized
                );
                return new MIDIDeviceHandler(response);
            } catch (e) {
                util.SpessaSynthWarn(`Could not get MIDI Devices:`, e);
                throw e;
            }
        } else {
            util.SpessaSynthWarn(
                "Web MIDI API is not supported.",
                consoleColors.unrecognized
            );
            throw new Error("Web MIDI API is not supported.");
        }
    }
}
