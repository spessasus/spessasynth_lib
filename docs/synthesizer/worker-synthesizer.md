# Worker Synthesizer

This synthesizer uses a Worker communicating with an AudioWorklet to provide real-time playback.
This is the synthesizer used by the SpessaSynth web app.

## Advantages

- Separate thread: The worker thread is separated from the main thread, ensuring smooth playback even if the main thread is busy.
- Integrated worklet: there's no need to copy any js files as the worklet is embedded into the code.
- Direct audio engine access: while still in a separate thread.
- Not affected by the [Chromium SF3 audio bug](https://github.com/spessasus/spessasynth_lib/issues/8).
- Direct SF/MIDI/audio export right in the worker, without transferring any large ArrayBuffers.

## Disadvantages

- Less stable audio engine: The audio processing is separated into two threads, increasing the potential stutters.
- Less accurate real-time inputs: calling note-on, note-off, etc. in real-time is less precise than with the Worklet.