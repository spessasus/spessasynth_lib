// import the modules
import { Sequencer, WorkletSynthesizer } from "../../src/index.ts";
import {
    EXAMPLE_SOUND_BANK_PATH,
    EXAMPLE_WORKLET_PATH
} from "../examples_common.js";

// load the sound bank
fetch(EXAMPLE_SOUND_BANK_PATH).then(async (response) => {
    // load the sound bank into an array buffer
    let sfBuffer = await response.arrayBuffer();
    document.getElementById("message").innerText =
        "Sound bank has been loaded!";

    // create the context and add audio worklet
    const context = new AudioContext();
    await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH);
    const synth = new WorkletSynthesizer(context); // create the synthesizer
    synth.connect(context.destination);
    await synth.soundBankManager.addSoundBank(sfBuffer, "main");
    let seq = new Sequencer(synth);

    // add an event listener for the file inout
    document
        .getElementById("midi_input")
        .addEventListener("change", async (event) => {
            // check if any files are added

            const target = /**  @type {HTMLInputElement}*/ event.target;
            if (target.files.length < 1) {
                return;
            }
            // resume the context if paused
            await context.resume();
            // parse all the files
            const parsedSongs = [];
            for (let file of target.files) {
                const buffer = await file.arrayBuffer();
                parsedSongs.push({
                    binary: buffer, // binary: the binary data of the file
                    altName: file.name // fileName: the fallback name if the MIDI doesn't have one. Here we set it to the file name
                });
            }
            seq.loadNewSongList(parsedSongs); // load the song list
            seq.play(); // play the midi

            // make the slider move with the song
            let slider = document.getElementById("progress");
            setInterval(() => {
                // slider ranges from 0 to 1000
                slider.value = (seq.currentTime / seq.duration) * 1000;
            }, 100);

            // on song change, show the name
            seq.eventHandler.addEvent(
                "songChange",
                "example-time-change",
                (e) => {
                    document.getElementById("message").innerText =
                        "Now playing: " + e.getName();
                }
            ); // make sure to add a unique id!

            // add time adjustment
            slider.onchange = () => {
                // calculate the time
                seq.currentTime = (slider.value / 1000) * seq.duration; // switch the time (the sequencer adjusts automatically)
            };

            // add button controls
            document.getElementById("previous").onclick = () => {
                seq.songIndex--; // go back by one song
            };

            // on pause click
            document.getElementById("pause").onclick = () => {
                if (seq.paused) {
                    document.getElementById("pause").innerText = "Pause";
                    seq.play(); // resume
                } else {
                    document.getElementById("pause").innerText = "Resume";
                    seq.pause(); // pause
                }
            };
            document.getElementById("next").onclick = () => {
                seq.songIndex++; // go to the next song
            };
        });
});
