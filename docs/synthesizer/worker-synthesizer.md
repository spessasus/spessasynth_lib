# Worker-based Synthesizer

This synthesizer uses a Worker communicating with an AudioWorklet to provide real-time playback along with methods to export the data in various formats.

!!! Tip

    [A comparison of both synthesizers](index.md).
    
    Methods shared between the synthesizers can be found [here.](basic-synthesizer.md)



!!! Info

    An example demonstrating capabilities of this synthesizer [can be found here](../getting-started/worker-synth-example.md).

## Initialization

### WorkerSynthesizer

!!! Warning

    Make sure to [register the worklet](#registerplaybackworklet).


```ts
const synth = new WorkerSynthesizer(
    context,
    workerPostMessage,
    config
);
```

- context - `BaseAudioContext` - the context for the synthesizer to use.
- workerPostMessage - `function` - the `postMessage` function of the Worker synthesizer will use. Optionally a method that takes the same parameters. This can be used for intercepting messages.
- config - `SynthConfig` - optional additional configuration. All properties are optional. [Described here.](basic-synthesizer.md#configuration-object)

### WorkerSynthesizerCore
```ts
const workerSynthCore = new WorkerSynthesizerCore(
    synthesizerConfiguration,
    workletMessagePort,
    mainThreadCallback,
    compressionFunction
)
```

Most parameters here are provided with the first message that is posted to the worker by the WorkerSynthesizer.

- synthesizerConfiguration - the event data from the first message sent from WorkerSynthesizer. 
Listen for the first event and use its data to initialize this class.
- workletMessagePort - the first port from the first message sent from WorkerSynthesizer.
- mainThreadCallback - the function to post a message back to the main thread. Usually `postMessage`.
- compressionFunction - an optional function for compression when writing SF3 banks.

The compression function takes three arguments:
- audioData - Float32Array
- sampleRate - number, in Hertz
- quality - a number, directly passed from the writeSF2 call.

It returns a `Promise<Uint8Array>`.

### Example initialization

Below is a simple example of creating a new synthesizer.
Note that the two snippets are two files, one for the worker and one in the main thread.

```js
// worker
let workerSynthCore;
// Wait for the first message with parameters
onmessage = (e) => {
    if (e.ports[0]) {
        // Initialize
        workerSynthCore = new WorkerSynthesizerCore(
            e.data,
            e.ports[0],
            postMessage.bind(this)
        );
    } else {
        // Handle all other messages
        void workerSynthCore.handleMessage(e.data);
    }
};

```

```ts
// main thread
// create audio context
const context = new AudioContext({
    sampleRate: 44100
});
// register worklet
WorkerSynthesizer.registerPlaybackWorklet(context);
// create the worker
const worker = new Worker(
    // make sure that your path is correct
    new URL("worker.js", import.meta.url)
);
// create the synthesizer and bind it to the worker
const synth = new WorkerSynthesizer(
    context,
    worker.postMessage.bind(worker)
);
worker.onmessage = (e) => synth.handleWorkerMessage(e.data);
```

## Properties

### currentTime

Returns the adjusted time, in sync with worker's internal time which may differ from the AudioContext time.


## Methods

### registerPlaybackWorklet

Registers an audio worklet for the WorkerSynthesizer.

```ts
WorkerSynthesizer.registerPlaybackWorklet(context, maxQueueSize = 20);
```

- context - the context to register the worklet for.
- maxQueueSize - te maximum amount of 128-sample chunks to store in the worklet. Higher values result in less breakups but higher latency. Defaults to 20.

!!! Tip

    This method is *static.*
    

### handleWorkerMessage

Handles a return message from the worker.

Usually you're going to do

```ts
worker.onmessage = (e) => synth.handleWorkerMessage(e.data);
```

but this can also be used to intercept return messages if needed.


### writeDLS

Writes a DLS file directly in the worker.
This pauses the playback if it is playing.

```ts
const file = await synth.writeDLS(options);
```

- options - an optional configuration for writing the file. All properties are optional.
  - progressFunction - a function to track the progress of writing the file.
  - trim - trim the sound bank to only include samples used in the current MIDI file.
  - sequencerID - which sequencer to grab the MIDI from if trimming. Defaults to the first one (0).
  - bankID - the sound bank ID in the sound bank manager to write.
  - writeEmbeddedSoundBank - if the embedded sound bank should be written instead if it exists.

The returned value is an object:
- binary - ArrayBuffer, the binary data of the file.
- fileName - The suggested name of the file.

!!! Info

    This method is *asynchronous.*

### writeSF2

Writes an SF2/SF3 file directly in the worker.
This pauses the playback if it is playing.

```ts
const file = await synth.writeSF2(options);
```

- options - an optional configuration for writing the file. All properties are optional.
  - compressionQuality - the compression quality to call your provided compressionFunction with, if compressing.
  - compress - if the soundfont should be compressed with a given function.
  - writeDefaultModulators - if the DMOD chunk should be written. Recommended. Note that it will only be written if the modulators are unchanged.
  - writeExtendedLimits - if the XDTA chunk should be written to allow virtually infinite parameters. Recommended. Note that it will only be written needed.
  - decompress - if an SF3 bank should be decompressed back to SF2. Not recommended.
  - progressFunction - a function to track the progress of writing the file.
  - trim - trim the sound bank to only include samples used in the current MIDI file.
  - sequencerID - which sequencer to grab the MIDI from if trimming. Defaults to the first one (0).
  - bankID - the sound bank ID in the sound bank manager to write.
  - writeEmbeddedSoundBank - if the embedded sound bank should be written instead if it exists.

The returned value is an object:
- binary - ArrayBuffer, the binary data of the file.
- fileName - The suggested name of the file.

!!! Info

    This method is *asynchronous.*


### writeRMIDI

Writes an embedded MIDI (RMIDI) file directly in the worker.
This pauses the playback if it is playing.

```ts
const file = await synth.writeRMIDI(options);
```

- options - an optional configuration for writing the file. All properties are optional.
  - format - either `sf2` or `dls`. Depending on the format, the options in methods above apply.
  - sequencerID - which sequencer to grab the MIDI from. Defaults to the first one (0).
  - all options in [`BasicMIDI.writeRMIDI`](https://spessasus.github.io/spessasynth_core/midi/#writermidi) except for `soundBank`.

The returned value is an ArrayBuffer, the binary data of the file.

!!! Info

    This method is *asynchronous.*

### renderAudio 

Renders the current song in the connected sequencer to Float32 buffers directly in the worker.
This pauses the playback if it is playing.

```ts
const rendered = synth.renderAudio(sampleRate, renderOptions);
```

- sampleRate - the sample rate to use, in Hertz.
- renderOptions - an optional configuration for writing the file. Described below:
  - extraTime - extra fadeout time after the song finishes, in seconds.
  - separateChannels - if channels should be rendered separately.
  - loopCount - the amount of times to loop the song.
  - progressCallback - the function that tracks the rendering progress. It takes two arguments:
    - progress - mapped 0 to 1.
    - stage - 0 is a dry pass, 1 is adding effects.
  - preserveSynthParams - if the current parameters of the synthesizer should be preserved.
  - enableEffects - if the effects should be enabled.
  - sequencerID - which sequencer to render. Defaults to the first one (0).

The returned value is an array of `AudioBuffer`s:

A single audioBuffer if separate channels were not enabled, otherwise 16.

!!! Info

    This method is *asynchronous.*