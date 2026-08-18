# WorkletSynthesizer

This synthesizer uses a single AudioWorklet to provide real-time or offline playback.

!!! Tip

    [A comparison of both synthesizers](index.md).

    Methods shared between the synthesizers can be found [here](basic-synthesizer.md)

## Initialization

!!! Warning

    Make sure you always update `spessasynth_processor.min.js` along with the npm package!
    Creating a script that automatically copies it is recommended.
    See [Importing the worklet](importing-the-worklet.md)

```ts
const synth = new WorkletSynthesizer(context, config);
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

!!! Info

    This method is *asynchronous.*

- config - a configuration object, described below:

#### midiSequence

The MIDI to render, a [`BasicMIDI`](https://spessasus.github.io/spessasynth_core/midi/) instance.

#### snapshot

Optional, the `SynthesizerSnapshot` to apply before starting the render.

!!! Warning

    The master parameters will be replaced with the `SynthesizerSnapshot` ones.

#### loopCount

The amount of times to loop the song. A number.

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

### getMergedOutput

Returns a `ChannelMergerNode` with all 16 channel outputs merged into a single one.

```ts
const merger = synth.getMergedOutput();
merger.connect(context.destination);
```

The channels are layered as follows:

- Channel1L, Channel1R
- ...
- Channel16L, Channel16R

This is intended for offline audio rendering via `OfflineAudioContext` to allow extraction of separate channels.
The channel outputs are the dry signal for visualization only.

!!! Note

    The main output is not included in the merged output,
    as Web Audio caps the number of channels at 32 (16 stereo pairs).

!!! Warning

    Make sure the `OfflineAudioContext` is created with 32 channels, otherwise the channels will be downmixed.

!!! Info

    An example demonstrating this [can be found here](../getting-started/render-split-example.md).

### destroy

Properly disposes of the synthesizer along with its worklet.

!!! Warning

    Remember, you **MUST** call this method after you're done with the synthesizer!
    Otherwise it will keep processing and the performance will greatly suffer.
