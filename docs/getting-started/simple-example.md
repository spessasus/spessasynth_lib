# Simple MIDI Player Example

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/simple_demo.html)**

This example demonstrates how to quickly set up a synthesizer and a sequencer to play a MIDI file.

The example uses two classes:
[`Synthetizer` class](../synthesizer/index.md) and [`Sequencer` class](../sequencer/index.md).

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
2. `fetch`-es the `soundfont.sf2`
3. Parses the read file using `SoundFont2`
4. Initializes an `AudioContext` and adds the worklet
5. Initializes `Synthetizer` instance with the parsed soundfont
6. Adds an `EventListener` for the file input:
   - Initializes a `Sequencer` instance and connects it to the `Synthetizer` instance we created earlier
   - Starts the playback via `sequencer.play();`

It's that simple!