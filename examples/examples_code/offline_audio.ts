// Import the modules
import { audioBufferToWav, WorkletSynthesizer } from "../../src";
import { EXAMPLE_WORKLET_PATH } from "../examples_common.ts";
import { BasicMIDI } from "spessasynth_core";

let sfFile: ArrayBuffer;
let parsedMIDI: BasicMIDI;

document
    .querySelector("#midi_input")!
    .addEventListener("change", async (event) => {
        const input = event.target as HTMLInputElement;
        // Check if any files are added
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        // Hide the input
        input.style.display = "none";
        const buffer = await file.arrayBuffer();

        // Parse the MIDI to get its duration
        parsedMIDI = BasicMIDI.fromArrayBuffer(buffer, file.name);
    });

document
    .querySelector("#sound_bank_input")!
    .addEventListener("change", async (event) => {
        const input = event.target as HTMLInputElement;
        // Check if any files are added
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        // Hide the input
        input.style.display = "none";
        sfFile = await file.arrayBuffer();
    });

document.querySelector("#render")!.addEventListener("click", async () => {
    // Return if something hasn't been selected
    if (sfFile === undefined || parsedMIDI === undefined) {
        return;
    }

    // Create the rendering context
    // Hertz
    const sampleRate = 44_100;
    const context = new OfflineAudioContext({
        // Stereo
        numberOfChannels: 2,
        sampleRate: sampleRate,
        // Sample rate times duration plus one second
        // (for the sound to fade away rather than cut)
        length: sampleRate * (parsedMIDI.duration + 1)
    });
    // Add the worklet
    await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH);

    // Here we disable the event system to as it's unnecessary
    const synth = new WorkletSynthesizer(context, {
        eventsEnabled: false
    });
    synth.connect(context.destination);

    // Start the offline render
    await synth.startOfflineRender({
        soundBankList: [{ bankOffset: 0, soundBankBuffer: sfFile }],
        midiSequence: parsedMIDI,
        loopCount: 0
    });

    // Await sf3 decoder
    await synth.isReady;

    // Get the name
    const midiName = parsedMIDI.getName();

    // Show progress
    const showRendering = setInterval(() => {
        const progress = Math.floor(
            (synth.currentTime / parsedMIDI.duration) * 100
        );
        document.querySelector("#message")!.textContent =
            `Rendering "${midiName}"... ${progress}%`;
    }, 500);

    // Start rendering the audio
    const outputBuffer = await context.startRendering();
    clearInterval(showRendering);

    document.querySelector("#message")!.textContent = "Complete!";
    // Convert the buffer to a wave file and create URL for it
    const wavFile = audioBufferToWav(outputBuffer);
    const fileURL = URL.createObjectURL(wavFile);
    // Create an audio element and add it
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = fileURL;
    document.querySelectorAll(".example_content")[0].append(audio);

    // Make the browser download the file
    const a = document.createElement("a");
    a.href = fileURL;
    a.download = midiName + ".wav";
    a.click();
});
