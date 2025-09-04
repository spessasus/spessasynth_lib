// import the modules
import { audioBufferToWav, WorkletSynthesizer } from "../../src/index.ts";
import { EXAMPLE_WORKLET_PATH } from "../examples_common.js";
import { BasicMIDI } from "spessasynth_core";

/**
 * @type {ArrayBuffer}
 */
let sfFile = undefined;
/**
 * @type {BasicMIDI}
 */
let parsedMIDI = undefined;

document.getElementById("midi_input").onchange = async (event) => {
    /**
     * @type {HTMLInputElement}
     */
    const input = event.target;
    // check if any files are added
    if (!input.files[0]) {
        return;
    }
    // hide the input
    document.getElementById("midi_input").style.display = "none";
    const file = input.files[0];
    const buffer = await file.arrayBuffer();

    // parse the MIDI to get its duration
    parsedMIDI = BasicMIDI.fromArrayBuffer(buffer, file.name);
};

document.getElementById("sound_bank_input").onchange = async (event) => {
    /**
     * @type {HTMLInputElement}
     */
    const input = event.target;
    // check if any files are added
    if (!input.files[0]) {
        return;
    }
    // hide the input
    document.getElementById("sound_bank_input").style.display = "none";
    const file = input.files[0];
    sfFile = await file.arrayBuffer();
};

document.getElementById("render").onclick = async () => {
    // return if something hasn't been selected
    if (sfFile === undefined || parsedMIDI === undefined) {
        return;
    }

    // create the rendering context
    // hertz
    const sampleRate = 44100;
    const context = new OfflineAudioContext({
        // stereo
        numberOfChannels: 2,
        sampleRate: sampleRate,
        // sample rate times duration plus one second
        // (for the sound to fade away rather than cut)
        length: sampleRate * (parsedMIDI.duration + 1)
    });
    // add the worklet
    await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH);

    // here we disable the event system to as it's unnecessary
    const synth = new WorkletSynthesizer(context, {
        enableEffectsSystem: false
    });
    synth.connect(context.destination);

    // start the offline render
    await synth.startOfflineRender({
        soundBankList: [{ bankOffset: 0, soundBankBuffer: sfFile }],
        midiSequence: parsedMIDI,
        loopCount: 0
    });

    // await sf3 decoder
    await synth.isReady;

    // get the name
    const midiName = parsedMIDI.getName();

    // show progress
    const showRendering = setInterval(() => {
        const progress = Math.floor(
            (synth.currentTime / parsedMIDI.duration) * 100
        );
        document.getElementById("message").innerText =
            `Rendering "${midiName}"... ${progress}%`;
    }, 500);

    // start rendering the audio
    const outputBuffer = await context.startRendering();
    clearInterval(showRendering);

    document.getElementById("message").innerText = "Complete!";
    // convert the buffer to a wave file and create URL for it
    const wavFile = audioBufferToWav(outputBuffer);
    const fileURL = URL.createObjectURL(wavFile);
    // create an audio element and add it
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = fileURL;
    document.getElementsByClassName("example_content")[0].appendChild(audio);

    // make the browser download the file
    const a = document.createElement("a");
    a.href = fileURL;
    a.download = midiName + ".wav";
    a.click();
};
