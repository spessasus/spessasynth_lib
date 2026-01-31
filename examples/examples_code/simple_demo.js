// Import the modules
import { Sequencer, WorkletSynthesizer } from "../../src/index.js";
import {
    EXAMPLE_SOUND_BANK_PATH,
    EXAMPLE_WORKLET_PATH
} from "../examples_common.js";

// Load the sound bank (your path may vary)
const response = await fetch(EXAMPLE_SOUND_BANK_PATH);
// Load the sound bank into an array buffer
const sfFile = await response.arrayBuffer();
document.querySelector("#message").textContent = "Sound bank has been loaded!";

// Create an audioContext and add the worklet
const context = new AudioContext();
await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH);
// Create the synthesizer
const synth = new WorkletSynthesizer(context);
synth.connect(context.destination);
// Add the sound bank
await synth.soundBankManager.addSoundBank(sfFile, "main");
// Create the sequencer
const seq = new Sequencer(synth);

// Make it loop
seq.loopCount = Infinity;

// Add an event listener for the file inout
document
    .querySelector("#midi_input")
    .addEventListener("change", async (event) => {
        // Audio context may only be resumed after user interaction
        await context.resume();
        /**
         * Check if any files are added
         * @type {HTMLInputElement}
         */
        const input = event.target;
        if (!input.files[0]) {
            return;
        }
        const midiFile = await input.files[0].arrayBuffer(); // Get the file and convert to ArrayBuffer

        // Load a new song list and play
        seq.loadNewSongList([{ binary: midiFile }]);
        seq.play();
    });
