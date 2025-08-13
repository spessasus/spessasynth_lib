# 4.0 Migration guide

SpessaSynth 4.0 (The TypeScript Update) updates its libraries to ship with TypeScript definitions.

It also includes a few breaking changes which were made to make the API more consistent and logical.

This page documents all the breaking changes in spessasynth_lib.

!!! Note

    Please report any innacurate or missing changes.
    

!!! Note

    This is still in progress.

## Breaking changes

All variables with `soundfont` in them have been renamed to use `soundBank` instead.
This is done because spessasynth can load sound bank formats other than SoundFonts as well.

## FancyChorus

Renamed to `ChorusConfig`.

Now includes `connect`, `disconnect` and `update` methods and `config` property.

Connect nodes to its `input` property.

## getReverbProcessor

Removed, replaced with `ReverbProcessor`. The unified interface allows for implementing other types of reverb in the future.

Connect nodes to its `input` property.

## worklet_processor.min.js

New location: `dist/worklet_processor.min.js`

Now includes a sourcemap, much like index.js.

### WORKLET_URL_ABSOLUTE

Removed, as you have to include the worklet file manually.

## WorkletSynthesizer

Renamed from `Sythetizer` to `WorkletSynthesizer`.
This is done as another (`WorkerSynthesizer`) synthesizer is available.

The constructor has been reworked. It now takes two parameters:

- `context`
- `config`

The synthesizer now has to be `connect`-ed or `disconnect`-ed instead of taking a target node at creation time.

A few methods and properties have been renamed for consistency.
They behave in exactly the same way.

- `soundFontManager` - `soundBankManager`
- `getSynthesizerSnapshot` - `getSnapshot`

### synthConfig

No longer specifies effects themselves, only if they are initialized. The effects can be updated in their respective methods.

### setMasterParameter

Reworked to take the new spessasynth_core master parameter strings.
For more information, please visit [spessasynth_core documentation](https://spessasus.github.io/spessasynth_core/).

### transpose

Removed, replaced with a `transpose` master parameter.

### soundBankManager

The methods now match [spessasynth_core](https://spessasus.github.io/spessasynth_core/extra/4-0-migration-guide.html#sound-bank-manager).

### setEffectsGain

Removed, replaced with master parameters.

### setChorusConfig

Removed, replaced with `ChorusProcessor.update`

### setReverbImpulseResponse

Removed, replaced with `ReverbProcessor.update`

## Sequencer

The constructor no longer takes in a MIDI list, allowing the creation of a sequencer without a song list.

The behavior has been overhauled:

The `preservePlaybackState` has been removed and is always on.
Loading a new song list no longer automatically starts the playback.

This is the behavior of `SpessaSynthProcessor`.

A few methods and properties have been renamed for consistency.
They behave in exactly the same way.

- `connectMidiOutput` -> `connectMIDIOutput`

### loadNewSongList

`altName` property has been renamed to `fileName` as this is what it sets in `BasicMIDI`.

### loop

Removed, `loopCount` of zero disables the loop.

Now defaults to false.

This is the behavior of `SpessaSynthProcessor`.


### previousSong, nextSong

Removed, replaced with setting the `songIndex` property.

### onEvent...

All `onSomething` have been replaced with an `eventHandler` to bring the API in-line with `WorkletSynthesizer`.

### onTempoChange

Removed as `metaEvent` event includes tempo change events.

## AudioBufferToWav

Now takes an `options` object instead of optional arguments.

## MIDIDeviceHandler

Initialization is now done via `MIDIDeviceHandler.createMIDIDeviceHandler()` directly.

The connect methods have been removed,
 as the `inputs` and `outputs` have been replaced with
  `LibMIDIInput` and `LibMIDIOutput` respectively that have their methods to connecting to a given sequencer/synthesizer.