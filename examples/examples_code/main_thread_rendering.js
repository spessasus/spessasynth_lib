import {
    BasicMIDI,
    SoundBankLoader,
    SpessaSynthProcessor,
    SpessaSynthSequencer
} from "spessasynth_core";
import { ChorusProcessor, ReverbProcessor } from "../../src/index.ts"; // This demo shows how to render in the main thread in real time

// This demo shows how to render in the main thread in real time
// Use firefox for this, chromium poorly handles audio buffers being used like this
// For chromium, consider making a simple playback worklet processor instead

// Create a new audio context
const context = new AudioContext({
    sampleRate: 44_100
});

// Wait for the user to upload the sound bank
document
    .querySelector("#sound_bank_input")
    .addEventListener("change", async (event) => {
        /**
         * If no file is selected, exit early
         * @type {FileList}
         */
        const files = event.target?.files;
        if (!files[0]) {
            return;
        }

        // Resume the audio context so audio processing can begin
        await context.resume();

        // Read the uploaded file into an ArrayBuffer
        const fontBuffer = await files[0].arrayBuffer();

        // Create an instance of the synthesizer and load it with the sound bank
        const synth = new SpessaSynthProcessor(44_100);
        synth.soundBankManager.addSoundBank(
            SoundBankLoader.fromArrayBuffer(fontBuffer),
            "main"
        );

        // Initialize the sequencer for MIDI playback
        const seq = new SpessaSynthSequencer(synth);

        // Initialize the audio effects and connect them to the destination
        const chorusProcessor = new ChorusProcessor(context);
        const reverbProcessor = new ReverbProcessor(context);
        reverbProcessor.connect(context.destination);
        chorusProcessor.connect(context.destination);

        // THE MAIN AUDIO RENDERING LOOP IS HERE
        setInterval(() => {
            // Get the synthesizer’s internal current time
            const synTime = synth.currentSynthTime;

            // If the synth time is significantly ahead of the context time, skip rendering
            // (wait for the context to catch up)
            if (synTime > context.currentTime + 0.1) {
                return;
            }

            // Create empty stereo buffers for dry signal, reverb, and chorus outputs
            const QUANTUM = 128;
            const BUFFER_SIZE = 2048;
            const output = [
                new Float32Array(BUFFER_SIZE),
                new Float32Array(BUFFER_SIZE)
            ];
            const reverb = [
                new Float32Array(BUFFER_SIZE),
                new Float32Array(BUFFER_SIZE)
            ];
            const chorus = [
                new Float32Array(BUFFER_SIZE),
                new Float32Array(BUFFER_SIZE)
            ];
            let rendered = 0;
            while (rendered < BUFFER_SIZE) {
                // Play back the MIDI file
                seq.processTick();

                // Render the next chunk of audio into the provided buffers
                synth.renderAudio(output, reverb, chorus, rendered, QUANTUM);
                rendered += QUANTUM;
            }

            // Function to play a given stereo buffer to a specified output node
            const playAudio = (array, output) => {
                // Create an AudioBuffer to hold the sample data
                const outBuffer = new AudioBuffer({
                    numberOfChannels: 2,
                    length: BUFFER_SIZE,
                    sampleRate: 44_100
                });

                // Copy the left and right channel data into the audio buffer
                outBuffer.copyToChannel(array[0], 0);
                outBuffer.copyToChannel(array[1], 1);

                // Create a source node from the buffer and connect it to the desired output
                const source = new AudioBufferSourceNode(context, {
                    buffer: outBuffer
                });
                source.connect(output);

                // Schedule the buffer to play at the synth’s current time
                source.start(synTime);
            };

            // Play the dry audio to the main output
            playAudio(output, context.destination);

            // Play the reverb signal through the reverb effect chain
            playAudio(reverb, reverbProcessor.input);

            // Play the chorus signal through the chorus processor’s input
            playAudio(chorus, chorusProcessor.input);
        });

        // List all the voices currently playing
        const list = document.querySelector("#voice_list");
        /**
         * @type {HTMLPreElement[]}
         * create and store a <pre> element for each of the 16 MIDI channels
         * each one will be used to display information about active voices on a given channel
         */
        const voiceListElements = [];
        for (let index = 0; index < 16; index++) {
            const element = document.createElement("pre");
            voiceListElements.push(element);
            list.append(element);
        }
        // Set up an interval to regularly update the voice display for each channel
        setInterval(() => {
            // Note: this code is working directly with the synth engine.
            // Advanced users only.
            const core = synth.midiChannels[0].synthCore;

            // Start building the display string with the channel number
            const textData = voiceListElements.map(
                (_, chanNumber) => `Channel ${chanNumber + 1}:\n`
            );
            for (const voice of core.voices) {
                if (!voice.isActive) continue;

                // Get the corresponding element for this channel

                // Append a line for each currently active voice with its MIDI note
                textData[voice.channel] += `note: ${voice.midiNote}\n`;
            }

            for (const [
                index,
                voiceListElement
            ] of voiceListElements.entries()) {
                voiceListElement.textContent = textData[index];
            }
        }, 100);

        // Set up the MIDI player
        document
            .querySelector("#midi_input")
            .addEventListener("change", async (event) => {
                // Verify if the file is really there
                if (!event.target?.files[0]) {
                    return;
                }
                // Parse and play the file
                const file = event.target.files[0];
                const midi = BasicMIDI.fromArrayBuffer(
                    await file.arrayBuffer()
                );
                seq.loadNewSongList([midi]);
                seq.play();
            });
    });
