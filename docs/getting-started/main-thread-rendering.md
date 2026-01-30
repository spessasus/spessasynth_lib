# Direct Audio Engine Access

!!! Warning

    This is for the advanced users only.

!!! Info

    This demo only runs well in Firefox.
    Chrome seems to have trouble with AudioBufferSourceNodes.

    It is recommended to use a simple playback Audio Worklet such as [this one](https://github.com/spessasus/SpessaFont/blob/1b6e034cfefa2f964efc7cba5838a42ee26fcb0f/public/audio_worklet.js).

Sometimes, it is necessary for the script to have direct access to the synthesizer's audio engine for various reasons.
While one can use `spesasynth_core` directly, this will require implementing the audio effects manually.

This page is intended to show how to use both `spessasynth_core` and `spessasynth_lib` to maintain full feature set of the `Synthesizer` class,
while rendering in the main thread and having the full access to the audio engine.

### General Approach

`spessasynth_lib` exposes both audio processors, allowing us to connect them to the synthesizer directly.

A simple audio loop that achieves this is as follows:

1. Create the `Float32Array` buffers for the dry, chorus and reverb outputs.
2. Perform any custom tasks needed and then render the audio
3. Send the processed audio to playback nodes, like a custom audio worklet or `AudioBufferSourceNode`s
4. The node/s play back to the target node and the effect processors (three `BufferSource`s for three nodes)
5. The effects are connected to the target node as well, so they process the audio as needed

## Showing voice list example

### [See this demo live](https://spessasus.github.io/spessasynth_lib/examples/main_thread_rendering.html)

Below is an example that shows the list of active voices currently playing,
which is something that cannot be achieved with just the `WorkletSynthesizer` class.

```html title='main_thread_rendering.html'
--8<-- "main_thread_rendering.html"
```

Nothing special here.

```js title='main_thread_rendering.js'
--8<-- "main_thread_rendering.js"
```

The audio loop presented in this script is very similar to the one shown above:

1. Make sure that the synthesizer is not too far ahead
2. Create the buffers
3. Process the MIDI playback and render audio
4. Create buffer sources and play back the rendered chunks through them

There is another loop that displays all the voices. It is independent of the audio loop.
