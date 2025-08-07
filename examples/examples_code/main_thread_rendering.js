import {
    BasicMIDI,
    SoundBankLoader,
    SpessaSynthProcessor,
    SpessaSynthSequencer
} from "spessasynth_core";
import { ChorusProcessor, ReverbProcessor } from "../../src/index.ts"; // this demo shows how to render in the main thread in real time

// this demo shows how to render in the main thread in real time
// use firefox for this, chromium poorly handles audio buffers being used like this
// for chromium, consider making a simple playback worklet processor instead

// create a new audio context
const context = new AudioContext({
    sampleRate: 44100
});

// wait for the user to upload the sound bank
document.getElementById("sound_bank_input").onchange = async (e) => {
    /**
     * if no file is selected, exit early
     * @type {FileList}
     */
    const files = e.target?.files;
    if (!files[0]) {
        return;
    }

    // resume the audio context so audio processing can begin
    await context.resume();

    // read the uploaded file into an ArrayBuffer
    const fontBuffer = await files[0].arrayBuffer();

    // create an instance of the synthesizer and load it with the sound bank
    const synth = new SpessaSynthProcessor(44100);
    synth.soundBankManager.addSoundBank(
        SoundBankLoader.fromArrayBuffer(fontBuffer),
        "main"
    );

    // initialize the sequencer for MIDI playback
    const seq = new SpessaSynthSequencer(synth);

    // initialize the audio effects and connect them to the destination
    const chorusProcessor = new ChorusProcessor(context);
    const reverbProcessor = new ReverbProcessor(context);
    reverbProcessor.connect(context.destination);
    chorusProcessor.connect(context.destination);

    // THE MAIN AUDIO RENDERING LOOP IS HERE
    setInterval(() => {
        // get the synthesizer’s internal current time
        const synTime = synth.currentSynthTime;

        // if the synth time is significantly ahead of the context time, skip rendering
        // (wait for the context to catch up)
        if (synTime > context.currentTime + 0.1) {
            return;
        }

        // create empty stereo buffers for dry signal, reverb, and chorus outputs
        const BUFFER_SIZE = 512;
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

        // play back the MIDI file
        seq.processTick();

        // render the next chunk of audio into the provided buffers
        synth.renderAudio(output, reverb, chorus);

        // function to play a given stereo buffer to a specified output node
        const playAudio = (arr, output) => {
            // create an AudioBuffer to hold the sample data
            const outBuffer = new AudioBuffer({
                numberOfChannels: 2,
                length: 512,
                sampleRate: 44100
            });

            // copy the left and right channel data into the audio buffer
            outBuffer.copyToChannel(arr[0], 0);
            outBuffer.copyToChannel(arr[1], 1);

            // create a source node from the buffer and connect it to the desired output
            const source = new AudioBufferSourceNode(context, {
                buffer: outBuffer
            });
            source.connect(output);

            // schedule the buffer to play at the synth’s current time
            source.start(synTime);
        };

        // play the dry audio to the main output
        playAudio(output, context.destination);

        // play the reverb signal through the reverb effect chain
        playAudio(reverb, reverbProcessor.input);

        // play the chorus signal through the chorus processor’s input
        playAudio(chorus, chorusProcessor.input);
    });

    // list all the voices currently playing
    const list = document.getElementById("voice_list");
    /**
     * @type {HTMLPreElement[]}
     * create and store a <pre> element for each of the 16 MIDI channels
     * each one will be used to display information about active voices on a given channel
     */
    const voiceListElements = [];
    for (let i = 0; i < 16; i++) {
        const el = document.createElement("pre");
        voiceListElements.push(el);
        list.appendChild(el);
    }
    // set up an interval to regularly update the voice display for each channel
    setInterval(() => {
        // loop through each MIDI channel in the synth
        synth.midiChannels.forEach((c, chanNum) => {
            // get the corresponding element for this channel
            const channelList = voiceListElements[chanNum];

            // start building the display string with the channel number
            let text = `Channel ${chanNum + 1}:\n`;

            // append a line for each currently active voice with its MIDI note
            c.voices.forEach((v) => {
                text += `note: ${v.midiNote}\n`;
            });

            // update the DOM with the new voice info
            channelList.textContent = text;
        });
    }, 100);

    // set up the MIDI player
    document.getElementById("midi_input").onchange = async (e) => {
        // verify if the file is really there
        if (!e.target?.files[0]) {
            return;
        }
        // parse and play the file
        const file = e.target.files[0];
        const midi = BasicMIDI.fromArrayBuffer(await file.arrayBuffer());
        seq.loadNewSongList([midi]);
        seq.play();
    };
};
