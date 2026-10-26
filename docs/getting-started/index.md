---
title: Getting Started with spessasynth_lib
children:
    - simple-example.md
    - advanced-example.md
    - piano-example.md
    - visualizer-example.md
    - render-audio-example.md
    - render-split-example.md
    - worker-synth-example.md
    - main-thread-rendering.md
---

# Getting Started with <code>spessasynth_lib</code>

## <code>spessasynth_lib</code> vs <code>spessasynth_core</code>

There are two similar libraries: `spessasynth_lib` and `spessasynth_core`:

- `core` is the main library that contains all the MIDI, SF2 and DLS parsing, as well as the synthesis engine with its effects. It can run in any JS environment.
- `lib` builds on top of core,
  relying on the Web Audio API to provide an easy-to-use wrapper that runs the engine off the main thread.
  It depends on core, so all writing and conversion features can be used directly from core.

So:

### Use <code>spessasynth_lib</code> if:

- You want to play MIDI files in the browser without much work.
- You don't want to have to program your own audio processor or threading.
- You don't need direct access to the audio engine from the main thread.

### Use <code>spessasynth_core</code> if:

- You want [direct audio engine access](main-thread-rendering.md) on the main thread.
- You need full control over the audio.
- You are not in a browser.
- You don't have access to the Web Audio API.

> **Tip**
>
> If you intend on using the "Microsoft GS Wavetable Synth" as your sound bank of choice,
> it is highly recommended to use the original `gm.dls` (from `c:/windows/system32/drivers`)
> file directly instead of an SF2 conversion for better accuracy.
>
> If you want to fully recreate the sound, disable effects and set the sample rate to 22050 Hz.

## Installation

```shell
npm install --save spessasynth_core spessasynth_lib
```

> **Warning**
>
> Consider installing `spessasynth_core` as shown above,
> as it provides essential types for many of the API functions.

## Minimal setup

The minimal working setup requires the {@link WorkletSynthesizer} class and [adding the worklet module](../extra/importing-the-worklet.md).

The setup is initialized as follows:

```js
const context = new AudioContext();
await context.audioWorklet.addModule("path/to/worklet");
const synth = new WorkletSynthesizer(context);
```

Make sure to replace `path/to/worklet` with one of the paths described [here](../extra/importing-the-worklet.md).

That's it! Now you can move on to learning how a [simple MIDI player](simple-example.md) works.

## Examples

1. [Simple MIDI Player](simple-example.md) - Play a MIDI file with a synthesizer and a sequencer.
2. [Advanced Example](advanced-example.md) - Add a playlist, pause and seek controls.
3. [Clickable Piano](piano-example.md) - Play notes with the mouse and load a custom sound bank.
4. [Adding Visualizations](visualizer-example.md) - Draw per-channel waveforms and the pressed keys.
5. [Rendering Audio To File](render-audio-example.md) - Render a MIDI file to WAV with an `OfflineAudioContext`.
6. [Rendering Separate Channels To File](render-split-example.md) - Render each MIDI channel to its own WAV file.
7. [Worker Synthesizer](worker-synth-example.md) - Use the {@link WorkerSynthesizer} and its export methods.
8. [Direct Audio Engine Access](main-thread-rendering.md) - Render with `spessasynth_core` on the main thread.

> **Warning**
>
> This documentation only describes the Web Audio API wrappers that `spessasynth_lib` itself provides.
> Most of the types (such as {@link BasicMIDI}, {@link BasicSoundBank} and more) are documented in the [spessasynth_core documentation](https://spessasus.github.io/spessasynth_core/).
>
> If what you're looking for isn't here, it's probably there.
