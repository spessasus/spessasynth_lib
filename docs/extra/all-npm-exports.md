# All NPM Exports
This is a (non-exhaustive) list of exports in the NPM package.

!!! tip

    All the old exports are now available in `spessasynth_core`.

### Synthesizer and Sequencer
- Sequencer - the Sequencer module for playing back MIDI files.
- WorkletSynthesizer - the WorkletSynthesizer module for synthesizing audio with soundbanks.
- DEFAULT_SYNTH_CONFIG - the default synthesizer configuration.

### Audio Effects
See [direct synth access](../getting-started/main-thread-rendering.md) for more information.
- FancyChorus - the chorus processor that the synthesizer uses
- getReverbProcessor - automatically sets up a ConvolverNode with the built-in impulse response

### MIDI
- MIDIDeviceHandler - a wrapper for WebMIDI API to work with spessasynth_lib.
- WebMidiLinkHandler - a helper to make the synthesizer Web MIDI Link compatible.

### Others
- audioBufferToWav - a function that converts audio buffer to a WAV file.
- WORKLET_URL_ABSOLUTE - the path from the root `spessasynth_lib` folder to the minified processor.
