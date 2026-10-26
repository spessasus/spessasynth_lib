---
title: Adding Visualizations Example
---

# Adding Visualizations Example

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/visualizer.html)**

Let's spice up our demo a bit!
This is a _very_ simplified version of the SpessaSynth Web App visualization,
but feel free to expand upon it to create something amazing!

```html title='visualizer.html'
--8<-- "visualizer.html"
```

We need to add the canvas and our "keyboard".

We use two functions of the API to achieve this:

```js
synth.connectChannel(audioNode, channel);
```

This connects the [`AnalyserNode`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)s to the synthesizer,
allowing visualizations for specific MIDI channels.

```js
synth.eventHandler.addEvent("noteOn", "my-note-on-listener", (event) => {
    /*...*/
});
```

{@link SynthEventHandler} allows us to hook up events
(in this case, note on and note off to visualize key presses).
The second argument is a unique ID, which can later be used to remove the listener.

```ts title='visualizer.ts'
--8<-- "visualizer.ts"
```

Quite cool, isn't it?
