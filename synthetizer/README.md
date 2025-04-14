## This is the main synthesizer folder.

The code here is responsible for making the actual sound.
This is the heart of the SpessaSynth library.

- `audio_engine` - the core synthesis engine, it theoretically can run on non-browser environments.
- `audio_effects` - the WebAudioAPI audio effects.
- `worklet_wrapper` - the wrapper for the core synthesis engine using audio worklets.

`worklet_processor.min.js` - the minified worklet processor code to import.

# About the message protocol
Since spessasynth_lib runs in the audioWorklet thread, here is an explanation of how it works:

There's one processor per synthesizer, with a `MessagePort` for communication.
Each processor has a single `SpessaSynthequencer` instance that is idle by default.

The `Synthetizer`, 
`Sequencer` and `SoundFontManager` classes are all interfaces 
that do not do anything except sending the commands to te processor.

The synthesizer sends the commands (note on, off, etc.) directly to the processor where they are processed and executed.

The sequencer sends the commands through the connected synthesizer's messagePort, which then get processed as sequencer messages and routed properly.


## How it works in spessasynth_lib
Both `Synthetizer` and `Sequencer` are essentially "remote control"
for the actual sequencer and synthesizer in the audio worklet thread (here)
These core components are wrapped in the AudioWorkletProcessor, which is receiving both commands and data (MIDIs, sound banks)
through the message port, and sends data back (events, time changes, status changes, etc.).

For example,
the playback to WebMIDIAPI is actually the sequencer in the worklet thread
playing back the sequence and then postMessaging the commands through the synthesizer to the sequencer
which actually sends them to the specified output.

The wonders of separate audio thread...