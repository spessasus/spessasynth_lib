# Rendering Audio To File

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/offline_audio.html)**

Let's make use of a feature introduced in SpessaSynth v3.0. It allows us to render an sequence to an audio file!

```html title='offline_audio.html'
--8<-- "offline_audio.html"
```

Nothing new here.

```js title='offline_audio.js'
--8<-- "offline_audio.js"
```

Here we use [`OfflineAudioContext`](https://developer.mozilla.org/en-US/Web/API/OfflineAudioContext)
to render the audio to file and the `audioBufferToWav` helper, conveniently bundled with SpessaSynth.
This example uses the [`WorkletSynthesizer`](../synthesizer/worklet-synthesizer.md) with `startOfflineRender`:
the MIDI and sound bank are passed directly to the render call, so no sequencer is needed.

For more info about writing WAV files, see [writing wave files](../writing-files/writing-wav-files.md).
