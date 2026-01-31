# Simple MIDI Player Example

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/simple_demo.html)**

This example demonstrates how to quickly set up a synthesizer and a sequencer to play a MIDI file.

The example uses two classes:
[`WorkletSynthesizer` class](../synthesizer/basic-synthesizer.md) and [`Sequencer` class](../sequencer/index.md) to play a MIDI file.

```html title='simple_demo.html'
--8<-- "simple_demo.html"
```

!!! Info

    Note the type="module" in the script tag.

```js title='simple_demo.js'
--8<-- "simple_demo.js"
```

What the script does:

1. Import the necessary variables
2. `fetch`-es the sound bank file
3. Initializes an `AudioContext` and adds the worklet
4. Initializes `WorkletSynthesizer` instance
5. Adds a sound bank to the synthesizer
6. Adds an `EventListener` for the file input:
    - Initializes `WorkletSynthesizer` instance
    - Adds a sound bank to the synthesizer
    - Initializes a `Sequencer` instance and connects it to the `WorkletSynthesizer` instance we created earlier
    - Starts the playback via `sequencer.play();`

It's that simple!
