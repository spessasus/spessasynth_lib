# Comparing the types of the Synthesizer

spessasynth_lib provides two synthesizers:

## Worklet Synthesizer

This synthesizer uses a single AudioWorklet to provide real-time playback.

### Advantages

- Stable audio system: The processor lives in the worklet. As long as the system can keep up, there should be no dropouts.
- Separate thread: The audio thread is separated from the main thread, ensuring smooth playback even if the main thread is busy.
- Fast main thread communication: suitable for real-time playback from Web MIDI Inputs.

### Disadvantages

- Susceptible to the [Chromium SF3 audio bug](https://github.com/spessasus/spessasynth_lib/issues/8) with no workarounds. Weak devices with Chromium can be unusable.
- Rendering audio requires another instance of the synthesizer. This potentially means copying a 4GB sound bank buffer twice.
- No access to the audio engine or ability to intercept the messages.

## Worker Synthesizer

This newer synthesizer uses a Worker communicating with an AudioWorklet through a MessageChannel to provide real-time playback.

### Advantages

- Separate thread: The worker thread is separated from the main thread, ensuring smooth playback even if the main thread is busy.
- Integrated worklet: there's no need to copy any js files as the worklet is embedded into the code.
- Direct audio engine access: while still in a separate thread.
- Ability to intercept messages passed from and to the core synthesis engine.
- Not affected by the [Chromium SF3 audio bug](https://github.com/spessasus/spessasynth_lib/issues/8).
- Direct SF/MIDI/audio export right in the worker, without transferring any large ArrayBuffers or freezing the main thread.

### Disadvantages

- Less stable audio engine: The audio processing is separated into two threads, increasing the potential stutters.
- Less accurate real-time inputs: calling note-on, note-off, etc. in real-time is less precise than with the Worklet.
- A lot of clicks and stutters on non-chromium browsers on weaker devices such as smartphones.
- More code needed to set it up.
