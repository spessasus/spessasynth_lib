# Rendering Audio To File

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/offline_audio.html)**

Let's make use of SpessaSynth 3.0. It allows us to render an audio file to a file!


```html title='offline_audio.html'
--8<-- "offline_audio.html"
```

Nothing new here.

```js title='offline_audio.js'
--8<-- "offline_audio.js"
```

Here we use [`OfflineAudioContext`](https://developer.mozilla.org/en-US/Web/API/OfflineAudioContext)
to render the audio to file and `audioBufferToWav` helper, conveniently bundled with SpessaSynth.
Note that we pass the MIDI file directly to the `Synthesizer` class this time.

For more info about writing WAV files, see [writing wave files](../writing-files/writing-wav-files.md).