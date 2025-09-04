# Worklet Synthesizer

This synthesizer uses a single AudioWorklet to provide real-time playback.

!!! Tip

    Methods shared between the synthesizers can be found [here](basic-synthesizer.md)

## Advantages

- Stable audio system: The processor lives in the worklet. As long as the system can keep up, there should be no dropouts.
- Separate thread: The audio thread is separated from the main thread, ensuring smooth playback even if the main thread is busy.
- Fast main thread communication: suitable for real-time playback from Web MIDI Inputs.

## Disadvantages

- Susceptible to the [Chromium SF3 audio bug](https://github.com/spessasus/spessasynth_lib/issues/8) with no workarounds.
- Rendering audio requires another instance of the synthesizer. This potentially means copying a 4GB sound bank buffer twice.
- No access to the audio engine.

## Initialization

!!! Warning

    Remember that you need to add the worklet processor for the synthesizer to work!
    See [Importing the worklet](importing-the-worklet.md)

```ts
const synth = new WorkletSynthesizer(
    context,
    config
);
```

- context - `BaseAudioContext` - the context for the synthesizer to use.
- config - `SynthConfig` - optional additional configuration. All properties are optional. [Described here](basic-synthesizer.md#configuration-object)


### Example initialization

Below is a simple example of creating a new synthesizer.

```ts
// create audio context
const context = new AudioContext({
    sampleRate: 44100
});
// add worklet
await context.audioWorklet.addModule("spessasynth_processor.min.js");
// set up synthesizer
const synth = new WorkletSynthesizer(context);
```

!!! Warning

    Avoid using multiple synthesizer instances.
    The [Sound bank manager](sound-bank-manager.md) and one instance should be sufficient.
    See [this comment for more info.](https://github.com/spessasus/SpessaSynth/issues/74#issuecomment-2452600985)    

## Methods

### startOfflineRender

Starts an offline audio render.

```ts
await synth.startOfflineRender(config);
```

- config - a configuration object, described below:

#### midiSequence

The MIDI to render, a `BasicMIDI` instance.

#### snapshot

Optional, the `SynthesizerSnapshot` to apply before starting the render.

#### loopCount

The amount times to loop the song. A number.

#### soundBankList

The list of sound banks to render this file with.

An array of objects with two properties:
- bankOffset - bank offset for this sound bank, a number. Leave at 0 if you are not sure.
- soundBankBuffer - an ArrayBuffer containing the file.


#### sequencerOptions

The options to pass to the sequencer. The same options as with [initializing the sequencer](../sequencer/index.md#initialization)


!!! Tip

    This method is *asynchronous.*

!!! Danger

    Call this method immediately after you've set up the synthesizer.
    Do NOT call any other methods after initializing before this one.
    Chromium seems to ignore worklet messages for OfflineAudioContext.
    

### destroy

Properly disposes of the synthesizer along with its worklet.


!!! Warning

    Remember, you **MUST** call this method after you're done with the synthesizer!
    Otherwise it will keep processing and the performance will greatly suffer.