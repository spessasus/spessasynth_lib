# BasicSynthesizer

This is the main module that generates the sound.

!!! Warning

    This class does not have a constructor. The specific synthesizer types share methods described here.

[**MIDI implementation chart**](https://spessasus.github.io/spessasynth_core/extra/midi-implementation/)


## Init parameters parameters
### Synthesizer Configuration
- `chorusEnabled` - `boolean` - indicates if the chorus effect is enabled.
- `chorus` - `ChorusConfig` - the configuration for chorus. Pass `undefined` to use defaults. Described below.
- `reverbEnabled` - `boolean` - indicates if the reverb effect is enabled.
- `impulseResponse` - `AudioBuffer` - the impulse response for the reverb. Pass `undefined` to use defaults.
- `audioNodeCreators` - custom functions for creating Web Audio API wrapper nodes, such as `standardized-audio-context`.
  - `worklet` - a function that takes three arguments, the exact same as regular `AudioWorkletNode` constructor:
  context, processor's name and worklet processor options.
  It should return the initialized `AudioWorkletNode` object.
  - Example with regular Web Audio API constructor:
```js
worklet: (ctx, name, options) => new AudioWorkletNode(ctx, name, options);
```

#### Chorus config
- `chorus` - `object` - this is the chorus config object:
  - `nodesAmount` - `number` - the number of delay nodes (for each channel) and the corresponding oscillators.
  - `defaultDelay` - `number` - the initial delay, in seconds.
  - `delayVariation` - `number` - the difference between delays in the delay nodes.
  - `stereoDifference` - `number` - the difference of delays between two channels (added to the right channel).
  - `oscillatorFrequency` - `number` - the initial delay oscillator frequency, in Hz.
  - `oscillatorFrequencyVariation` - `number` - the difference between frequencies of oscillators, in Hz.
  - `oscillatorGain` - `number` - how much the oscillator will alter the delay in delay nodes, in seconds.


!!! TIP

    Pass `undefined` to `chorus` or `impulseResponse` to use the defaults.

### Example initialization
Below is a simple example of creating 
a new synthesizer with a soundfont coming from a file input.
```js
// create audio context
const context = new AudioContext({
    sampleRate: 44100
});
// add worklet
await context.audioWorklet.addModule("worklet_processor.min.js");
// load soundfont
const file = document.getElementById("file_input").files[0];
const soundfont = await file.arrayBuffer()
// set up synthesizer
const synth = new WorkletSynthesizer(context.destination, soundfont);
```

### isReady

A promise that gets resolved when the synthesizer gets fully initialized with the SF3 decoded.

```js
await synth.isReady;
```

!!! Warning

    Remember to wait for this promise before playing anything or rendering audio!
    Not waiting may break SF3 and reverb support!

## Destruction
Use the `.destroy()` method.

```js
synth.destroy();
```

!!! Warning

    Remember, you **MUST** call this method after you're done with the synthesizer!
    Otherwise it will keep processing and the performance will greatly suffer.

## Methods

!!! Info

    The synthesizer internally sends commands to the `AudioWorklet` where all the processing happens.
    Keep that in mind as not all methods will immediately report values!
    (E.g. `noteOn` won't instantly increase the voice count in `channelProperties`)

### Event options
Most real-time events (note on, off, etc.) can be scheduled as they take an object called `eventOptions`.

Here are the currently defined properties:
- `time` - number - the audio context time in seconds for when the event occurs.
If the time provided is below the current time, the event gets executed immediately.

### sendMessage

Send a raw MIDI message to the synthesizer. Calls noteOn, noteOff, etc. internally.

```js
synth.sendMessage(message, channelOffset = 0, eventOptions);
```

- message - an array of bytes (numbers from 0 to 255). The MIDI message to process.
- channelOffset, optional - adds to the channel number of the message. It defaults to 0.
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**
```js
// send a MIDI note on message for channel 2 and a note 61 (C#) with velocity 120
synth.sendMessage([0x92, 0x3D, 0x78]);
```

## Channel related

### noteOn

Play the given note.

```js
synth.noteOn(channel, midiNote, velocity, eventOptions);
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- midiNote - the note to play. Ranges from 0 to 127.
- velocity - controls how loud the note is.
Note that velocity of 0 has
  the same effect as using `noteOff`.
  Ranges from 0 to 127, where 127 is the loudest and 1 is the quietest.
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**
```js
// start the note 64 (E) on channel 0 with velocity of 120
synth.noteOn(0, 64, 120);
```

### noteOff

Stop the given note.

```js
synth.noteOff(channel, midiNote, eventOptions);
```

- channel - the MIDI channel to use. It Usually ranges from 0 to 15, but it depends on the channel count.
- midiNote - the note to play. Ranges from 0 to 127.
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Note that when `highPerformanceMode` is set to true, the note will always have a release time of 50ms.**

**Example:**
```js
// stop the note 78 (F) on channel 15
synt.noteOff(15, 77);
```

### programChange

Change the preset for the given channel.

```js
synth.programChange(channel, programNumber, eventOptions);
```

- channel - the MIDI channel to change. It usually ranges from 0 to 15, but it depends on the channel count.
- programNumber - the MIDI program number to use.
Ranges from 0 to 127.
To use other banks, go
  to [controllerChange](#controllerchange).
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**
```js
// change the program on channel 1 to 16 (drawbar organ)
synth.programChange(0, 16);
```

### pitchWheel

Change the channel's pitch, including the currently playing notes.

```js
synth.pitchWheel(channel, MSB, LSB, eventOptions);
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- MSB and LSB. 7-bit numbers that form a 14-bit pitch bend value calculated as: `(MSB << 7) | LSB`
- eventOptions - refer to [event options](#event-options). It can be undefined.

!!! Tip

    [I highly recommend this article for more info.](https://www.recordingblogs.com/wiki/midi-pitch-wheel-message)

**Example:**
```js
// set pitch bend on channel 3 to middle (no change)
synth.pitchWheel(3, 64, 0);
```

### setPitchWheelRange

Change the channel's pitch bend range in semitones. It uses Registered Parameter Number internally.

```js
synth.setPitchWheelRange(channel, pitchBendRangeSemitones);
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- pitchBendRangeSemitones - the pitch bend range, in full semitones.

!!! TIP

    The pitch bend range can be decimal, for example, 0.5 means += half a semitone.

**Example:**
```js
// set the pitch bend range on channel 0 to +-12 semitones (one octave)
synth.setPitchWheelRange(0, 12);
```

### systemExclusive

Handle a MIDI System Exclusive message.

```js
synth.systemExclusive(data, channelOffset = 0, eventOptions);
```

- data - Uint8Array, the message byte data **Excluding the 0xF0 byte!**
- channelOffset - number, the channel offset for the message as they usually can only address the first 16 channels.
For example, to send a system exclusive on channel 16,
send a system exclusive for channel 0 and specify the channel offset to be 16.
- eventOptions - refer to [event options](#event-options). It can be undefined.

!!! TIP

    Refer to [MIDI Implementation](https://spessasus.github.io/spessasynth_core/extra/midi-implementation/#supported-system-exclusives) for the list of supported System Exclusives.

**Example:**
```js
// send a GS DT1 Use Drums On Channel 10 (turn channel 10 into a drum channel)
synth.systemExclusive([0x41, 0x10, 0x42, 0x12, 0x40, 0x1A, 0x15, 0x01, 0x10, 0xF7]);

// send a GS DT1 Use Drums On Channel 10 (turn channel 20 into a drum channel)
synth.systemExclusive([0x41, 0x10, 0x42, 0x12, 0x40, 0x1A, 0x15, 0x01, 0x10, 0xF7], 10);
```

### tuneKeys

Tunes individual MIDI key numbers on a given program using the MIDI Tuning Standard.
Think of it as a pitch wheel but for individual notes.

```js
synth.tuneKeys(program, tunings);
```

- program - the MIDI program to tune. Ranges from 0 to 127.
- tunings - an array of objects, each containing two properties:
  - sourceKey - the MIDI key number to tune.
  - targetTuning - the MIDI key number of the target pitch. Note that floating values are allowed and they are specified in cents.

**Example:**
```js
// tune the program 81 (Saw Lead)
// tune the MIDI note 60 (middle C) an octave and 57.78 cents up, and tune note 78 (F) to note 64 (E) and 12 cents up.
synth.tuneKeys(81, [
    { sourceKey: 60, targetPitch: 72.5778 },
    { sourceKey: 78, targetPitch: 64.12   }
]);
```


### controllerChange

Set a given MIDI controller to a given value.

```js
synth.controllerChange(channel, controllerNumber, controllerValue, eventOptions);
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- controllerNumber - the MIDI CC number of the controller to change.
Refer
  to [this table](https://spessasus.github.io/spessasynth_core/extra/midi-implementation/#supported-system-exclusives#default-supported-controllers) for the list of controllers
  supported by default.
- controllerValue - the value to set the given controller to. Ranges from 0 to 127.
- eventOptions - refer to [event options](#event-options). It can be undefined.

!!! Info

    Note that theoretically all controllers are supported as it depends on the sound bank's modulators.

**Example:**
```js
// set controller 10 (Channel Pan) on channel 2 to 127 (Hard right)
synth.controllerChange(2, 10, 127);

// select bank 1 and program 80 on channel 0 to select Square instead of Square Lead
synth.controllerChange(0, 0, 1);
synth.programChange(0, 80);
```

### resetControllers

Reset all controllers to their default values. (for every channel)

```js
synth.resetControllers();
```

### lockController

Cause the given midi channel to ignore controller messages for the given controller number.

```js
synth.lockController(channel, controllerNumber, isLocked);
```

- channel - the channel to lock. It usually ranges from 0 to 15, but it depends on the channel count.
- controllerNumber - the MIDI CC to lock. Ranges from 0 to 146. See the tip below to see why.
- isLocked - boolean, if true then locked, if false then unlocked.

!!! Tip

    To lock other modulator sources add 128 to the Source Enumerator [(Soundfont 2.04 Specification section 8.2.1)](https://www.synthfont.com/sfspec24.pdf#%5B%7B%22num%22%3A317%2C%22gen%22%3A0%7D%2C%7B%22name%22%3A%22XYZ%22%7D%2C0%2C532%2Cnull%5D)
    For example to lock pitch wheel, use `synth.lockController(channel, 142, true)`. (128 + 14 = 142)

**Example:**
```js
// disable portamento on channel 0
synth.controllerChange(0, 65, 0); // portamento on/off set to off
synth.lockController(0, 65, true); // lock portamento on/off
```

### channelPressure

Apply pressure to the given channel. It usually controls the vibrato amount.

```js
synth.channelPressure(channel, pressure, eventOptions);
```

- channel - the channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- pressure - the pressure to apply. Ranges from 0 to 127.
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**
```js
// set channel 1 pressure to 64 (middle)
synth.channelPressure(1, 64);
```

### polyPressure

Apply pressure to the given note on a given channel. It usually controls the vibrato amount.

```js
synth.polyPressure(channel, midiNote, pressure, eventOptions);
```

- channel - the channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- midiNote - the note to apply pressure to. Ranges from 0 to 127.
- pressure - the pressure to apply. Ranges from 0 to 127.
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**
```js
// set channel 11 pressure on note 60 (C) to 127 (max)
synth.polylPressure(11, 60, 127);
```

### muteChannel

Mute or unmute a given channel.

```js
synth.muteChannel(channel, isMuted);
```

- channel - number - the channel to mute/unmute.
It usually ranges from 0 to 15, but it depends on the channel
  count.
- isMuted - boolean - if the channel should be muted. boolean.

**Example:**
```js
// set solo on channel 3
for(const i = 0; i < synth.channelsAmount; i++)
{
    if(i === 3)
    {
        synth.muteChannel(i, false);
    }
    else
    {
        synth.muteChannel(i, true);
    }
}
```

### velocityOverride

Force all the notes in a given channel to have the specified velocity.

```js
synth.velocityOverride(channel, velocity);
```

- channel - number - the channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- velocity - number - the velocity to use. 0 disables the override.

**Example:**
```js
// Force max velocity on drum channel (channel 9)
synth.velocityOverride(9, 127);
```

## Global

### stopAll

Stop all notes. Equivalent of MIDI "panic."

```js
synth.stopAll();
```

### transpose

Transpose the synth up or down in semitones. Floating point values can be used for more precise tuning.

```js
synth.transpose(semitones);
```

- semitones - number - the number of semitones to transpose the synth by.
It can be positive or negative or zero.
Zero resets the pitch.

**Example:**
```js
// transpose the synth up by 125 cents
synth.transpose(1.25);
```

### setMainVolume

Set the synth's main volume.

```js
synth.setMainVolume(volume);
```

- volume - number - the synth's volume. Ranges from 0 to anything, but 1 is the recommended maximum.

!!! Info

    Raising the gain above 1 can lead to unexpected results.

**Example:**
```js
// halve synth's volume
synth.setMainVolume(0.5);
```

### setInterpolationType

Set the synth's interpolation method.

```js
synth.setInterpolationType(type);
```

- type - number - the interpolation type. Currently, defined types:

- 0 - linear interpolation. This was previously the default
- 1 - no interpolation (the nearest neighbor). Useful for songs like chip-tunes.
- 2 - cubic (fourth) order interpolation. Default.

**Example:**
```js
// set nearest neighbor interpolation
synth.setInterpolationType(0);
```

### addNewChannel

Add a new channel. Invokes a `newchannel` event.

```js
synth.addNewChannel();
```

### getSnapshot

Get a current snapshot of the Worklet synthesizer.
!!! Info

    This function is asynchronous.

```js
const snapshot = await synth.getSnapshot();
```

The returned value is
formatted [like this](https://github.com/spessasus/SpessaSynth/blob/master/src/spessasynth_lib/synthetizer/worklet_system/worklet_methods/snapshot.js#L3).
It is essentially an object of the entire synthesizer instance from the audioWorklet side.

### disableGSNRParams

Disables GS NRPN (Non-Registered Parameter Number) messages from being recognized.
Such as vibrato or drum key tuning.

```js
synth.disableGSNRPparams();
```

### connectIndividualOutputs

Connects individual channel outputs to given target nodes.

```js
synth.connectIndividualOutputs(audioNodes);
```

- audioNodes - `audioNode[]` - an array of exactly 16 `AudioNodes` to connect each channel to.
The first node connects to the first channel and so on.

**Example:**
```js
// create 16 analyzers and connect them
const analyzers = Array(16).map(() => context.createAnalyser());
synth.connectIndividualOutputs(analyzers);
```

### disconnectIndividualOutputs

Disconnects individual channel outputs from given target nodes.

```js
synth.disconnectIndividualOutputs(audioNodes);
```

- audioNodes - `audioNode[]` - an array of exactly 16 `AudioNodes` to disconnect each channel from.
The first node disconnects the first channel and so on.

**Example:**
```js
// disconnect the analyzers from earlier
synth.disconnectIndividualOutputs(analyzers);
```


### debugMessage

Print out the synth class instance, both from the main thread and the AudioWorklet thread.

```js
synth.debugMessage();
```

## Properties

### eventHandler

The synthesizer's event handler. Refer to [Event handling](synth-event-handler.md) for more.

### soundfontManager

The synthesizer's soundfont manager. Refer to [the sound bank manager](sound-bank-manager.md) for more.

### keyModifierManager

The synthesizer's key modifier manager. Refer to [Key modifier manager](key-modifier-manager.md) for more.

### presetList

The current preset list of the synthesizer,
including all soundbanks with their offsets set through the sound bankManager.

Stored as a list of objects:
- `bank` - number - the bank number of the preset.
- `program` - number - the MIDI program number of the preset.
- `presetName` - string - the preset's name.

!!! Tip

    It is still recommended to use `presetlistchange` event as the data may not be immediately available.

### voicesAmount

The current amount of voices (notes) playing or during their release phase.

```js
console.log(`This synthetizer is currently playing ${synth.voicesAmount} notes!`);
```

### voiceCap

The maximum allowed voices at once.
 If new voices are added, the voices considered unimportant are killed.
 Default is 350.

```js
synth.voiceCap = 100; // max 100 voices at once
```

### currentTime

The connected `AudioContext`'s time.

```js
console.log(`The current AudioContext's time is ${synth.currentTime}!`); // example usage
```

### system

Indicates the current system the synth is in. Currently, there are: GM, GM2, GS, XG. Default is GS

```js
console.log(synth.midiSystem); // "gm"
```

### highPerformanceMode

Boolean, if the high performance mode is enabled.
High performance mode currently overrides release time to be almost
instant.
Intended for "Black MIDIs."

```js
synth.highPerformanceMode = true; // we can now play black MIDIs! >:)
```

### channelProperties

The current channel properties. An `array` of objects formatted like this:

```js
/**
 * @typedef {Object} ChannelProperty
 * @property {number} voicesAmount - the channel's current voice amount
 * @property {number} pitchBend - the channel's current pitch bend from -8192 do 8192
 * @property {number} pitchBendRangeSemitones - the pitch bend's range, in semitones
 * @property {boolean} isMuted - indicates whether the channel is muted
 * @property {boolean} isDrum - indicates whether the channel is a drum channel
 * @property {number} transposition - the channel's transposition, in semitones
 * @property {number} bank - the bank number of the current preset
 * @property {number} program - the MIDI program number of the current preset
 */
```

```js
console.log(synth.channelProperties[0]); // {voicesAmount: 0, pitchBend: 0, pitchBendRangeSemitones: 2, isMuted: false, isDrum: false }
```


## Managers And Modes
Below are the additional managers for the synthesizer.

- [Synth Event Handler](synth-event-handler.md)
- [SoundFont Manager](sound-bank-manager.md)
- [Key Modifier Manager](key-modifier-manager.md)

### One output mode

This is a special synth mode, which causes the synth to have one output (instead of 18), but 32 channels.

Every midi channel has two audio channels. So it looks like this:

- MIDI channel 0:
  - audio output 0
  - audio output 1
- MIDI channel 1:
  - audio output 2
  - audio output 3
- MIDI channel 2:
  - audio output 4
  - audio output 5

etc.

This allows for many things, such as exporting files of individual channels.

!!! Info

    Chorus and reverb are **disabled** when the one output mode is on.

!!! Warning

    The OfflineAudioContext **must** be initialized with 32 channels!
    Otherwise, there will be an error!
