import { WorkletSynthesizer } from "../synthetizer/synthetizer.js";
import { SpessaSynthCoreUtils as util } from "spessasynth_core";
import { consoleColors } from "../utils/other.js";
import type { Sequencer } from "../sequencer/sequencer";

/**
 * midi_handler.js
 * purpose: handles the connection between MIDI devices and synthesizer/sequencer via Web MIDI API
 */

const NO_INPUT = undefined;

// noinspection JSUnusedGlobalSymbols
/**
 * A class for handling physical MIDI devices.
 */
export class MIDIDeviceHandler {
    // The currently selected MIDI input.
    public selectedInput?: MIDIInput;
    // The currently selected MIDI output.
    public selectedOutput?: MIDIOutput;

    // The available MIDI inputs.
    public inputs?: MIDIInputMap;
    // The available MIDI outputs.
    public outputs?: MIDIOutputMap;

    /**
     * Attempts to initialize the MIDI Device Handler.
     * @returns True if succeeded.
     */
    public async createMIDIDeviceHandler(): Promise<boolean> {
        this.selectedInput = NO_INPUT;
        this.selectedOutput = NO_INPUT;
        if (navigator.requestMIDIAccess) {
            // prepare the midi access
            try {
                const response = await navigator.requestMIDIAccess({
                    sysex: true,
                    software: true
                });
                this.inputs = response.inputs;
                this.outputs = response.outputs;
                util.SpessaSynthInfo(
                    "%cMIDI handler created!",
                    consoleColors.recognized
                );
                return true;
            } catch (e) {
                util.SpessaSynthWarn(`Could not get MIDI Devices:`, e);
                return false;
            }
        } else {
            util.SpessaSynthWarn(
                "Web MIDI Api not supported!",
                consoleColors.unrecognized
            );
            return false;
        }
    }

    /**
     * Connects the sequencer to a given MIDI output port.
     * @param output The output to connect the sequencer to.
     * @param seq The sequencer instance.
     */
    public connectMIDIOutputToSeq(output: MIDIOutput, seq: Sequencer) {
        this.selectedOutput = output;
        seq.connectMidiOutput(output);
        util.SpessaSynthInfo(
            `%cPlaying MIDI to %c${output.name}`,
            consoleColors.info,
            consoleColors.recognized
        );
    }

    /**
     * Disconnects a MIDI output port from the sequencer.
     * @param seq The sequencer to disconnect the output from.
     */
    public disconnectSeqFromMIDI(seq: Sequencer) {
        this.selectedOutput = NO_INPUT;
        seq.connectMidiOutput(undefined);
        util.SpessaSynthInfo(
            "%cDisconnected from MIDI out.",
            consoleColors.info
        );
    }

    /**
     * Connects a MIDI input to the synthesizer.
     * @param input The input to connect to.
     * @param synth The synthesizer instance.
     */
    public connectDeviceToSynth(input: MIDIInput, synth: WorkletSynthesizer) {
        this.selectedInput = input;
        input.onmidimessage = (event) => {
            synth.sendMessage(event.data as Iterable<number>);
        };
        util.SpessaSynthInfo(
            `%cListening for messages on %c${input.name}`,
            consoleColors.info,
            consoleColors.recognized
        );
    }

    /**
     * Disconnects a MIDI input from the synthesizer.
     * @param input The input to disconnect.
     */
    public disconnectDeviceFromSynth(input: MIDIInput) {
        this.selectedInput = NO_INPUT;
        input.onmidimessage = null;
        util.SpessaSynthInfo(
            `%cDisconnected from %c${input.name}`,
            consoleColors.info,
            consoleColors.recognized
        );
    }

    // Disconnects all MIDI inputs from the synthesizer.
    public disconnectAllDevicesFromSynth() {
        this.selectedInput = NO_INPUT;
        if (!this.inputs) {
            return;
        }
        for (const i of this.inputs) {
            i[1].onmidimessage = null;
        }
    }
}
