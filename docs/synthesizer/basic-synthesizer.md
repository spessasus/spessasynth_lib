# Basic Synthesizer

This page serves to document the shared methods between `WorkletSynthesizer` and `WorkerSynthesizer`.
There is no `Synthesizer` class.

## Features

The synthesizer uses `spessasynth_core`'s synthesizer as the core audio engine, providing extensive support for all supported audio formats and various MIDI extensions.

[MIDI implementation chart can be found here](https://spessasus.github.io/spessasynth_core/extra/midi-implementation/).

## Configuration object

Below is the `SynthConfig` configuration object that can be passed to both synthesizers during configuration:

### oneOutput

Indicates if the [one output mode](#one-output-mode) should be enabled.
A boolean.

### eventsEnabled

If the event system should be enabled. This can only be set once.

A boolean.

### audioNodeCreators

Custom audio node creation functions for Web Audio wrappers, such as standardized-audio-context.
Pass undefined to use the Web Audio API.

Currently, there's only a single property defined: `worklet`:

A custom creator for an AudioWorkletNode.

It takes three parameters:

- context - the same parameter passed in the initialization.
- workletName - the name of the registered processor.
- options - AudioWorkletNodeOptions.

An example function that creates the standard worklet node looks like this:

```js
((context: BaseAudioContext, name: string, options: AudioWorkletNodeOptions) => {
    return new AudioWorkletNode(context, name, options);
});
```

!!! Info

    The synthesizer internally sends commands to the `SynthesizerCore` where all the processing happens. (This can be a worklet or a worker depending on your synthesizer of choice.)
    Keep that in mind as not all methods will immediately report values!
    (E.g. `noteOn` won't instantly increase the voice count in `midiChannels`)

## Properties

### soundBankManager

The synthesizer's [sound bank manager](sound-bank-manager.md).

### keyModifierManager

The synthesizer's [key modifier manager](key-modifier-manager.md).

### eventHandler

The synthesizer's [event handler](synth-event-handler.md).

### context

The synthesizer's `BaseAudioContext` instance.

### midiChannels

The synthesizer's (virtual) [MIDI channels](midi-channel.md).

An array of [`LibMIDIChannel`](midi-channel.md)

### presetList

The current preset list of the synthesizer,
including all soundbanks with their offsets set through the soundBankManager.

The same type as with the [`presetListChange`](https://spessasus.github.io/spessasynth_core/spessa-synth-processor/event-types/#tchannelpropertychange) event.

!!! Tip

    It is still recommended to use `presetListChange` event as the data may not be immediately available.

### isReady

A promise that gets resolved when the synthesizer gets fully initialized.

!!! Warning

    Remember to wait for this promise before playing anything or rendering audio!

### channelCount

The current amount of MIDI channels the synthesizer has.

### voiceCount

The current amount of voices (notes) being synthesized. A real-time value.

### currentTime

The connected `BaseAudioContext`'s time.

## Methods

### Event options

Most real-time events (note on, off, etc.) can be scheduled as they take an object called `eventOptions`.

Here are the currently defined properties:

- `time` - number - the audio context time in seconds for when the event occurs.
  If the time provided is below the current time, the event gets executed immediately.

### connect, disconnect

Mirror the WebAudio API methods. Connect or disconnect synthesizer from the given audio nodes.

### setLogLevel

Sets the SpessaSynth's log level in the processor.

```js
synth.setLogLevel(enableInfo, enableWarning, enableGroup);
```

- enableInfo - Enable info (verbose)
- enableWarning - Enable warnings (unrecognized messages). Enabled by default.
- enableGroup - Enable groups (to group a lot of logs)

**Example:**

```js
// Enable all logs
synth.setLogLevel(true, true, true);
```

### lockMIDIParameter

Locks or unlocks a given [Global MIDI Parameter.](https://spessasus.github.io/spessasynth_core/spessa-synth-processor/global-parameters#midi)
This prevents any changes to it until it's unlocked.

```ts
synth.lockMIDIParameter(parameter, isLocked);
```

- parameter - the Global MIDI Parameter to lock, a string of the parameter type.
- isLocked - if the parameter should be locked, boolean.

**Example:**

```js
// Lock the MIDI system to GS
synth.lockMIDIParameter("system", "gs");
```

### setSystemParameter

Sets a [Global System Parameter](https://spessasus.github.io/spessasynth_core/spessa-synth-processor/global-parameters#system) to a given value.

```js
synth.setSystemParameter(parameter, value);
```

- parameter - the type to set.
- value - the value to set it to.

**Example:**

```js
// Set the master gain to 200%
synth.setSystemParameter("gain", 2);
```

### getSnapshot

Get a current [`SynthesizerSnapshot`](https://spessasus.github.io/spessasynth_core/spessa-synth-processor/synthesizer-snapshot/) of the `SpessaSynthProcessor` of the synthesizer.

The returned value is a `SynthesizerSnapshot` instance - the snapshot of the synthesizer in the audio/worker thread.

!!! Info

    This method is *asynchronous.*

### addNewChannel

Adds a new channel to the synthesizer.

### connectChannel

Connects a given channel output to the given audio node.
Note that this output is only meant for visualization and may be silent when Insertion Effect for this channel is enabled.

```js
synth.connectChannel(targetNode, channelNumber);
```

- targetNode - `AudioNode` - The node to connect to.
- channelNumber - `number` - The channel number to connect to, will be rolled over if value is greater than 15.

This method returns the target node so you can chain the `.connect` calls.

**Example:**

```js
// Create an analyzer for channel 1
const analyzer = context.createAnalyser();
synth.connectChannel(analyzer, 0);
```

### disconnectChannel

Disconnects a given channel output from the given audio node.

```js
synth.disconnectChannel(targetNode, channelNumber);
```

- targetNode - `AudioNode` - The node to connect to.
- channelNumber - `number` - The channel number to connect to, will be rolled over if value is greater than 15.

**Example:**

```js
// Disconnect the analyzer from earlier
synth.disconnectChannel(analyzer, 0);
```

### connectIndividualOutputs

Connects the individual audio outputs to the given audio nodes.
Note that these outputs is only meant for visualization and may be silent when Insertion Effect for this channel is enabled.

```js
synth.connectIndividualOutputs(audioNodes);
```

- audioNodes - `AudioNode[]` - an array of exactly 16 `AudioNodes` to connect each channel to.
  The first node connects to the first channel and so on.

**Example:**

```js
// Create 16 analyzers and connect them
const analyzers = Array.from({ length: 16 }, () => context.createAnalyser());
synth.connectIndividualOutputs(analyzers);
```

### disconnectIndividualOutputs

Disconnects individual channel outputs from given audio nodes.

```js
synth.disconnectIndividualOutputs(audioNodes);
```

- audioNodes - `AudioNode[]` - an array of exactly 16 `AudioNodes` to disconnect each channel from.
  The first node disconnects the first channel and so on.

**Example:**

```js
// Disconnect the analyzers from earlier
synth.disconnectIndividualOutputs(analyzers);
```

### sendMessage

Send a raw MIDI message to the synthesizer. Calls noteOn, noteOff, etc. internally.

```js
synth.sendMessage(message, (channelOffset = 0), eventOptions);
```

- message - an array of bytes (numbers from 0 to 255). The MIDI message to process.
- channelOffset, optional - adds to the channel number of the message. It defaults to 0.
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**

```js
// send a MIDI note on message for channel 2 and a note 61 (C#) with velocity 120
synth.sendMessage([0x92, 0x3d, 0x78]);
```

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

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- midiNote - the note to stop. Ranges from 0 to 127.
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**

```js
// stop the note 78 (F) on channel 15
synth.noteOff(15, 77);
```

### stopAll

Stop all notes. Equivalent of MIDI "panic."

```js
synth.stopAll((force = false));
```

- force - if the notes should immediately be stopped.

### controllerChange

Set a given MIDI controller to a given value.

```js
synth.controllerChange(channel, controller, controllerValue, eventOptions);
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- controller - the MIDI CC number of the controller to change.
  Refer
  to [this table](https://spessasus.github.io/spessasynth_core/extra/midi-implementation#default-supported-controllers) for the list of controllers
  supported by default.
- controllerValue - the value to set the given controller to. Ranges from 0 to 127.
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**

```js
// set controller 10 (Channel Pan) on channel 2 to 127 (Hard right)
synth.controllerChange(2, 10, 127);
```

!!! Info

    Note that theoretically all controllers are supported as it depends on the sound bank's modulators.

### reset

Fully resets the synthesizer.

### channelPressure

Apply pressure to the given channel. It usually controls the vibrato amount.

```js
synth.channelPressure(channel, pressure, eventOptions);
```

- channel - the channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- pressure - the pressure to apply. Ranges from 0 to 127. 0 means no pressure, 127 means max.
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
synth.polyPressure(11, 60, 127);
```

### pitchWheel

Change the channel's pitch, including the currently playing notes.

```js
synth.pitchWheel(channel, value, eventOptions);
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- value - the bend of the MIDI pitch wheel message. 0 - 16384
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**

```js
// set pitch bend on channel 1 to middle (no change)
synth.pitchWheel(0, 8192);
```

### pitchWheelRange

Change the channel's pitch bend range in semitones. It uses Registered Parameter Number internally.

```js
synth.pitchWheelRange(channel, range);
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- range - the pitch bend range, in full semitones.
- eventOptions - refer to [event options](#event-options). It can be undefined.

**Example:**

```js
// set the pitch bend range on channel 0 to +-12 semitones (one octave)
synth.pitchWheelRange(0, 12);
```

!!! Tip

    The pitch bend range can be decimal, for example, 0.5 means +- half a semitone.

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

### systemExclusive

Handle a MIDI System Exclusive message.

```js
synth.systemExclusive(data, (channelOffset = 0), eventOptions);
```

- data - Uint8Array or `number[]`, the message byte data **Excluding the 0xF0 byte!**
- channelOffset - number, the channel offset for the message as they usually can only address the first 16 channels.
  For example, to send a system exclusive on channel 16,
  send a system exclusive for channel 0 and specify the channel offset to be 16.
- eventOptions - refer to [event options](#event-options). It can be undefined.

!!! Tip

    Refer to the
    [MIDI Implementation](https://spessasus.github.io/spessasynth_core/extra/midi-implementation/#system-exclusives)
    for the list of supported System Exclusives.

**Example:**

```js
// send a GS DT1 Use Drums On Channel 10 (turn channel 10 into a drum channel)
synth.systemExclusive([
    0x41, 0x10, 0x42, 0x12, 0x40, 0x1a, 0x15, 0x01, 0x10, 0xf7
]);

// send a GS DT1 Use Drums On Channel 10 (turn channel 20 into a drum channel)
synth.systemExclusive(
    [0x41, 0x10, 0x42, 0x12, 0x40, 0x1a, 0x15, 0x01, 0x10, 0xf7],
    10
);
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
    - targetPitch - the MIDI key number of the target pitch.
      Note that floating values are allowed and they are specified in cents.
      TargetPitch of -1 sets the tuning for this key to be tuned regularly.

**Example:**

```js
// tune the program 81 (Saw Lead)
// tune the MIDI note 60 (middle C) an octave and 57.78 cents up, and tune note 78 (F) to note 64 (E) and 12 cents up.
synth.tuneKeys(81, [
    { sourceKey: 60, targetPitch: 72.5778 },
    { sourceKey: 78, targetPitch: 64.12 }
]);
```

### reverbateEverythingBecauseWhyNot

Yes please!

Cranks the reverb up to the max and returns a string that says: `That's the spirit!`

## One output mode

This is a special synth mode, which causes the synth to have one output instead of 18, but 32 channels.

In regular mode, the synthesizer's WorkletNode has 18 stereo outputs (16 channel outputs + dry signal for reverb and chorus effects).

One output mode changes the synthesizer to have only a single output with 16 stereo pairs (no effects).

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

This allows for many things, such as exporting files of individual channels in a single OfflineAudioContext rendering pass.

!!! Info

    Chorus and reverb are **disabled** when the one output mode is on.

!!! Warning

    The AudioContext **must** be initialized with 32 channels when this mode is on!
    Otherwise, there will be an error!
