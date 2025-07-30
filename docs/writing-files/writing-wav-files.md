# Writing Wave files
SpessaSynth has a helper function for writing wave files.

## audioBufferToWav
Converts an audio buffer into a fully valid wave file.
```js
const file = audioBufferToWav(audioBuffer, normalizeAudio = true, channelOffset = 0, metadata = {}, loop = undefined, channelCount = all);
```
- `audioBuffer` - `AudioBuffer` - the buffer to write. Multiple channels are allowed.
- `normalizeAudio` - optional `boolean` - if true, the gain of the entire song will be adjusted, so the max sample is always 32,767 or min is always -32,768 (whichever is greater). Recommended.
- `channelOffset` - optional `number` - if the buffer has more than two channels,
you can specify the channel offset to use.
This is especially useful in [one output mode](../synthesizer/index.md#one-output-mode)
- `metadata` - optional `Object` described below. All options are string and are optional:
  - `title` - the song's title
  - `artist` - the song's artist
  - `album` - the song's album
  - `genre` - the song's genre
- `loop` - optional `Object` that will write loop points to the file (using the `cue ` chunk)
  - `start` - start time in seconds
  - `end` - end time in seconds
- `channelCount` - optional `number` that limits the channel count to a given number. Otherwise, all channels from `channelOffset` to the last channel are used.

The metadata uses the `INFO` chunk to write the information. It is encoded with `utf-8`

## Example code
This example code shows how to save MIDI to a wav file with loop points.
```js
const parsedMid = new MIDI(midiBinary, "unnamed.mid");
const sampleRate = 44100; // hz
const durationInSamples = sampleRate * parsedMid.duration;

const context = new OfflineAudioContext({
  numberOfChannels: 2,
  samplerate: sampleRate,
  length: durationInSamples
});
// remember to add the module!
await context.audioWorklet.addModule("worklet_processor.min.js");
const synth = new Synthetizer(
    context.destination, // play directly to output
    soundfontBinary,
    false,
    {
        parsedMIDI: parsedMid,
        oneOutput: false,
        snapshot: undefined,
        loopCount: 0,
    }, 
    /*
    use the default effects. 
    NOTE: it is HIGHLY recommended that you provide the impulse response here as mentioned in Synthetizer page, 
    but it's omitted for simplicity
    */
    undefined
        
);

// start rendering
const buffer = await context.startRendering();

// Calculate loop points
// the file skips to the first note on event, 
// but the loop points are absolute. 
// So we need to adjust them
const startOffset = MIDIticksToSeconds(parsedMid.firstNoteOn, parsedMid);
const loopStart = MIDIticksToSeconds(parsedMid.loop.start, parsedMid) - startOffset;
const loopEnd = MIDIticksToSeconds(parsedMid.loop.end, parsedMid) - startOffset;

// create the WAV file
const wav = audioBufferToWav(
    buffer,
    true, // normalize audio
    0,    // channel offset
    { title: parsedMid.midiName }, // add some metadata
    { start: loopStart, end: loopEnd}
);

// save the file
const a = document.createElement("a");
a.href = URL.createObjectURL(wav);
a.download = parsedMid.midiName + ".wav";
a.click();
```

For a real use-case, see `src/website/manager/export_audio.js`.