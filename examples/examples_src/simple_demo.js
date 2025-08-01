// import the modules
import { Sequencer } from "../../src/sequencer/sequencer.js";
import { WorkletSynthesizer } from "../../src/synthetizer/synthetizer.js";
import {
    EXAMPLE_SOUNDFONT_PATH,
    EXAMPLE_WORKLET_PATH
} from "../examples_common.js";

// load the soundfont (your path may vary)
fetch(EXAMPLE_SOUNDFONT_PATH).then(async (response) => {
    // load the soundfont into an array buffer
    let soundFontArrayBuffer = await response.arrayBuffer();
    document.getElementById("message").innerText = "SoundFont has been loaded!";

    // add an event listener for the file inout
    document
        .getElementById("midi_input")
        .addEventListener("change", async (event) => {
            // check if any files are added
            if (!event.target.files[0]) {
                return;
            }
            const midiFile = await event.target.files[0].arrayBuffer(); // get the file and convert to ArrayBuffer
            const context = new AudioContext(); // create an audioContext
            await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH); // add the worklet
            const synth = new WorkletSynthesizer(
                context.destination,
                soundFontArrayBuffer
            ); // create the synthetizer
            const seq = new Sequencer([{ binary: midiFile }], synth); // create the sequencer
            seq.play();
        });
});
