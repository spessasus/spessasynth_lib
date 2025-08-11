# Worklet Synthesizer

This synthesizer uses a single AudioWorklet with the Processor and Sequencer in it, along with the effects.

## Advantages

- Stable audio system: The processor lives in the worklet. As long as the system can keep up, there should be no dropouts.
- Separate thread: The audio thread is separated from the main thread, ensuring smooth playback even if the main thread is busy.

## Disadvantages

- Susceptible to the [Chromium SF3 audio bug](https://github.com/spessasus/spessasynth_lib/issues/8) with no workarounds.
- Rendering audio requires another instance of the synthesizer. This potentially means copying a 4GB sound bank buffer twice.
- No access to the audio engine.

## Initialization

!!! Warning

    Note that you need to add the worklet processor for the synthesizer to work!
    See [Importing the worklet](importing-the-worklet.md)

```js
const synth = new WorkletSynthesizer(
    tagetNode,
    soundBankBuffer,
    enableEventSystem(optional),
    startRenderingData(optional),
    synthConfig(optional)
);
```

- targetNode - the AudioNode the synth should play to. Usually it is the `AudioContext.destination` property.
- soundBankBuffer - the `ArrayBuffer` to your sound bank.
- enableEventSystem - `boolean`, disables the event system.
Useful
  when [rendering audio to file](../getting-started/render-audio-example.md)
- startRenderingData - `object`, used for rendering to file. It's formatted as follows:
  - midiSequence: the same type as [passed in loadNewSongList](../sequencer/index.md#loadnewsonglist), but singular. The synthesizer will immediately start rendering it if specified
  - snapshot: a [`SynthesizerSnapshot`](basic-synthesizer.md#getSnapshot) object, a copy of controllers from another synthesizer
    instance.
    If specified, synth will copy this configuration.
  - oneOutput: a `boolean` - indicates the [One output mode](basic-synthesizer.md#one-output-mode)
  - loopCount: the number of loops to play.
  It defaults to 0.
  Make sure your `OfflineAudioContext`'s length accounts for
    these!
  - sequencerOptions: The same object as with [the sequencer constructor `options` parameter.](../sequencer/index.md#initialization)
  Note that the `autoPlay` property will be ignored.
- synthConfig → optional, the configuration for audio effects. [See below.](basic-synthesizer.md#synthesizer-configuration)

!!! Warning

    Avoid using multiple synthesizer instances.
    The [Sound bank manager](sound-bank-manager.md) and one instance should be sufficient.
    See [this comment for more info.](https://github.com/spessasus/SpessaSynth/issues/74#issuecomment-2452600985)