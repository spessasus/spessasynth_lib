# Direct Audio Engine Access

!!! Caution
> This is for the advanced users only.

!!! Info

    This demo only runs well in Firefox.
    Chrome seems to have trouble with AudioBufferSourceNodes.
    
    It is recommended to use a simple playback Audio Worklet such as [this one](https://github.com/spessasus/SpessaFont/blob/1b6e034cfefa2f964efc7cba5838a42ee26fcb0f/public/audio_worklet.js).

Sometimes, it is necessary for the script to have direct access to the synthesizer's audio engine for various reasons.
While one can use `spesasynth_core` directly, this will require implementing the audio effects manually.

This page is intended to show how to use both `spessasynth_core` and `spessasynth_lib` to maintain full feature set of the `Synthesizer` class,
 while rendering in the main thread and having the full access to the audio engine.
 
### General Approach
`spessasynth_lib` exposes both audio processors, allowing us to connect them to the synthesizer directly.

A simple audio loop that achieves this is as follows:
1. Create the `Float32Array` buffers for the dry, chorus and reverb outputs.
2. Perform any custom tasks needed and then render the audio
3. Send the processed audio to playback nodes, like a custom audio worklet or `AudioBufferSourceNode`s
4. The node/s play back to the target node and the effect processors (three `BufferSource`s for three nodes)
5. The effects are connected to the target node as well, so they process the audio as needed

## Showing voice list example

### [See this demo live](https://spessasus.github.io/spessasynth_lib/examples/main_thread_rendering.html)

Below is an example that shows the list of active voices currently playing,
which is something that cannot be achieved with just the `Synthetizer` class.

#### main_thread_rendering.html
Nothing special here.
```html
<label for='soundfont_input'>Upload the soundfont.</label>
<input accept='.sf2, .sf3, .dls' id='soundfont_input' type='file'>
<label for='midi_input'>Select the MIDI file</label>
<input accept='.midi, .mid, .rmi, .smf' id='midi_input' type='file'>
<h2>Voice list</h2>
<div id='voice_list' style='display: flex; width: 100%; justify-content: space-evenly'></div>
<!-- note the type="module" -->
<script src='main_thread_rendering.js' type='module'></script>
```

#### main_thread_rendering.js

The audio loop presented in this script is very similar to the one shown above:
1. Make sure that the synthesizer is not too far ahead
2. Create the buffers
3. Process the MIDI playback and render audio
4. Create buffer sources and play back the rendered chunks through them

There is another loop that displays all the voices. It is independent of the audio loop.

```js
import { loadSoundFont, MIDI, SpessaSynthProcessor, SpessaSynthSequencer } from "spessasynth_core";
import { FancyChorus } from "../../src/synthetizer/audio_effects/fancy_chorus.js";
import { getReverbProcessor } from "../../src/synthetizer/audio_effects/reverb.js";

// create a new audio context
const context = new AudioContext({
    sampleRate: 44100
});

// wait for the user to upload the sound bank
document.getElementById("soundfont_input").onchange = async e =>
{
    // if no file is selected, exit early
    const files = e.target?.files;
    if (!files[0])
    {
        return;
    }
    
    // resume the audio context so audio processing can begin
    await context.resume();
    
    // read the uploaded file into an ArrayBuffer
    const fontBuffer = await files[0].arrayBuffer();
    
    // create an instance of the synthesizer and load it with the sound bank
    const synth = new SpessaSynthProcessor(44100);
    synth.soundfontManager.reloadManager(loadSoundFont(fontBuffer));
    
    // initialize the sequencer for MIDI playback
    const seq = new SpessaSynthSequencer(synth);
    
    // initialize the audio effects and connect them to the destination
    const chorusProcessor = new FancyChorus(context.destination);
    const reverbProcessor = getReverbProcessor(context).conv;
    reverbProcessor.connect(context.destination);
    
    // THE MAIN AUDIO RENDERING LOOP IS HERE
    setInterval(() =>
    {
        // get the synthesizer’s internal current time
        const synTime = synth.currentSynthTime;
        
        // if the synth time is significantly ahead of the context time, skip rendering
        // (wait for the context to catch up)
        if (synTime > context.currentTime + 0.1)
        {
            return;
        }
        
        // create empty stereo buffers for dry signal, reverb, and chorus outputs
        const BUFFER_SIZE = 512;
        const output = [new Float32Array(BUFFER_SIZE), new Float32Array(BUFFER_SIZE)];
        const reverb = [new Float32Array(BUFFER_SIZE), new Float32Array(BUFFER_SIZE)];
        const chorus = [new Float32Array(BUFFER_SIZE), new Float32Array(BUFFER_SIZE)];
        
        // play back the MIDI file
        seq.processTick();
        
        // render the next chunk of audio into the provided buffers
        synth.renderAudio(output, reverb, chorus);
        
        // function to play a given stereo buffer to a specified output node
        const playAudio = (arr, output) =>
        {
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
        playAudio(reverb, reverbProcessor);
        
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
    for (let i = 0; i < 16; i++)
    {
        const el = document.createElement("pre");
        voiceListElements.push(el);
        list.appendChild(el);
    }
    // set up an interval to regularly update the voice display for each channel
    setInterval(() =>
    {
        // loop through each MIDI channel in the synth
        synth.midiAudioChannels.forEach((c, chanNum) =>
        {
            // get the corresponding element for this channel
            const channelList = voiceListElements[chanNum];
            
            // start building the display string with the channel number
            let text = `Channel ${chanNum + 1}:\n`;
            
            // append a line for each currently active voice with its MIDI note
            c.voices.forEach(v =>
            {
                text += `note: ${v.midiNote}\n`;
            });
            
            // update the DOM with the new voice info
            channelList.textContent = text;
        });
    }, 100);
    
    // set up the MIDI player
    document.getElementById("midi_input").onchange = async e =>
    {
        // verify if the file is really there
        if (!e.target?.files[0])
        {
            return;
        }
        // parse and play the file
        const file = e.target.files[0];
        const midi = new MIDI(await file.arrayBuffer());
        seq.loadNewSongList([midi]);
        seq.play();
    };
};

```