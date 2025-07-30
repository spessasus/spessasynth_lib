<!--suppress HtmlDeprecatedAttribute, HtmlRequiredAltAttribute, HtmlExtraClosingTag -->
<p align='center'>
<img src='https://raw.githubusercontent.com/spessasus/SpessaSynth/refs/heads/master/src/website/spessasynth_logo_rounded.png' width='300' alt='SpessaSynth logo'>
</p>

**A powerful SF2/DLS/MIDI JavaScript library for the browsers.**

*This is a WebAudioAPI wrapper for the [spessasynth_core](https://github.com/spessasus/spessasynth_core) library.*

It allows you to:
- Play MIDI files using SF2/SF3/DLS files!
- Read and write MIDI files!
- Write SF2/SF3 files!
- Convert DLS to SF2! (and back!)
- [and more!](#current-features)

**The next major update (4.0) will include many breaking changes. 
The documentation will be updated when the update releases.
[The migration guide will be published here.](https://github.com/spessasus/spessasynth_lib/pull/10)**


**SpessaSynth Project index**

- [spessasynth_core](https://github.com/spessasus/spessasynth_core) - SF2/DLS/MIDI library
- [spessasynth_lib](https://github.com/spessasus/spessasynth_lib) (you are here) - spessasynth_core wrapper optimized for browsers and WebAudioAPI
- [SpessaSynth](https://github.com/spessasus/SpessaSynth) - online/local MIDI player/editor application
- [SpessaFont](https://github.com/spessasus/SpessaFont) - online SF2/DLS editor


> **TIP:**
> Looking for a bare JS version that works without WebAudioAPI? Try [spessasynth_core](https://github.com/spessasus/spessasynth_core)!

```shell
npm install --save spessasynth_lib
```

### [Project site (consider giving it a star!)](https://github.com/spessasus/spessasynth_lib)

### Made with spessasynth_lib
- [SpessaSynth - Online SF2/DLS MIDI Player](https://spessasus.github.io/SpessaSynth)
- [SpessaFont - Online SoundFont/DLS Editor](https://spessasus.github.io/SpessaFont)


### [Complete documentation](https://spessasus.github.io/spessasynth_lib/)

#### Basic example: play a single note

```js
import { Synthetizer } from "spessasynth_lib"

const sfont = await (await fetch("soundfont.sf3")).arrayBuffer();
const ctx = new AudioContext();
// make sure you copied the worklet processor!
await ctx.audioWorklet.addModule("./worklet_processor.min.js");
const synth = new Synthetizer(ctx.destination, sfont);
document.getElementById("button").onclick = async () =>
{
    await ctx.resume();
    synth.programChange(0, 48); // strings ensemble
    synth.noteOn(0, 52, 127);
}
```

*Audio may sometimes sound distorted in Chromium-based browsers: Chrome, Edge, Brave,
etc. due to a **[Chromium Bug](https://issues.chromium.org/issues/367304685).**
I can't do anything about it, only hope that it gets fixed.
Please consider voting for it on the bug tracker to get it fixed!*

## Current Features

### [All the features of spessasynth_core!](https://github.com/spessasus/spessasynth_core?#current-features)

### On top of that...
- **Modular design:** *Easy integration into other projects (load what you need)*
- **[Detailed documentation:](https://spessasus.github.io/spessasynth_lib/)** *With [examples!](https://spessasus.github.io/spessasynth_lib/getting-started/#examples)*
- **Easy to Use:** *Basic setup is just [two lines of code!](https://spessasus.github.io/spessasynth_lib/getting-started/#minimal-setup)*
- **No external dependencies:** *Just spessasynth_core!*
- **Reverb and chorus support:** [customizable!](https://spessasus.github.io/spessasynth_lib/synthesizer/#effects-configuration-object)
- **Export audio files** using [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)
- **Written using AudioWorklets:** 
  - Runs in a **separate thread** for maximum performance
  - Does not stop playing even when the main thread is frozen
  - Supported by all modern browsers
- **High-performance mode:** Play Rush E! *note: may kill your browser ;)*

#### TODO
- Enhance the built-in chorus and reverb effects (suggestions welcome!)

### Special Thanks
- [FluidSynth](https://github.com/FluidSynth/fluidsynth) - for the source code that helped implement functionality and fixes
- [Polyphone](https://www.polyphone-soundfonts.com/) - for the soundfont testing and editing tool
- [Meltysynth](https://github.com/sinshu/meltysynth) - for the initial low-pass filter implementation
- [RecordingBlogs](https://www.recordingblogs.com/) - for detailed explanations on MIDI messages
- [stbvorbis.js](https://github.com/hajimehoshi/stbvorbis.js) - for the Vorbis decoder
- [fflate](https://github.com/101arrowz/fflate) - for the MIT DEFLATE implementation
- [foo_midi](https://github.com/stuerp/foo_midi) - for useful resources on XMF file format
- [Falcosoft](https://falcosoft.hu) - for help with the RMIDI format
- [Christian Collins](https://schristiancollins.com) - for various bug reports regarding the synthesizer
- **And You!** - for checking out this project. I hope you like it :)


# License
Copyright © 2025 Spessasus
Licensed under the Apache-2.0 License.

SoundFont® is a registered trademark of Creative Technology Ltd.