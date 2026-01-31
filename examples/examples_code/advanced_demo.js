// Import the modules
import { Sequencer, WorkletSynthesizer } from "../../src/index.ts";
import {
    EXAMPLE_SOUND_BANK_PATH,
    EXAMPLE_WORKLET_PATH
} from "../examples_common.js"; // Load the sound bank

// Load the sound bank
const response = await fetch(EXAMPLE_SOUND_BANK_PATH);

// Load the sound bank into an array buffer
const sfBuffer = await response.arrayBuffer();
document.querySelector("#message").textContent = "Sound bank has been loaded!";

// Create the context and add audio worklet
const context = new AudioContext();
await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH);
const synth = new WorkletSynthesizer(context); // Create the synthesizer
synth.connect(context.destination);
await synth.soundBankManager.addSoundBank(sfBuffer, "main");
const seq = new Sequencer(synth);

// Add an event listener for the file inout
document
    .querySelector("#midi_input")
    .addEventListener("change", async (event) => {
        // Check if any files are added

        const target = /**  @type {HTMLInputElement}*/ event.target;
        if (target.files.length === 0) {
            return;
        }
        // Resume the context if paused
        await context.resume();
        // Parse all the files
        const parsedSongs = [];
        for (const file of target.files) {
            const buffer = await file.arrayBuffer();
            parsedSongs.push({
                binary: buffer, // Binary: the binary data of the file
                fileName: file.name // FileName: the fallback name if the MIDI doesn't have one. Here we set it to the file name
            });
        }
        seq.loadNewSongList(parsedSongs); // Load the song list
        seq.play(); // Play the midi

        // Make the slider move with the song
        const slider = document.querySelector("#progress");
        setInterval(() => {
            // Slider ranges from 0 to 1000
            slider.value = (seq.currentTime / seq.duration) * 1000;
        }, 100);

        // On song change, show the name
        seq.eventHandler.addEvent(
            "songChange",
            "example-time-change",
            (event) => {
                document.querySelector("#message").textContent =
                    "Now playing: " + event.getName();
            }
        ); // Make sure to add a unique id!

        // Add time adjustment
        slider.addEventListener("change", () => {
            // Calculate the time
            seq.currentTime = (slider.value / 1000) * seq.duration; // Switch the time (the sequencer adjusts automatically)
        });

        // Add button controls
        document.querySelector("#previous").addEventListener("click", () => {
            seq.songIndex--; // Go back by one song
        });

        // On pause click
        document.querySelector("#pause").addEventListener("click", () => {
            if (seq.paused) {
                document.querySelector("#pause").textContent = "Pause";
                seq.play(); // Resume
            } else {
                document.querySelector("#pause").textContent = "Resume";
                seq.pause(); // Pause
            }
        });
        document.querySelector("#next").addEventListener("click", () => {
            seq.songIndex++; // Go to the next song
        });
    });

// Make both objects accessible through the console
globalThis.synth = synth;
globalThis.seq = seq;
