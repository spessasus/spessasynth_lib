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

    // create an audioContext and add the worklet
    const context = new AudioContext();
    await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH);
    // create the synthesizer
    const synth = new WorkletSynthesizer(context);
    synth.connect(context.destination);
    // add the sound bank
    await synth.soundBankManager.addSoundBank(sfFile, "main");
    // create the sequencer
    const seq = new Sequencer(synth);

    // make it loop
    seq.loopCount = Infinity;

    // add an event listener for the file inout
    document
        .getElementById("midi_input")
        .addEventListener("change", async (event) => {
            // audio context may only be resumed after user interaction
            await context.resume();
            /**
             * check if any files are added
             * @type {HTMLInputElement}
             */
            const input = event.target;
            if (!input.files[0]) {
                return;
            }
            const midiFile = await input.files[0].arrayBuffer(); // get the file and convert to ArrayBuffer

            // load a new song list and play
            seq.loadNewSongList([{ binary: midiFile }]);
            seq.play();
        });
});
