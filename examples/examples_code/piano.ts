// Import the modules
import { WorkletSynthesizer } from "../../src";
import { EXAMPLE_WORKLET_PATH } from "../examples_common.ts";

document
    .querySelector("#sound_bank_input")!
    .addEventListener("change", async (event) => {
        const input = event.target as HTMLInputElement;
        // Check if there's a file uploaded
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        const sfFile = await file.arrayBuffer(); // Convert to array buffer
        // Create the context and add audio worklet
        const context = new AudioContext();
        await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH);
        // Create the synthesizer
        const synth = new WorkletSynthesizer(context);
        synth.connect(context.destination);
        await synth.isReady;
        await synth.soundBankManager.addSoundBank(sfFile, "main");
        // Create a 36-key piano
        const piano = document.querySelector("#piano")!;
        for (let index = 0; index < 36; index++) {
            const key = document.createElement("td");
            key.style.background = "white";
            key.style.height = "10em";
            key.style.width = "2em";
            key.style.margin = "0.2em";
            piano.append(key);
            // Add mouse events
            key.addEventListener("pointerdown", () => {
                // Key press: play a note
                synth.noteOn(0, 46 + index, 127);
                key.style.background = "red";
            });
            key.addEventListener("pointerup", () => {
                // Key release: stop a note
                synth.noteOff(0, 46 + index);
                key.style.background = "white";
            });
            key.addEventListener("pointerleave", (event) => {
                key.onpointerup?.(event);
            });
        }
    });
