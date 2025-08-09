# Worker Synthesizer Example

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/worker_synth.html)**

This example shows how to use the new `WorkerSynthesizer` class introduced in SpessaSynth 4.0.
This example adapts the Advanced example.


```html title='worker_synth.html'
--8<-- "worker_synth.html"
```

Nothing new here.


```js title='worker_synth.js'
--8<-- "worker_synth.js"
```

Note how we have to create our own worker and pass its `postMessage` bound to the Worker to the WorkerSynthesizer.
We can also make use of the convenient `renderAudio` method which renders the current sequence.
Other than that, the code is identical.

Now let's take a look at the worker itself:

```js title='worker_synth_worker.js'
--8<-- "worker_synth_worker.js"
```

Since this is a simple example, we just forward the data to the worker, but it allows us to intercept the messages when needed, and to send our own.