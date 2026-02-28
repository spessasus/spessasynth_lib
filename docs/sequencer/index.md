# Sequencer Class

This is the module that plays MIDI sequences using a Synthesizer.

## Initialization

```ts
const sequencer = new Sequencer(synth, options);
```

- `synth` - the synthesizer to use. One of the available Synthesizers.
- `options` - an optional `Object` with options for the sequencer (all of them are optional as well as the object itself)
    - `skipToFirstNoteOn` - a `boolean` indicating if the sequencer should skip to the first note on. Defaults to `true`.
    - `initialPlaybackRate` - a `number` with the initial playback rate, other than the default 1.0.

!!! Tip

    As of `v4.1.0` you can connect more than 1 Sequencer to any synthesizer!

## Properties

### midiData

The data of the current sequence.
A [`BasicMIDI`](https://spessasus.github.io/spessasynth_core/midi/) (the song data).
Undefined if the data is currently loading or if no song is playing.

Note that the `embeddedSoundBank` property and `events` in the tracks are both empty for performance reasons.

!!! Tip

    To get the actual MIDI data, use the `getMIDI` method.

!!! Danger

    The sequencer doesn't instantly get the new MIDI information.
    Make sure to use `eventHandler.addEvent("songChange", id, callback)` instead of waiting or assuming that the data is available instantly.
    Also keep in mind that The sequencer _preloads_ the samples for the MIDI, which might take a bit!

### songListData

The data of all the sequences, stored like the `midiData` property, but for all songs (an array).
Allows creating playlists with the decoded titles and metadata.

### eventHandler

Allows setting up custom event listeners for the sequencer.
It works like [synthesizer event handler](../synthesizer/synth-event-handler.md).

The event types match [spessasynth_core's sequencer event types](https://spessasus.github.io/spessasynth_core/spessa-synth-sequencer/event-types/),
with an additional event `midiError` that gets called when a MIDI parsing error occurs.

### isFinished

Indicates whether the sequencer has finished playing a sequence.

### synth

The synthesizer attached to this sequencer.

### midiOut

The `MIDIOutput` to play to. If it is undefined, then spessasynth's synthesizer will be used.

### songIndex

The current index (0-based) of the song that's playing.
It can be changed via this property.

### currentTempo

The current tempo of the sequence, in BPM.

!!! Tip

    Tempo changes can be monitored via the tempo change event.

### duration

Length of the current track in seconds.

### songsAmount

The number of songs in the playlist.

### skipToFirstNoteOn

A `boolean` indicating if the sequencer should skip to the first note on when the time is set to 0.

### loopCount

The number of loops remaining until the loop is disabled.
Set to `Infinity` to loop forever.
It will automatically decrease by one every loop.
Set to 0 to disable loops.

### playbackRate

Controls how fast the song plays (1 is normal, 0.5 is half speed etc.)

### shuffleSongs

Boolean that controls if the song order is random.
Note that setting this to on will change the current song.
The order is randomized once, not every time the song changes, providing consistent order.
Randomization can occur again after the last song is reached.

### currentTime

The current playback time of the song in seconds.
Can be set to seek to a specific position in the song.

### currentHighResolutionTime

A smoothed version of currentTime.
Use for visualization as it's not affected by the audioContext stutter.

### paused

Read-only boolean, true if paused, false if playing or stopped.

## Methods

### getMIDI

Gets the actual [`BasicMIDI`](https://spessasus.github.io/spessasynth_core/midi/) sequence, complete with track data.

```js
const data = await sequencer.getMIDI();
```

!!! Important

    This method is *asynchronous.*

### loadNewSongList

Load a new song list.
Note that this does not start playing the songs automatically.

```ts
sequencer.loadNewSongList(midiBuffers);
```

- midiBuffers - an array of the parsed MIDI files to play, Either [`BasicMIDI`](https://spessasus.github.io/spessasynth_core/midi/) or objects (can be mixed up) with two properties:
    - `binary` - the `ArrayBuffer` representation of the file.
    - `fileName` - alternative name of the sequence if it doesn't have one (like file name, for example). `string`, can be undefined.

!!! Tip

    For performance reasons, it is recommended passing the binary data rather than the parsed `MIDI` instance.

### connectMIDIOutput

Connect a given MIDI output port and play the sequence to it.

```ts
sequencer.connectMIDIOutput(output);
```

- output - a [`MIDIOutput`](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) object, the output port to play to. Pass undefined to use the connected synthesizer.

!!! Info

    You can also use the [MIDIDeviceHandler](../midi/web-midi-api.md).

### pause

Pause the playback of the sequence.

### play

Start playing or resume the sequence.

### eventHandler.addEvent (song change and other events)

Use the event handler to react to song changes, tempo changes, and other sequencer events.
Works like the [synthesizer event handler](../synthesizer/synth-event-handler.md).

**Example - wait for song data to be ready:**

```js
sequencer.eventHandler.addEvent("songChange", "my-listener", (midiData) => {
    console.log("Song loaded:", midiData?.getName());
});
```

See [spessasynth_core's sequencer event types](https://spessasus.github.io/spessasynth_core/spessa-synth-sequencer/event-types/) for details.
