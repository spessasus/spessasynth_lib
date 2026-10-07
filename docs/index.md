---
hide:
    - navigation
    - toc
---

# Welcome to the spessasynth_lib wiki!

<p align='center'>
<img src='https://raw.githubusercontent.com/spessasus/SpessaSynth/refs/heads/master/src/website/spessasynth_logo_rounded.png' width='300' alt='SpessaSynth logo'>
</p>

You've reached the central documentation for the spessasynth_lib library, a powerful SF2/DLS/MIDI library for web browsers.

_If you're looking for the SpessaSynth web app, it can be found [here](https://spessasus.github.io/SpessaSynth)._

> **Danger**
>
> SpessaSynth below `4.4.0` is no longer supported!
> Please consider updating to get the best performance and latest features.

## spessasynth_lib documentation

- [Getting started with spessasynth_lib](getting-started/index.md)
- {@link WorkletSynthesizer} - Responsible for generating sound using AudioWorklets.
- {@link WorkerSynthesizer} - Responsible for generating sound using Web Workers.
- {@link Sequencer} - Responsible for playing the parsed MIDI sequence.
- {@link audioBufferToWav Writing Wave files} - How to write WAV files from `AudioBuffer`.

> **Warning**
>
> This wiki only describes the WebAudio API wrappers that `spessasynth_lib` itself provides.
> Most of the types (such as {@link BasicMIDI}, {@link BasicSoundBank} and more) are documented in [spessasynth_core documentation](https://spessasus.github.io/spessasynth_core/).
>
> If what you're looking for isn't in this wiki, it's probably there.

## Extra info

- [MIDI Implementation](https://spessasus.github.io/spessasynth_core/extra/midi-implementation/) - The MIDI Implementation chart for spessasynth's synthesizer. This describes all the features of the synthesis engine.
- [spessasynth_core documentation](https://spessasus.github.io/spessasynth_core/) - The documentation of the underlying spessasynth_core library. If what you're looking for isn't in this wiki, it's probably there.
- [SF2 RMIDI Extension Specification](https://github.com/spessasus/sf2-rmidi-specification) - The specification for the SF2 RMIDI format that spessasynth supports.
- [Multi-Port files explained](https://spessasus.github.io/spessasynth_core/extra/about-multi-port/) - Explanation of the Multi-Port MIDI feature.

> **Tip**
>
> If you encounter any errors in this documentation, please **open an issue!**
