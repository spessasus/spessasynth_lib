# Rendering Separate Channels To File

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/offline_audio_split.html)**

This example builds on [Rendering Audio To File](render-audio-example.md), but instead of a single stereo mix,
it renders each MIDI channel separately using the `WorkletSynthesizer`'s
[`getMergedOutput`](../synthesizer/worklet-synthesizer.md#getmergedoutput) method.

```html title='offline_audio_split.html'
--8<-- "offline_audio_split.html"
```

```ts title='offline_audio_split.ts'
--8<-- "offline_audio_split.ts"
```

Instead of connecting the synthesizer directly to the destination, we call `getMergedOutput` and connect the returned
`ChannelMergerNode` to the `OfflineAudioContext` destination. This layers all the channel outputs into a single
multichannel buffer:

- Channel1L, Channel1R
- ...
- Channel16L, Channel16R

After rendering, we extract each stereo pair from the rendered buffer and convert it to a wave file.

Note that the `OfflineAudioContext` is created with 32 channels (16 stereo channel pairs).
The effects output is not included, as Web Audio caps the number of channels at 32.

For more info about writing WAV files, see [writing wave files](../writing-files/writing-wav-files.md).
