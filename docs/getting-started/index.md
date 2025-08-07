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
- You want [direct audio engine access](main-thread-rendering.md)
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
The minimal working setup requires [`WorkletSynthesizer` class](../synthesizer/basic-synthesizer.md) and [adding the worklet module](../synthesizer/importing-the-worklet.md).

The setup is initialized as follows:
```js
audioContext.audioWorklet.addModule("path/to/worklet");
const synth = new WorkletSynthesizer(outputNode, soundBankBuffer);
```
Make sure to replace `/path/to/worklet/` with one of the paths described [here](../synthesizer/importing-the-worklet.md).