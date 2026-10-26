---
title: Worker Synthesizer Example
---

# Worker Synthesizer Example

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/worker_synth.html)**

This example shows how to use the new {@link WorkerSynthesizer} class introduced in SpessaSynth 4.0.
This example adapts the [Advanced Example](advanced-example.md).

```html title='worker_synth.html'
--8<-- "worker_synth.html"
```

Nothing new here.

```ts title='worker_synth.ts'
--8<-- "worker_synth.ts"
```

Note how we have to create our own worker and pass its `postMessage` (bound to the worker) to the {@link WorkerSynthesizer}.
We can also make use of the convenient {@link WorkerSynthesizer.renderAudio} and {@link WorkerSynthesizer.renderAudioSplit} methods,
which render the current sequence directly in the worker.
Other than that, the code is identical.

Now let's take a look at the worker itself:

```ts title='worker_synth_worker.ts'
--8<-- "worker_synth_worker.ts"
```

Since this is a simple example, the worker just forwards the messages to the {@link WorkerSynthesizerCore},
but this setup allows us to intercept the messages when needed, and to send our own.
