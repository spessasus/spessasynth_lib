import { consoleColors } from "../utils/other.js";
import { SpessaSynthCoreUtils } from "spessasynth_core";
import type { BasicSynthesizer } from "../synthesizer/basic/basic_synthesizer.ts";

/**
 * Web_midi_link.js
 * purpose: handles the web midi link connection to the synthesizer
 * https://www.g200kg.com/en/docs/webmidilink/
 */

export class WebMIDILinkHandler {
    /**
     * Initializes support for Web MIDI Link (https://www.g200kg.com/en/docs/webmidilink/)
     * @param synth The synthesizer to enable support with.
     */
    public constructor(synth: BasicSynthesizer) {
        window.addEventListener("message", (msg) => {
            if (typeof msg.data !== "string") {
                return;
            }
            const data: string[] = msg.data.split(",");
            if (data[0] !== "midi") {
                return;
            }

            data.shift(); // Remove MIDI

            const midiData = data.map((byte) => parseInt(byte, 16));

            synth.sendMessage(midiData);
        });

        SpessaSynthCoreUtils.SpessaSynthInfo(
            "%cWeb MIDI Link handler created!",
            consoleColors.recognized
        );
    }
}
