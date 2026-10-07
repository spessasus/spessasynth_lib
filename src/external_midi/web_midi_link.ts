import { ConsoleColors } from "../utils/other";
import { SpessaLog } from "spessasynth_core";
import type { BasicSynthesizer } from "../synthesizer/basic/basic_synthesizer";

/**
 * Web_midi_link.js
 * purpose: handles the web midi link connection to the synthesizer
 * https://www.g200kg.com/en/docs/webmidilink/
 */

/**
 * This module adds [Web MIDI Link](https://www.g200kg.com/en/docs/webmidilink/) support to the synthesizer.
 *
 * Web MIDI Link allows external apps (e.g. MIDI editors, DAWs) to control the synthesizer over MIDI by sending messages through a browser window.
 *
 * @group Web MIDI
 */
export class WebMIDILinkHandler {
    /**
     * Initializes support for Web MIDI Link (https://www.g200kg.com/en/docs/webmidilink/)
     *
     * Once created, the handler listens for `postMessage` events from the parent window.
     * When it receives a MIDI message in the format `"midi,xx,yy,zz"` (hex bytes), it forwards it to the synthesizer.
     * @param synth The synthesizer instance to connect the link to.
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

            const midiData = data.map((byte) => Number.parseInt(byte, 16));

            synth.sendMessage(midiData);
        });

        SpessaLog.info(
            "%cWeb MIDI Link handler created!",
            ConsoleColors.recognized
        );
    }
}
