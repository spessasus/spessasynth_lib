# Sequencer Class
This is the module
that plays MIDI sequences
using the [`Synthetizer` class](../synthesizer/index.md).

!!! Tip

    If you encounter any errors in this documentation, please **open an issue!**


## Initialization
```js
const sequencer = new Sequencer(midiBuffers, synth, options);
```
- `midiBuffers` - an array of the MIDI files to play. Either `MIDI` or objects with two properties: 
  - `binary`: the `ArrayBuffer` representation of the file. It can be mixed up.
  - `altName` - alternative name of the sequence if it doesn't have one. It cn be undefined.
- `synth` - the synthetizer to use. An instance of the [`Synthetizer` class](../synthesizer/index.md).
- `options` - an optional `Object` with options for the sequencer (all of them are optional as well as the object itself)
  - `skipToFirstNoteOn` - a `boolean` indicating if the sequencer should skip to the first note on. Defaults to `true`.
  - `autoPlay` - a `boolean` indicating if the first sequence supplied should start playing. Defaults to `true`.
  - `preservePlaybackState` - a `boolean` indicating if seeking or changing the playback rate will be kept.
  - `initialPlaybackRate` - a `number` with the initial playback rate, other than the default 1.0.
  paused instead of resuming. 
  Defaults to `false`.

!!! Tip

    For performance reasons, it is recommended passing the binary data rather than the parsed `MIDI` instance.

!!! Warning

    Due to the way the sequencer has been coded, 
    only one sequencer can be used with a `Synthetizer` instance at once!
    If this is something that you want to be fixed, feel free to open an issue.

## Methods
### loadNewSongList
Load a new song list.
```js
sequencer.loadNewSongList(midiBuffers, autoPlay = true);
```
- midiBuffers - an array of the parsed MIDI files to play,  Either `MIDI` or objects (can be mixed up) with two properties: 
  - `binary` - the `ArrayBuffer` representation of the file.
  - `altName` - alternative name of the sequence if it doesn't have one (like file name, for example). `string`, can be undefined.
- `autoPlay` - a `boolean` indicating if the first sequence supplied should start playing. Defaults to `true`.

!!! Info

    If only one file is supplied, the `loop` will be set to false.

### play
Start playing the sequence. If the sequence was paused, it won't change any controllers, but if it wasn't (ex. the time was changed) then it will go through all the controller changes from the start before playing. **This function does NOT modify the current playback time!**
```js
sequencer.play(resetTime);
```
- resetTime - boolean, if set to `true` then the playback will start from 0. Defaults to `false`;

### pause
Pause the playback of the sequence.
```js
sequencer.pause();
```

### stop
Stop the playback of the sequence. Currently only used internally by the `pause` function.
```js
sequencer.stop();
```

### nextSong
Play the next song in the list.
```js
sequencer.nextSong();
```

### previousSong
Play the previous song in the list.
```js
sequencer.previousSong();
```

### setSongIndex
Set the song index to a specific number.
```js
sequencer.setSongIndex(index);
```
- index - number, the song index, zero-based.

### connectMidiOutput
Connect a given MIDI output port and play the sequence to it.
```js
sequencer.connectMidiOutput(output);
```
- output - a [`MIDIOutput`](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) object, the output port to play to.
!!! Tip

    Pass `undefined` to use SpessaSynth.

!!! Info

    You can also use [MIDIDeviceHandler](../midi/web-midi-api.md)

### addOnSongChangeEvent
Hook up a given callback function to the song change event.
```js
sequencer.addOnSongChangeEvent(callback, id);
```
- callback - the function that gets called back, takes a `MidiData` instance (the new song).
- id - `string`, unique identifier for the callback. Can be anything as long as it's unique.

!!! Info

    This is the `MidiData` type, not `MIDI`. It has all the properties of `MIDI`, except the `tracks` property, 
    which is the actual song data. 

### addOnTimeChangeEvent
Hook up a given callback function to the time change event.
```js
sequencer.addOnTimeChangeEvent(callback, id);
```
- callback - the function that gets called back, takes a `number` (the new time, in seconds).
- id - `string`, unique identifier for the callback. Can be anything as long as it's unique.

### addOnMetaMessageEvent
Hook up a given callback function to *any* MIDI meta event that occurs.
```js
sequencer.addOnMetaEvent(callback, id);
```

- callback - the function that gets called back, 
 takes a `[MIDIMessage, number]` array.
 That is:
- - The MIDI message object for this message
- - the track number for this message
- id - `string`, unique identifier for the callback. Can be anything as long as it's unique.

### addOnTempoChangeEvent
Hook up a given callback function to the tempo change event.
```js
sequencer.addOnTempoChangeEvent(callback, id);
```
- callback - the function that gets called back, takes a `number` (the new tempo, in beats per minute).
- id - `string`, unique identifier for the callback. Can be anything as long as it's unique.

### addOnSongEndedEvent
Hook up a given callback function to the song end.
```js
sequencer.addOnSongEndedEvent(callback, id);
```
- callback - the function that gets called back, no arguments.
- id - `string`, unique identifier for the callback. Can be anything as long as it's unique.

!!! Warning

    This will only get called if the loop is disabled.

### getMIDI
Gets the actual `MIDI` sequence, complete with track data.
```js
const data = await sequencer.getMIDI();
```

!!! Important

    This function is asynchronous.

!!! Warning

    The track data can potentially have hundreds of thousands of messages for complex MIDIs. Use sparingly!

## Properties
### Time control
#### paused
Read-only boolean, indicating that if the sequencer's playback is paused.
```js
if(sequencer.paused)
{
   console.log("Sequencer paused!");
}
else
{
   console.log("Sequencer playing or stopped!");
}
```

#### playbackRate
Indicates how fast the song plays (1 is normal, 0.5 is half speed etc.)
```js
sequencer.playbackRate = 0.5; // the playback speed is half the normal speed
```

#### loop
Boolean that controls if the sequencer loops.
```js
sequencer.loop = false; // the playback will stop after reaching the end
```

#### loopCount
The number of loops remaining until the loop is disabled.
 A value of `-1` means infinite looping.
 It will automatically decrease by one every loop.
 Defaults to `-1`.
```js
sequencer.loopCount = 2; // the sequencer will loop two times and then the loop will turn off
```

#### shuffleSongs
Boolean that controls if the song order is random.
Note that setting this to on will change the current song.
The order is randomized once, not every time the song changes.
```js
sequencer.shuffleSongs = true;
```

#### currentTime
Property used for changing and reading the current playback time.
##### get
Returns the current playback time in seconds.
```js
console.log("The sequence is currently "+sequencer.currentTime+" seconds in.");
```
##### set
Set the current playback time. Calls `stop` and then `play` internally.
```js
sequencer.currentTime = 0; // go to the start
```

#### currentTempo
The current tempo of the sequence, in BPM.
```js
console.log("Current tempo: "+sequencer.currentTempo+" BPM.");
```

!!! Tip

    Tempo changes can be monitored via [tempo change event](#addontempochangeevent)

#### skipToFirstNoteOn
A `boolean` indicating if the sequencer should skip to the first note on when the time is set to 0.
```js
sequencer.skipToFirstNoteOn = false; // sequencer will no longer skip
```

#### preservePlaybackState
A `boolean` indicating if seeking or changing the playback rate will be kept
paused instead of resuming.
```js
sequencer.preservePlaybackState = true; // now the song will stay paused when seeking
```

### Song Info
#### midiData
The data of the current sequence.
Essentially [`MIDI`](https://spessasus.github.io/spessasynth_core/midi/) except for the `tracks` property
(the song data).
```js
console.log(`This song is named "${sequencer.midiData.midiName}"`);
```

!!! Tip

    To get the actual MIDI data, use the `getMIDI` method.


!!! Danger

    The sequencer doesn't instantly get the new midi information. 
    Make sure to use `addOnSongChangeEvent` instead of waiting or assuming that the data is available instantly.
    Also keep in mind that The sequencer _preloads_ the samples for the MIDI, which might take a bit!

#### duration
Length of the current track in seconds. Equivalent of `Audio.duration`;
```js
console.log(`The track lasts for ${sequencer.duration} seconds!`);
```

#### songListData
The data of all the sequences, stored like the `midiData` property, but for all songs.
Allows creating playlists with the decoded titles and metadata.

```js
console.log(`The current playlist:\n${sequencer.songListData.map(s => s.midiName).join("\n")}`);
```

#### songIndex
The current index of the song that's playing
```js
console.log(sequencer.songIndex); // 0
```

#### songsAmount
The number of songs in the queue.
```js
console.log(sequencer.songsAmount); // 3
```

### Events
#### onTextEvent
A callback function if defined. Will be called on a text event, like lyrics.
```js
sequencer.onTextEvent = (data, type, lyricsIndex) => {
    const text = new TextDecoder("utf-8").decode(data.buffer);
    console.log("Text event:", text)
}
```
Parameters:
- data - `Uint8Array`, the message's data (excluding the statusByte).
- type - the [Status byte of the meta-message](https://www.recordingblogs.com/wiki/midi-meta-messages) 
useful for determining if the message is lyrics, or something else.
- lyricsIndex - `number`, the index of the lyrics in the song (`midiData.lyrics` array).
If the event is not lyrics, it will be -1.

#### onError
A callback function if defined. Will be called on MIDI parsing error.
```js
sequencer.onError = e => {
    console.log(e);
}
```
- e - `string`, the error message. For example `Invalid MIDI Header! Expected "MThd", got "#!/u"`