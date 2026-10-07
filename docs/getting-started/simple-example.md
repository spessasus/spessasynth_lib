---
title: Simple MIDI Player Example
---

# Simple MIDI Player Example

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/simple_demo.html)**

This example demonstrates how to quickly set up a synthesizer and a sequencer to play a MIDI file.

The example uses two classes:
{@link WorkletSynthesizer} and {@link Sequencer} to play a MIDI file.

```html title='simple_demo.html'
--8<-- "simple_demo.html"
```

> **Note**
>
> Note the type="module" in the script tag.

```ts title='simple_demo.ts'
--8<-- "simple_demo.ts"
```

What the script does:

1. Import the necessary variables
2. `fetch`-es the sound bank file
3. Initializes an `AudioContext` and adds the worklet
4. Initializes {@link WorkletSynthesizer} instance
5. Adds a sound bank to the synthesizer
6. Initializes a {@link Sequencer} instance and connects it to the {@link WorkletSynthesizer}
7. Adds a listener for the file input:
    - Loads the selected MIDI file into the song list
    - Starts the playback via `sequencer.play()`

It's that simple!
