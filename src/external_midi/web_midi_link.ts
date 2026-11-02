import { ConsoleColors } from "../utils/other";
import { SpessaLog } from "spessasynth_core";
import type { BasicSynthesizer } from "../synthesizer/basic/basic_synthesizer";

/**
 * This class adds [Web MIDI Link](https://www.g200kg.com/en/docs/webmidilink/) support to the synthesizer.
 *
 * Web MIDI Link allows other web pages (for example, online MIDI editors) to control the synthesizer by sending MIDI messages to its window.
 *
 * @group Web MIDI
 */
export class WebMIDILinkHandler {
    private readonly listener: (msg: MessageEvent) => void;

    /**
     * Initializes support for [Web MIDI Link](https://www.g200kg.com/en/docs/webmidilink/).
     *
     * Once created, the handler listens for `postMessage` events from the parent window.
     * When it receives a MIDI message in the format `"midi,xx,yy,zz"` (hex bytes), it forwards it to the synthesizer.
     * @param synth The synthesizer instance to connect the link to.
     */
    public constructor(synth: BasicSynthesizer) {
        this.listener = (msg: MessageEvent) => {
            if (typeof msg.data !== "string") {
                return;
            }
            const data = msg.data.split(",");
            if (data[0] !== "midi" || data.length < 2) {
                return;
            }

            const midiData = new Array<number>(data.length - 1);
            for (let i = 1; i < data.length; i++) {
                const byte = Number.parseInt(data[i], 16);
                if (!(byte >= 0 && byte <= 0xff)) {
                    SpessaLog.warn(
                        `Invalid Web MIDI Link message: ${msg.data}`
                    );
                    return;
                }
                midiData[i - 1] = byte;
            }

            synth.sendMessage(midiData);
        };
        window.addEventListener("message", this.listener);

        SpessaLog.info(
            "%cWeb MIDI Link handler created!",
            ConsoleColors.recognized
        );
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Stops listening for Web MIDI Link messages.
     */
    public close() {
        window.removeEventListener("message", this.listener);
    }
}
