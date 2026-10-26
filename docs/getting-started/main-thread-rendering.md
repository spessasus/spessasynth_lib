---
title: Direct Audio Engine Access Example
---

# Direct Audio Engine Access Example

> **Warning**
>
> This is for advanced users only.

> **Note**
>
> This demo only runs well in Firefox.
> Chrome seems to have trouble with `AudioBufferSourceNode`s.
>
> It is recommended to use a simple playback Audio Worklet such as [this one](https://github.com/spessasus/SpessaFont/blob/1b6e034cfefa2f964efc7cba5838a42ee26fcb0f/public/audio_worklet.js).

Sometimes, it is necessary for the script to have direct access to the synthesizer's audio engine for various reasons.

This page shows how to use `spessasynth_core`'s {@link SpessaSynthProcessor} and {@link SpessaSynthSequencer} directly,
rendering in the main thread with full access to the audio engine.

> **Tip**
>
> If you only need access to the audio engine (not necessarily on the main thread),
> consider the {@link WorkerSynthesizer} instead.
> Its {@link BasicSynthesizerCore.synthesizer} and {@link BasicSynthesizerCore.sequencers} properties give you direct access inside the worker.

## General Approach

A simple audio loop that achieves this is as follows:

1. Create the `Float32Array` buffers for the stereo output (and optionally the per-channel outputs for visualization).
2. Perform any custom tasks needed, then advance the sequencer and render the audio.
3. Send the rendered audio to a playback node, such as a custom audio worklet or an `AudioBufferSourceNode`.
4. Connect that playback node to the destination.

## Showing Channel Status Example

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/main_thread_rendering.html)**

Below is an example that shows the current channel status,
which is something that cannot be achieved with just the {@link WorkletSynthesizer} class.

```html title='main_thread_rendering.html'
--8<-- "main_thread_rendering.html"
```

Nothing special here.

```ts title='main_thread_rendering.ts'
--8<-- "main_thread_rendering.ts"
```

The audio loop presented in this script is very similar to the one shown above:

1. Make sure that the synthesizer is not too far ahead.
2. Create the buffers.
3. Process the MIDI playback and render the audio.
4. Create buffer sources and play back the rendered chunks through them.

There is another loop that displays all the voices. It is independent of the audio loop.
