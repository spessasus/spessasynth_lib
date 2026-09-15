import { SpessaLog } from "spessasynth_core";
import { ConsoleColors } from "../utils/other";
import type { Sequencer } from "../sequencer/sequencer";
import type { BasicSynthesizer } from "../synthesizer/basic/basic_synthesizer";

/**
 * Midi_handler.js
 * purpose: handles the connection between MIDI devices and synthesizer/sequencer via Web MIDI API
 */

/**
 * Wrapper around the Web MIDI API's `MIDIPort`.
 *
 * @group Web MIDI
 */
export class LibMIDIPort {
    /**
     * The actual Web MIDI API port.
     */
    public readonly port: MIDIPort;

    protected constructor(port: MIDIPort) {
        this.port = port;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The `id` read-only property of the MIDIPort interface returns the unique ID of the port.
     */
    public get id() {
        return this.port.id;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The `name` read-only property of the MIDIPort interface returns the system name of the port.
     */
    public get name() {
        return this.port.name;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The `manufacturer` read-only property of the MIDIPort interface returns the manufacturer of the port.
     */
    public get manufacturer() {
        return this.port.manufacturer;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * The `version` read-only property of the MIDIPort interface returns the version of the port.
     */
    public get version() {
        return this.port.version;
    }
}

/**
 * Wrapper around the Web MIDI API's `MIDIInput`.
 *
 * @group Web MIDI
 */
export class LibMIDIInput extends LibMIDIPort {
    private readonly connectedSynths = new Set<BasicSynthesizer>();

    /**
     * @internal
     * @param input
     */
    public constructor(input: MIDIInput) {
        super(input);
        input.onmidimessage = (e) => {
            for (const s of this.connectedSynths) {
                if (e.data) s.sendMessage(e.data);
            }
        };
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

/**
 * Wrapper around the Web MIDI API's `MIDIOutput`.
 *
 * @group Web MIDI
 */
export class LibMIDIOutput extends LibMIDIPort {
    /**
     * @internal
     * @param output
     */
    public constructor(output: MIDIOutput) {
        super(output);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Connects a given sequencer to the output, playing back the MIDI file to it.
     * @param seq The sequencer to connect.
     * @param channelOffset The channel offset of this output for multi-port files.
     * For example 0 means the first port, 16 means the second port and so on.
     */
    public connect(seq: Sequencer, channelOffset = 0) {
        seq.connectMIDIOutput(this.port as MIDIOutput, channelOffset);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Disconnects sequencer from the output.
     * @param seq The sequencer to disconnect.
     */
    public disconnect(seq: Sequencer) {
        seq.disconnectMIDIOutput(this.port as MIDIOutput);
    }
}

// noinspection JSUnusedGlobalSymbols
/**
 * SpessaSynth provides an easy way to connect physical MIDI Devices
 * to it and back using the Web MIDI API via `MIDIDeviceHandler`.
 *
 * @group Web MIDI
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
        for (const [key, value] of access.inputs.entries()) {
            this.inputs.set(key, new LibMIDIInput(value));
        }
        for (const [key, value] of access.outputs.entries()) {
            this.outputs.set(key, new LibMIDIOutput(value));
        }
    }

    /**
     * Initializes the connection to physical MIDI Devices.
     * @returns The MIDI Device handler.
     * @throws Error An error if the MIDI Devices fail to initialize or the Web MIDI API is not supported.
     */
    public static async createMIDIDeviceHandler(): Promise<MIDIDeviceHandler> {
        if (navigator.requestMIDIAccess) {
            // Prepare the midi access
            try {
                const response = await navigator.requestMIDIAccess({
                    sysex: true,
                    software: true
                });
                SpessaLog.info(
                    "%cMIDI handler created!",
                    ConsoleColors.recognized
                );
                return new MIDIDeviceHandler(response);
            } catch (error) {
                SpessaLog.warn(`Could not get MIDI Devices:`, error);
                throw error;
            }
        } else {
            SpessaLog.warn(
                "Web MIDI API is not supported.",
                ConsoleColors.unrecognized
            );
            throw new Error("Web MIDI API is not supported.");
        }
    }
}
