# Adding Visualizations

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
synth.connectIndividualOutputs(audioNodes);
```
This connects the [`AnalyserNode`](https://developer.mozilla.org/en-US/Web/API/AnalyserNode)s to the synthesizer,
allowing visualizations.

```js
synth.eventHandler.addEvent("noteOn", event => {/*...*/})
```

[The event system](../synthesizer/synth-event-handler.md) allows us to hook up events 
(in this case, note on and off to visualize key presses)


```js title='visualizer.js'
--8<-- "visualizer.js"
```
Quite cool, isn't it?