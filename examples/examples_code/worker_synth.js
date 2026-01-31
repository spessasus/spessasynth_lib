// Import the modules
import {
    audioBufferToWav,
    Sequencer,
    WorkerSynthesizer
} from "../../src/index.ts";
import { EXAMPLE_SOUND_BANK_PATH } from "../examples_common.js";

// Load the sound bank
const response = await fetch(EXAMPLE_SOUND_BANK_PATH);
// Load the sound bank into an array buffer
const sfBuffer = await response.arrayBuffer();
document.querySelector("#message").textContent = "Sound bank has been loaded!";

// Create the context and add audio worklet
const context = new AudioContext();
await WorkerSynthesizer.registerPlaybackWorklet(context);

// Create the worker
const worker = new Worker(new URL("worker_synth_worker.js", import.meta.url));
// Create the synthesizer and bind it to the worker
const synth = new WorkerSynthesizer(context, worker.postMessage.bind(worker));
worker.addEventListener("message", (event) =>
    synth.handleWorkerMessage(event.data)
);

// Add a button for rendering the audio
document.querySelector("#render").addEventListener("click", async () => {
    // Render audio with a simple progress tracking function
    const outputBuffer = await synth.renderAudio(44_100, {
        progressCallback: (progress, stage) => {
            document.querySelector("#message").textContent =
                `Rendering ${Math.floor(progress * 100)}% Stage: ${stage}`;
        }
    });
    document.querySelector("#message").textContent = "Complete!";
    // Convert the buffer to a wave file and create URL for it
    const wavFile = audioBufferToWav(outputBuffer[0]);
    const fileURL = URL.createObjectURL(wavFile);
    // Create an audio element and add it
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = fileURL;
    document.querySelectorAll(".example_content")[0].append(audio);
});

// Add a button for saving the SF2 file
document.querySelector("#save_sf2").addEventListener("click", async () => {
    const outputBuffer = await synth.writeSF2({
        trim: true,
        bankID: "main",
        progressFunction: (arguments_) => {
            document.querySelector("#message").textContent =
                `Saving sample "${arguments_.sampleName}" (${arguments_.sampleIndex} out of ${arguments_.sampleCount})...`;
        }
    });
    document.querySelector("#message").textContent = "Complete!";
    const blob = new Blob([outputBuffer.binary]);
    const fileURL = URL.createObjectURL(blob);

    // Add an anchor for downloading the file
    const a = document.createElement("a");
    a.href = fileURL;
    a.download = `${outputBuffer.fileName}.sf2`;
    a.textContent = "Download SF2";
    document.querySelectorAll(".example_content")[0].append(a);
    a.click();
});

// Add a button for saving the DLS file
document.querySelector("#save_dls").addEventListener("click", async () => {
    const outputBuffer = await synth.writeDLS({
        trim: true,
        bankID: "main",
        progressFunction: (arguments_) => {
            document.querySelector("#message").textContent =
                `Saving sample "${arguments_.sampleName}" (${arguments_.sampleIndex} out of ${arguments_.sampleCount})...`;
        }
    });
    document.querySelector("#message").textContent = "Complete!";
    const blob = new Blob([outputBuffer.binary]);
    const fileURL = URL.createObjectURL(blob);

    // Add an anchor for downloading the file
    const a = document.createElement("a");
    a.href = fileURL;
    a.download = `${outputBuffer.fileName}.dls`;
    a.textContent = "Download DLS";
    document.querySelectorAll(".example_content")[0].append(a);
    a.click();
});

// Add a button for saving the RMIDI file
document.querySelector("#save_rmi").addEventListener("click", async () => {
    const outputBuffer = await synth.writeRMIDI({
        trim: true,
        bankID: "main",
        progressFunction: (arguments_) => {
            document.querySelector("#message").textContent =
                `Saving sample "${arguments_.sampleName}" (${arguments_.sampleIndex} out of ${arguments_.sampleCount})...`;
        }
    });
    document.querySelector("#message").textContent = "Complete!";
    const blob = new Blob([outputBuffer]);
    const fileURL = URL.createObjectURL(blob);

    // Add an anchor for downloading the file
    const a = document.createElement("a");
    a.href = fileURL;
    a.download = `${seq.midiData.getName()}.rmi`;
    a.textContent = "Download RMIDI";
    document.querySelectorAll(".example_content")[0].append(a);
    a.click();
});

// The rest of the code works the same
synth.connect(context.destination);
await synth.isReady;
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
