// import the modules
import {
    audioBufferToWav,
    Sequencer,
    WorkerSynthesizer
} from "../../src/index.ts";
import { EXAMPLE_SOUND_BANK_PATH } from "../examples_common.js";

// load the sound bank
fetch(EXAMPLE_SOUND_BANK_PATH).then(async (response) => {
    // load the sound bank into an array buffer
    let sfBuffer = await response.arrayBuffer();
    document.getElementById("message").innerText =
        "Sound bank has been loaded!";

    // create the context and add audio worklet
    const context = new AudioContext();
    await WorkerSynthesizer.registerPlaybackWorklet(context);

    // create the worker
    const worker = new Worker(
        new URL("worker_synth_worker.js", import.meta.url)
    );
    // create the synthesizer and bind it to the worker
    const synth = new WorkerSynthesizer(
        context,
        worker.postMessage.bind(worker)
    );
    worker.onmessage = (ev) => synth.handleWorkerMessage(ev.data);

    // add a button for rendering the audio
    document.getElementById("render").onclick = async () => {
        // Render audio with a simple progress tracking function
        const outputBuffer = await synth.renderAudio(44100, {
            progressCallback: (progress, stage) => {
                document.getElementById("message").innerText =
                    `Rendering ${Math.floor(progress * 100)}% Stage: ${stage}`;
            }
        });
        document.getElementById("message").innerText = "Complete!";
        // convert the buffer to a wave file and create URL for it
        const wavFile = audioBufferToWav(outputBuffer[0]);
        const fileURL = URL.createObjectURL(wavFile);
        // create an audio element and add it
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = fileURL;
        document
            .getElementsByClassName("example_content")[0]
            .appendChild(audio);
    };

    // add a button for saving the SF2 file
    document.getElementById("save_sf2").onclick = async () => {
        const outputBuffer = await synth.writeSF2({
            trim: true,
            bankID: "main",
            progressFunction: (args) => {
                document.getElementById("message").innerText =
                    `Saving sample "${args.sampleName}" (${args.sampleIndex} out of ${args.sampleCount})...`;
            }
        });
        document.getElementById("message").innerText = "Complete!";
        const blob = new Blob([outputBuffer.binary]);
        const fileURL = URL.createObjectURL(blob);

        // add an anchor for downloading the file
        const a = document.createElement("a");
        a.href = fileURL;
        a.download = `${outputBuffer.bankName}.sf2`;
        a.textContent = "Download SF2";
        document.getElementsByClassName("example_content")[0].appendChild(a);
        a.click();
    };

    // add a button for saving the DLS file
    document.getElementById("save_dls").onclick = async () => {
        const outputBuffer = await synth.writeDLS({
            trim: true,
            bankID: "main",
            progressFunction: (args) => {
                document.getElementById("message").innerText =
                    `Saving sample "${args.sampleName}" (${args.sampleIndex} out of ${args.sampleCount})...`;
            }
        });
        document.getElementById("message").innerText = "Complete!";
        const blob = new Blob([outputBuffer.binary]);
        const fileURL = URL.createObjectURL(blob);

        // add an anchor for downloading the file
        const a = document.createElement("a");
        a.href = fileURL;
        a.download = `${outputBuffer.bankName}.dls`;
        a.textContent = "Download DLS";
        document.getElementsByClassName("example_content")[0].appendChild(a);
        a.click();
    };

    // the rest of the code works the same
    synth.connect(context.destination);
    await synth.isReady;
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
                    altName: file.name // altName: the fallback name if the MIDI doesn't have one. Here we set it to the file name
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
