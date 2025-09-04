# All NPM Exports
This is a (non-exhaustive) list of exports in the NPM package.

!!! Tip

    All the old exports are available in `spessasynth_core`.

### Synthesizer and Sequencer
- `Sequencer` - the Sequencer module for playing back MIDI files.
- `WorkletSynthesizer` - the synthesizer module for synthesizing audio with AudioWorklets.
- `WorkerSynthesizer` - the sSynthesizer module for synthesizing audio with Web Workers.
- `DEFAULT_SYNTH_CONFIG` - the default synthesizer configuration.

### Audio Effects
- `ChorusProcessor` - the chorus effect processor. It can be used without a synthesizer.
- `getReverbProcessor` - the reverb effect processor. It can be used without a synthesizer.

### MIDI
- `MIDIDeviceHandler` - a wrapper for WebMIDI API to work with spessasynth_lib.
- `WebMidiLinkHandler` - a helper to make the synthesizer Web MIDI Link compatible.

### Others
- `audioBufferToWav` - a function that converts audio buffer to a WAV file.


!!! Tip

    I might forget to add a method to the npm's index.js, which results with it not being importable.
    If that happens, **please open an issue.**