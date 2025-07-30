# Getting Started with SpessaSynth
!!! TIP

    If you encounter any errors in this documentation, please **open an issue!**

## spessasynth_lib vs spessasynth_core
There are two similar libraries: `spessasynth_lib` and `spessasynth_core`:

- core is the main library that contains all MIDI, SF2,DLS parsing and synthesis engine. It can run in any JS environment.
- lib builds on top of core,
relying on the WebAudioAPI to add an easy-to-use wrapper and brings default effect processors along.
It is dependent on core, so all writing and conversion features can be used directly from core.

So:

### Use spessasynth_lib if:
- You want to play MIDI files in the browser without much work
- You don't want to have to program your own audio processor
- The default effects are good enough for you
- You don't need direct access to the audio engine

### Use spessasynth_core if:
- You want [direct audio engine access](../synthesizer/direct-audio-engine-access.md)
- You want custom effect processors
- You need full control over the audio
- You don't have access to the WebAudioAPI


## Installation
```shell
npm install --save spessasynth_lib
```

!!! Warning

    I might forget to add a method to the npm's index.js, which results with it not being importable.
    If that happens, **please open an issue.**

## Minimal setup
The minimal working setup requires [`Synthetizer` class](../synthesizer/index.md) and [adding the worklet module](../synthesizer/importing-the-worklet.md).

The setup is initialized as follows:
```js
audioContext.audioWorklet.addModule("path/to/worklet");
const synth = new Synthetizer(outputNode, soundFontBuffer);
```
Make sure to replace `/path/to/worklet/` with one of the paths described [here](../synthesizer/importing-the-worklet.md).

## Examples

!!! Tip

    These examples point to a random sound bank path. Make sure that your path is correct!

!!! Info

    These examples omit the import statements.

!!! Warning

    These examples have custom build-scripts, [compiling the code as described here](../extra/working-with-browsers.md)
    won't work with them.
     See
    [building the examples](https://github.com/spessasus/spessasynth_lib/tree/master/examples/README.md) for more info.

## Simple MIDI player demo
### [See this demo live](https://spessasus.github.io/spessasynth_lib/examples/simple_demo.html)
This demo demonstrates how to quickly set up a synthesizer and a sequencer to play a MIDI file.

The demo uses two classes:
[`Synthetizer` class](../synthesizer/index.md) and [`Sequencer` class](../sequencer/index.md).

#### simple_demo.html
```html
<p id="message">Please wait for the soundFont to load.</p>
<input type="file" id="midi_input" accept=".mid, .rmi, .xmf, .mxmf">
<script src="simple_demo.js" type="module"></script>
```

!!! Info

    Note the type="module" in the script tag.

#### simple_demo.js
What the script does:
1. Import the necessary variables
2. `fetch`-es the `soundfont.sf2`
3. Parses the read file using `SoundFont2`
4. Initializes an `AudioContext` and adds the worklet
5. Initializes `Synthetizer` instance with the parsed soundfont
6. Adds an `EventListener` for the file input:
   - Initializes a `Sequencer` instance and connects it to the `Synthetizer` instance we created earlier
   - Starts the playback via `sequencer.play();`
   

```js
// load the sound bank (your path may vary)
fetch("../soundfonts/GeneralUserGS.sf3").then(async response =>
{
    // load the sound bank into an array buffer
    let soundFontArrayBuffer = await response.arrayBuffer();
    document.getElementById("message").innerText = "SoundFont has been loaded!";
    
    // add an event listener for the file inout
    document.getElementById("midi_input").addEventListener("change", async event =>
    {
        // check if any files are added
        if (!event.target.files[0])
        {
            return;
        }
        const midiFile = await (event.target.files[0].arrayBuffer()); // get the file and convert to ArrayBuffer
        const context = new AudioContext(); // create an audioContext
        await context.audioWorklet.addModule(new URL(
            "PATH TO YOUR WORKLET",
            import.meta.url
        )); // add the worklet
        const synth = new Synthetizer(context.destination, soundFontArrayBuffer); // create the synthetizer
        const seq = new Sequencer([{ binary: midiFile }], synth); // create the sequencer
        seq.play();
    });
});
```
It's that simple!

## A more advanced demo
### [See this demo live](https://spessasus.github.io/spessasynth_lib/examples/advanced_demo.html)
The code above is very basic, it only allows uploading a midi file.
We can add more features such as play/pause and time controls to our player without much effort.

Let's add some control buttons:
#### advanced_demo.html
```html
<p id='message'>Please wait for the soundFont to load.</p>
<input accept='.mid, .rmi, .xmf, .mxmf' id='midi_input' multiple type='file'>
<br><br>
<input id='progress' max='1000' min='0' type='range' value='0'>
<br>

<button id='previous'>Previous song</button>
<button id='pause'>Pause</button>
<button id='next'>Next song</button>

<!-- note the type="module" -->
<script src='advanced_demo.js' type='module'></script>
```

Now we need to add functionality to those buttons:
- Input can now accept more files
- Previous song button
- Pause button
- Next song button
- Song progress slider
#### advanced_demo.js
```js

// load the sound bank
fetch("../soundfonts/GeneralUserGS.sf3").then(async response =>
{
    // load the sound bank into an array buffer
    let soundFontBuffer = await response.arrayBuffer();
    document.getElementById("message").innerText = "SoundFont has been loaded!";
    
    // create the context and add audio worklet
    const context = new AudioContext();
    await context.audioWorklet.addModule(new URL("PATH TO YOUR WORKLET", import.meta.url));
    const synth = new Synthetizer(context.destination, soundFontBuffer); // create the synthetizer
    let seq;
    
    // add an event listener for the file inout
    document.getElementById("midi_input").addEventListener("change", async event =>
    {
        // check if any files are added
        if (!event.target.files[0])
        {
            return;
        }
        // resume the context if paused
        await context.resume();
        // parse all the files
        const parsedSongs = [];
        for (let file of event.target.files)
        {
            const buffer = await file.arrayBuffer();
            parsedSongs.push({
                binary: buffer, // binary: the binary data of the file
                altName: file.name // altName: the fallback name if the MIDI doesn't have one. Here we set it to the file name
            });
        }
        if (seq === undefined)
        {
            seq = new Sequencer(parsedSongs, synth); // create the sequencer with the parsed midis
            seq.play(); // play the midi
        }
        else
        {
            seq.loadNewSongList(parsedSongs); // the sequencer is already created, no need to create a new one.
        }
        seq.loop = false; // the sequencer loops a single song by default
        
        // make the slider move with the song
        let slider = document.getElementById("progress");
        setInterval(() =>
        {
            // slider ranges from 0 to 1000
            slider.value = (seq.currentTime / seq.duration) * 1000;
        }, 100);
        
        // on song change, show the name
        seq.addOnSongChangeEvent(e =>
        {
            document.getElementById("message").innerText = "Now playing: " + e.midiName;
        }, "example-time-change"); // make sure to add a unique id!
        
        // add time adjustment
        slider.onchange = () =>
        {
            // calculate the time
            seq.currentTime = (slider.value / 1000) * seq.duration; // switch the time (the sequencer adjusts automatically)
        };
        
        // add button controls
        document.getElementById("previous").onclick = () =>
        {
            seq.previousSong(); // go back by one song
        };
        
        // on pause click
        document.getElementById("pause").onclick = () =>
        {
            if (seq.paused)
            {
                document.getElementById("pause").innerText = "Pause";
                seq.play(); // resume
            }
            else
            {
                document.getElementById("pause").innerText = "Resume";
                seq.pause(); // pause
                
            }
        };
        document.getElementById("next").onclick = () =>
        {
            seq.nextSong(); // go to the next song
        };
    });
});
```

## Simple piano
### [See this demo live](https://spessasus.github.io/spessasynth_lib/examples/piano.html)

This example creates a simple piano to be played with the mouse.
It also allows uploading a soundfont instead of using a built-in one.

#### piano.html
We need to add an input for uploading the soundfont and the table for our piano.
```html
<label for='soundfont_input'>Upload the soundfont.</label>
<input accept='.sf2, .sf3, .dls' id='soundfont_input' type='file'>
  <table>
      <tr id='piano'>
      </tr>
  </table>
  <!-- note the type="module" -->
  <script src='piano.js' type='module'></script>
```
#### piano.js
We create a 36-key keyboard and add pointer events to it
which control the note-on and note-off messages.
```js

document.getElementById("soundfont_input").onchange = async e =>
{
    // check if there's a file uploaded
    if (!e.target.files[0])
    {
        return;
    }
    const file = e.target.files[0];
    const soundFontBuffer = await file.arrayBuffer(); // convert to array buffer,
    // create the context and add audio worklet
    const context = new AudioContext();
    await context.audioWorklet.addModule(new URL("PATH TO YOUR WORKLET", import.meta.url));
    const synth = new Synthetizer(context.destination, soundFontBuffer); // create the synthesizer
    await synth.isReady;
    // create a 36-key piano
    const piano = document.getElementById("piano");
    for (let i = 0; i < 36; i++)
    {
        /**
         * @type {HTMLElement}
         */
        const key = document.createElement("td");
        key.style.background = "white";
        key.style.height = "10em";
        key.style.width = "2em";
        key.style.margin = "0.2em";
        piano.appendChild(key);
        // add mouse events
        key.onpointerdown = () =>
        {
            // key press: play a note
            synth.noteOn(0, 46 + i, 127);
            key.style.background = "red";
        };
        key.onpointerup = () =>
        {
            // key release: stop a note
            synth.noteOff(0, 46 + i);
            key.style.background = "white";
        };
        key.onpointerleave = key.onpointerup;
    }
};
```

## Adding visualizations
### [See this demo live](https://spessasus.github.io/spessasynth_lib/examples/visualizer.html)
Let's spice up our demo a bit!
This is a _very_ simplified version of the web app visualization,
but feel free to expand upon it to create something amazing!

#### visualizer.html
We need to add the canvas and our "keyboard"
```html
<p id="message">Please wait for the soundFont to load.</p>
<input type="file" id="midi_input" multiple accept=".mid, .rmi, .xmf, .mxmf">
<br><br>
<canvas id="canvas" width="1000" height="500"></canvas>
<table>
    <tbody>
    <tr id="keyboard"></tr>
    </tbody>
</table>

<!-- note the type="module" -->
<script src='visualizer.js' type="module"></script>
```

#### visualizer.js
We use two functions of the API to achieve this:
```js
synth.connectIndividualOutputs(audioNodes);
```
This connects the [`AnalyserNode`](https://developer.mozilla.org/en-US/Web/API/AnalyserNode)s to the synthesizer,
allowing visualizations.

```js
synth.eventHandler.addEvent("noteon", event => {/*...*/})
```
[Event system](../synthesizer/synth-event-handler.md) allows us to hook up events 
(in this case, note on and off to visualize key presses)


```js

// add different colors to channels!
const channelColors = [
    "rgba(255, 99, 71, 1)",   // tomato
    "rgba(255, 165, 0, 1)",   // orange
    "rgba(255, 215, 0, 1)",   // gold
    "rgba(50, 205, 50, 1)",   // limegreen
    "rgba(60, 179, 113, 1)",  // mediumseagreen
    "rgba(0, 128, 0, 1)",     // green
    "rgba(0, 191, 255, 1)",   // deepskyblue
    "rgba(65, 105, 225, 1)",  // royalblue
    "rgba(138, 43, 226, 1)",  // blueviolet
    "rgba(50, 120, 125, 1)",  // percussion color
    "rgba(255, 0, 255, 1)",   // magenta
    "rgba(255, 20, 147, 1)",  // deeppink
    "rgba(218, 112, 214, 1)", // orchid
    "rgba(240, 128, 128, 1)", // lightcoral
    "rgba(255, 192, 203, 1)", // pink
    "rgba(255, 255, 0, 1)"    // yellow
];

// adjust this to your liking
const VISUALIZER_GAIN = 2;

// load the sound bank
fetch("../soundfonts/GeneralUserGS.sf3").then(async response =>
{
    // load the sound bank into an array buffer
    let soundFontArrayBuffer = await response.arrayBuffer();
    document.getElementById("message").innerText = "SoundFont has been loaded!";
    
    // create the context and add audio worklet
    const context = new AudioContext();
    await context.audioWorklet.addModule(new URL("PATH TO YOUR WORKLET", import.meta.url));
    const synth = new Synthetizer(context.destination, soundFontArrayBuffer); // create the synthetizer
    let seq;
    
    // add an event listener for the file inout
    document.getElementById("midi_input").addEventListener("change", async event =>
    {
        // check if any files are added
        if (!event.target.files[0])
        {
            return;
        }
        await context.resume();
        const midiFile = await event.target.files[0].arrayBuffer(); // convert the file to array buffer
        if (seq === undefined)
        {
            seq = new Sequencer([{ binary: midiFile }], synth); // create the sequencer with the parsed midis
            seq.play(); // play the midi
        }
        else
        {
            seq.loadNewSongList([{ binary: midiFile }]); // the sequencer is already created,
            // no need to create a new one.
        }
        
        const canvas = document.getElementById("canvas"); // get canvas
        const drawingContext = canvas.getContext("2d");
        /**
         * create the AnalyserNodes for the channels
         */
        const analysers = [];
        for (let i = 0; i < 16; i++)
        {
            analysers.push(context.createAnalyser()); // create analyzer
        }
        
        // connect them to the synthesizer
        synth.connectIndividualOutputs(analysers);
        
        // render analyzers in a 4x4 grid
        function render()
        {
            // clear the rectangle
            drawingContext.clearRect(0, 0, canvas.width, canvas.height);
            analysers.forEach((analyser, channelIndex) =>
            {
                // calculate positions
                const width = canvas.width / 4;
                const height = canvas.height / 4;
                const step = width / analyser.frequencyBinCount;
                const x = width * (channelIndex % 4); // channelIndex % 4 gives us 0 to 2 range
                const y = height * Math.floor(channelIndex / 4) + height / 2;
                
                // get the data from analyzer
                const waveData = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatTimeDomainData(waveData);
                // set the color
                drawingContext.strokeStyle = channelColors[channelIndex % channelColors.length];
                // draw the waveform
                drawingContext.moveTo(x, y);
                drawingContext.beginPath();
                for (let i = 0; i < waveData.length; i++)
                {
                    drawingContext.lineTo(x + step * i, y + waveData[i] * height * VISUALIZER_GAIN);
                }
                drawingContext.stroke();
            });
            
            // draw again
            requestAnimationFrame(render);
        }
        
        render();
        
        // create a keyboard
        const keyboard = document.getElementById("keyboard");
        // create an array of 128 keys
        const keys = [];
        for (let i = 0; i < 128; i++)
        {
            const key = document.createElement("td");
            key.style.width = "5px";
            key.style.height = "50px";
            key.style.border = "solid black 1px";
            keyboard.appendChild(key);
            keys.push(key);
        }
        
        // add listeners to show keys being pressed
        
        // add note on listener
        synth.eventHandler.addEvent("noteon", "demo-keyboard-note-on", event =>
        {
            keys[event.midiNote].style.background = channelColors[event.channel % channelColors.length];
        });
        
        // add note off listener
        synth.eventHandler.addEvent("noteoff", "demo-keyboard-note-off", event =>
        {
            keys[event.midiNote].style.background = "";
        });
        
        // add stop-all listener
        synth.eventHandler.addEvent("stopall", "demo-keyboard-stop-all", () =>
        {
            keys.forEach(key => key.style.background = "");
        });
    });
});
```
Quite cool, isn't it?

## Render audio to file
### [See this demo live](https://spessasus.github.io/spessasynth_lib/examples/offline_audio.html)
Let's make use of SpessaSynth 3.0. It allows us to render an audio file to a file!
#### offline_audio.html
Nothing new here.
```html
<p id='message'>Please wait for the soundFont to load.</p>
<input accept='.rmi, .mid' id='midi_input' type='file'>
<br><br>

<!-- note the type="module" -->
<script src='offline_audio.js' type='module'></script>
```

#### offline_audio.js
Here we use [`OfflineAudioContext`](https://developer.mozilla.org/en-US/Web/API/OfflineAudioContext)
to render the audio to file and `audioBufferToWav` helper, conveniently bundled with SpessaSynth.
Note that we pass the MIDI file directly to the `Synthesizer` class this time.
```js

// load the soundfont
fetch("../soundfonts/GeneralUserGS.sf3").then(async response =>
{
    // load the sound bank into an array buffer
    let soundFontArrayBuffer = await response.arrayBuffer();
    document.getElementById("message").innerText = "SoundFont has been loaded!";
    
    // add an event listener for the file inout
    document.getElementById("midi_input").addEventListener("change", async event =>
    {
        // check if any files are added
        if (!event.target.files[0])
        {
            return;
        }
        // hide the input
        document.getElementById("midi_input").style.display = "none";
        const file = event.target.files[0];
        const arrayBuffer = await file.arrayBuffer();
        const parsedMidi = new MIDI(arrayBuffer, file.name);
        
        // create the rendering context
        const sampleRate = 44100; // 44100Hz
        const context = new OfflineAudioContext({
            numberOfChannels: 2, // stereo
            sampleRate: sampleRate,
            length: sampleRate * (parsedMidi.duration + 1) // sample rate times duration plus one second
            // (for the sound to fade away rather than cut)
        });
        // add the worklet
        await context.audioWorklet.addModule(new URL(
            "PATH TO YOUR WORKLET",
            import.meta.url
        ));
        
        // Here we disable the event system to as it's unnecessary.
        // Also, we need to pass the parsed MIDI here for the synthesizer to start rendering it
        const synth = new Synthetizer(context.destination, soundFontArrayBuffer, false, {
            parsedMIDI: parsedMidi,
            snapshot: undefined // this is used to copy the data of another synthesizer, so no need to use it here
        });
        
        // await sf3 decoder
        await synth.isReady;
        
        // show progress
        const showRendering = setInterval(() =>
        {
            const progress = Math.floor(synth.currentTime / parsedMidi.duration * 100);
            document.getElementById("message").innerText = `Rendering "${parsedMidi.midiName}"... ${progress}%`;
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
        a.download = parsedMidi.midiName + ".wav";
        a.click();
    });
});
```

For more info about writing WAV files, see [writing wave files](../writing-files/writing-wav-files.md).


## Showing active voices while playing
### [See this demo live](https://spessasus.github.io/spessasynth_lib/examples/main_thread_rendering.html)
This example is complex enough for it to [have its own page](../synthesizer/direct-audio-engine-access.md).

!!! Tip

    Look into the `src/website` folder for the actual examples of `spessasynth_lib` usages.