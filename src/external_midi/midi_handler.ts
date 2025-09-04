import { SpessaSynthCoreUtils as util } from "spessasynth_core";
import { consoleColors } from "../utils/other.js";
import type { Sequencer } from "../sequencer/sequencer";
import type { BasicSynthesizer } from "../synthesizer/basic/basic_synthesizer.ts";

/**
 * Midi_handler.js
 * purpose: handles the connection between MIDI devices and synthesizer/sequencer via Web MIDI API
 */

class LibMIDIPort {
    public readonly port: MIDIPort;

    protected constructor(port: MIDIPort) {
        this.port = port;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     *
     */
    public get id() {
        return this.port.id;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     *
     */
    public get name() {
        return this.port.name;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     *
     */
    public get manufacturer() {
        return this.port.manufacturer;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     *
     */
    public get version() {
        return this.port.version;
    }
}

class LibMIDIInput extends LibMIDIPort {
    private readonly connectedSynths = new Set<BasicSynthesizer>();

    public constructor(input: MIDIInput) {
        super(input);
        input.onmidimessage = (e) =>
            this.connectedSynths.forEach((s) => {
                if (e.data) s.sendMessage(e.data);
            });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Connects the input to a given synth, listening for all incoming events.
     * @param synth The synth to connect to.
     */
    public connect(synth: BasicSynthesizer) {
        this.connectedSynths.add(synth);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disconnects the input from a given synth.
     * @param synth The synth to disconnect from.
     */
    public disconnect(synth: BasicSynthesizer) {
        this.connectedSynths.delete(synth);
    }
}

class LibMIDIOutput extends LibMIDIPort {
    public readonly port: MIDIOutput;

    public constructor(output: MIDIOutput) {
        super(output);
        this.port = output;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Connects a given sequencer to the output, playing back the MIDI file to it.
     * @param seq The sequencer to connect.
     */
    public connect(seq: Sequencer) {
        seq.connectMIDIOutput(this.port);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disconnects sequencer from the output, making it play to the attached Synthesizer instead.
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
     * The available MIDI inputs. ID maps to the input.
     */
    public readonly inputs = new Map<string, LibMIDIInput>();
    /**
     * The available MIDI outputs. ID maps to the output.
     */
    public readonly outputs = new Map<string, LibMIDIOutput>();

    private constructor(access: MIDIAccess) {
        access.inputs.forEach((value, key) => {
            this.inputs.set(key, new LibMIDIInput(value));
        });
        access.outputs.forEach((value, key) => {
            this.outputs.set(key, new LibMIDIOutput(value));
        });
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
