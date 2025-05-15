import { loadSoundFont, SpessaSynthProcessor } from "spessasynth_core";
import { FancyChorus } from "../../src/synthetizer/audio_effects/fancy_chorus.js";
import { getReverbProcessor } from "../../src/synthetizer/audio_effects/reverb.js";

// create the audio context
const context = new AudioContext({
    sampleRate: 44100
});

// wait for the user to upload the soundfont file
document.getElementById("soundfont_input").onchange = async e =>
{
    // verify that the file is uploaded
    const files = e.target?.files;
    if (!files[0])
    {
        return;
    }
    // resume the context and initialize the synthesizer with the uploaded sound bank
    await context.resume();
    const fontBuffer = await files[0].arrayBuffer();
    const synth = new SpessaSynthProcessor(44100, {
        initialTime: 0
    });
    synth.soundfontManager.reloadManager(loadSoundFont(fontBuffer));
    
    const chorusProcessor = new FancyChorus(context.destination);
    const reverbProcessor = getReverbProcessor(context).conv;
    reverbProcessor.connect(context.destination);
    
    setInterval(() =>
    {
        const synTime = synth.currentSynthTime;
        if (synTime > context.currentTime + 0.1)
        {
            return;
        }
        const BUFFER_SIZE = 512;
        const output = [new Float32Array(BUFFER_SIZE), new Float32Array(BUFFER_SIZE)];
        const reverb = [new Float32Array(BUFFER_SIZE), new Float32Array(BUFFER_SIZE)];
        const chorus = [new Float32Array(BUFFER_SIZE), new Float32Array(BUFFER_SIZE)];
        synth.renderAudio(output, reverb, chorus);
        const playAudio = (arr, output) =>
        {
            const outBuffer = new AudioBuffer({
                numberOfChannels: 2,
                length: 512,
                sampleRate: 44100
            });
            outBuffer.copyToChannel(arr[0], 0);
            outBuffer.copyToChannel(arr[1], 1);
            const source = new AudioBufferSourceNode(context, {
                buffer: outBuffer
            });
            source.connect(output);
            source.start(synTime);
        };
        playAudio(output, context.destination);
        playAudio(reverb, reverbProcessor);
        playAudio(chorus, chorusProcessor.input);
    });
    
    const list = document.getElementById("voice_list");
    /**
     * @type {HTMLPreElement[]}
     */
    const voiceListElements = [];
    for (let i = 0; i < 16; i++)
    {
        const el = document.createElement("pre");
        voiceListElements.push(el);
        list.appendChild(el);
    }
    setInterval(() =>
    {
        synth.midiAudioChannels.forEach((c, chanNum) =>
        {
            const channelList = voiceListElements[chanNum];
            let text = `Channel ${chanNum + 1}:\n`;
            c.voices.forEach(v =>
            {
                text += `note: ${v.midiNote}\n`;
            });
            channelList.textContent = text;
        });
    }, 100);
    
    navigator.requestMIDIAccess({
        sysex: true,
        software: true
    }).then(r =>
    {
        const midiSelect = document.getElementById("midi_input");
        for (const [id, input] of r.inputs)
        {
            const option = document.createElement("option");
            option.value = id;
            option.textContent = input.name;
            midiSelect.appendChild(option);
        }
        midiSelect.onchange = () =>
        {
            const targetId = midiSelect.value;
            for (const [id, input] of r.inputs)
            {
                if (id === targetId)
                {
                    console.log("listening on", input.name);
                    input.onmidimessage = e =>
                    {
                        synth.processMessage(e.data);
                    };
                }
                else
                {
                    input.onmidimessage = undefined;
                }
            }
        };
    });
};
    
    