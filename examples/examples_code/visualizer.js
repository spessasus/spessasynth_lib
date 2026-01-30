// Import the modules
import { Sequencer, WorkletSynthesizer } from "../../src/index.js";
import {
    EXAMPLE_SOUND_BANK_PATH,
    EXAMPLE_WORKLET_PATH
} from "../examples_common.js";

// Add different colors to channels!
const channelColors = [
    "rgba(255, 99, 71, 1)", // Tomato
    "rgba(255, 165, 0, 1)", // Orange
    "rgba(255, 215, 0, 1)", // Gold
    "rgba(50, 205, 50, 1)", // Limegreen
    "rgba(60, 179, 113, 1)", // Mediumseagreen
    "rgba(0, 128, 0, 1)", // Green
    "rgba(0, 191, 255, 1)", // Deepskyblue
    "rgba(65, 105, 225, 1)", // Royalblue
    "rgba(138, 43, 226, 1)", // Blueviolet
    "rgba(50, 120, 125, 1)", // Percussion color
    "rgba(255, 0, 255, 1)", // Magenta
    "rgba(255, 20, 147, 1)", // Deeppink
    "rgba(218, 112, 214, 1)", // Orchid
    "rgba(240, 128, 128, 1)", // Lightcoral
    "rgba(255, 192, 203, 1)", // Pink
    "rgba(255, 255, 0, 1)" // Yellow
];

// Adjust this to your liking
const VISUALIZER_GAIN = 2;

// Create a keyboard
const keyboard = document.querySelector("#keyboard");
// Create an array of 128 keys
const keys = [];
for (let index = 0; index < 128; index++) {
    const key = document.createElement("td");
    key.style.width = "5px";
    key.style.height = "50px";
    key.style.border = "solid black 1px";
    keyboard.append(key);
    keys.push(key);
}

// Load the sound bank
const response = await fetch(EXAMPLE_SOUND_BANK_PATH);
// Load the sound bank into an array buffer
const sfFile = await response.arrayBuffer();
document.querySelector("#message").textContent = "Sound bank has been loaded!";

// Create the context and add audio worklet
const context = new AudioContext();
await context.audioWorklet.addModule(EXAMPLE_WORKLET_PATH);
// Create the synthesizer
const synth = new WorkletSynthesizer(context);
synth.connect(context.destination);
await synth.soundBankManager.addSoundBank(sfFile, "main");
const seq = new Sequencer(synth);

// Add an event listener for the file inout
document
    .querySelector("#midi_input")
    .addEventListener("change", async (event) => {
        // Check if any files are added
        /**
         * @type {File}
         */
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        await context.resume();
        const midiFile = await file.arrayBuffer(); // Convert the file to array buffer
        seq.loadNewSongList([{ binary: midiFile, fileName: file.name }]);
        seq.play();

        /**
         * @type {HTMLCanvasElement}
         */
        const canvas = document.querySelector("#canvas"); // Get canvas
        const drawingContext = canvas.getContext("2d");
        /**
         * Create the AnalyserNodes for the channels
         */
        const analysers = [];
        for (let index = 0; index < 16; index++) {
            analysers.push(context.createAnalyser()); // Create analyzer
        }

        // Connect them to the synthesizer
        synth.connectIndividualOutputs(analysers);

        // Render analyzers in a 4x4 grid
        function render() {
            // Clear the rectangle
            drawingContext.clearRect(0, 0, canvas.width, canvas.height);
            for (const [channelIndex, analyser] of analysers.entries()) {
                // Calculate positions
                const width = canvas.width / 4;
                const height = canvas.height / 4;
                const step = width / analyser.frequencyBinCount;
                const x = width * (channelIndex % 4); // ChannelIndex % 4 gives us 0 to 2 range
                const y = height * Math.floor(channelIndex / 4) + height / 2;

                // Get the data from analyzer
                const waveData = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatTimeDomainData(waveData);
                // Set the color
                drawingContext.strokeStyle =
                    channelColors[channelIndex % channelColors.length];
                // Draw the waveform
                drawingContext.moveTo(x, y);
                drawingContext.beginPath();
                for (const [index, waveDatum] of waveData.entries()) {
                    drawingContext.lineTo(
                        x + step * index,
                        y + waveDatum * height * VISUALIZER_GAIN
                    );
                }
                drawingContext.stroke();
            }

            // Draw again
            requestAnimationFrame(render);
        }

        render();

        // Add listeners to show keys being pressed
        // Add note on listener
        synth.eventHandler.addEvent(
            "noteOn",
            "demo-keyboard-note-on",
            (event) => {
                keys[event.midiNote].style.background =
                    channelColors[event.channel % channelColors.length];
            }
        );

        // Add note off listener
        synth.eventHandler.addEvent(
            "noteOff",
            "demo-keyboard-note-off",
            (event) => {
                keys[event.midiNote].style.background = "";
            }
        );

        // Add stop-all listener
        synth.eventHandler.addEvent("stopAll", "demo-keyboard-stop-all", () => {
            for (const key of keys) key.style.background = "";
        });
    });
