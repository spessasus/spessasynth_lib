---
hide:
    - navigation
    - toc
---

# Welcome to the spessasynth_lib wiki!

You've reached the central documentation for the spessasynth_lib library, a powerful SF2/DLS/MIDI library for web browsers.

_If you're looking for the SpessaSynth web app, it can be found [here](https://spessasus.github.io/SpessaSynth)._

!!! DANGER

    SpessaSynth 3.27 and below is no longer supported!

    [The migration guide for 4.0 is available here.](extra/4-0-migration-guide.md)

## spessasynth_lib documentation

- [Getting started with spessasynth_lib](getting-started/index.md)
- [WorkletSynthesizer](synthesizer/worklet-synthesizer.md) - Responsible for generating sound using AudioWorklets.
- [WorkerSynthesizer](synthesizer/worker-synthesizer.md) - Responsible for generating sound using Web Workers.
- [Sequencer](sequencer/index.md) - Responsible for playing the parsed MIDI sequence.
- [Writing Wave files](writing-files/writing-wav-files.md) - How to write WAV files from `AudioBuffer`.
- [NPM Exports](extra/all-npm-exports.md) - a listing of all the NPN exports in the `spessasynth_lib` NPM package.

!!! Warning

    This wiki only describes the WebAudio API wrappers that spesasynth_lib itself provides.
    Most of the types (such as `BasicMIDI`, `BasicSoundbank` and more) are documented in [spessasynth_core documentation](https://spessasus.github.io/spessasynth_core/).

    If what you're looking for isn't in this wiki, it's probably there.

## Extra info

- [MIDI Implementation](https://spessasus.github.io/spessasynth_core/extra/midi-implementation/) - The MIDI Implementation chart for spessasynth's synthesizer. This describes all the features of the synthesis engine.
- [spessasynth_core documentation](https://spessasus.github.io/spessasynth_core/) - The documentation of the underlying spessasynth_core library. If what you're looking for isn't in this wiki, it's probably there.
- [SF2 RMIDI Extension Specification](https://github.com/spessasus/sf2-rmidi-specification) - The specification for the SF2 RMIDI format that spessasynth supports.
- [Multi-Port files explained](https://spessasus.github.io/spessasynth_core/extra/about-multi-port/) - Explanation of the Multi-Port MIDI feature.

!!! TIP

    If you encounter any errors in this documentation, please **open an issue!**
