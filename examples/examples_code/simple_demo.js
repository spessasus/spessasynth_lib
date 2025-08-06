// import the modules
import { Sequencer, WorkletSynthesizer } from "../../src/index.js";
import {
    EXAMPLE_SOUND_BANK_PATH,
    EXAMPLE_WORKLET_PATH
} from "../examples_common.js";

// load the sound bank (your path may vary)
fetch(EXAMPLE_SOUND_BANK_PATH).then(async (response) => {
    // load the sound bank into an array buffer
    let sfFile = await response.arrayBuffer();
    document.getElementById("message").innerText =
        "Sound bank has been loaded!";

    // add an event listener for the file inout
    document
        .getElementById("midi_input")
        .addEventListener("change", async (event) => {
            // check if any files are added
            if (!event.target.files[0]) {
                return;
            }
            const midiFile = await event.target.files[0].arrayBuffer(); // get the file and convert to ArrayBuffer
            // create an audioContext
            const context = new AudioContext();
            // add the worklet
            await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH);
            // create the synthesizer
            const synth = new WorkletSynthesizer(context.destination);
            // add the sound bank
            await synth.soundBankManager.addSoundBank(sfFile, "main");
            // create the sequencer
            const seq = new Sequencer(synth);

            // make it loop
            seq.loopCount = Infinity;

            // load a new song list and play
            seq.loadNewSongList([{ binary: midiFile }]);
            seq.play();
        });
});
