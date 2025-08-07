# Writing Wave files
SpessaSynth has a helper function for writing wave files.

## audioBufferToWav
Converts an audio buffer into a fully valid wave file.
```js
const file = audioBufferToWav(audioBuffer, normalizeAudio = true, channelOffset = 0, metadata = {}, loop = undefined, channelCount = all);
```
- `audioBuffer` - `AudioBuffer` - the buffer to write. Multiple channels are allowed.
- `normalizeAudio` - optional `boolean` - if true, the gain of the entire song will be adjusted, so the max sample is always 32,767 or min is always -32,768 (whichever is greater). Recommended.
- `channelOffset` - optional `number` - if the buffer has more than two channels,
you can specify the channel offset to use.
This is especially useful in [one output mode](../synthesizer/basic-synthesizer.md#one-output-mode)
- `metadata` - optional `Object` described below. All options are string and are optional:
  - `title` - the song's title
  - `artist` - the song's artist
  - `album` - the song's album
  - `genre` - the song's genre
- `loop` - optional `Object` that will write loop points to the file (using the `cue ` chunk)
  - `start` - start time in seconds
  - `end` - end time in seconds
- `channelCount` - optional `number` that limits the channel count to a given number. Otherwise, all channels from `channelOffset` to the last channel are used.

The metadata uses the `INFO` chunk to write the information. It is encoded with `utf-8`