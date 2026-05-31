# MIDIChannel

The `LibMIDIChannel` class represents a single MIDI channel within the synthesizer,
providing an API to control its parameters and state.

## Properties

### `patch`

The currently selected MIDI patch of the channel.

!!! Note

    The exact matching preset may not be available,
    but this property represents exactly what MIDI asks for.

### systemParameters

The current [Channel System Parameters](https://spessasus.github.io/spessasynth_core/spessa-synth-processor/midi-channel/channel-parameters#system) of this channel.
These are only editable via the API.

Stored as key: value. Readonly.

### midiParameters

The current [Channel MIDI Parameters](https://spessasus.github.io/spessasynth_core/spessa-synth-processor/midi-channel/channel-parameters#midi) of this channel.
These are only editable via MIDI messages.

Stored as key: value. Readonly.

### voiceCount

Current amount of voices that are playing on this channel.

## Methods

### lockMIDIParameter

Locks or unlocks a given [Channel MIDI Parameter.](https://spessasus.github.io/spessasynth_core/spessa-synth-processor/midi-channel/channel-parameters#midi)
This prevents any changes to it until it's unlocked.

```ts
channel.lockMIDIParameter(parameter, isLocked);
```

- parameter - the Channel MIDI Parameter to lock, a string of the parameter type.
- isLocked - if the parameter should be locked, boolean.

### setSystemParameter

Set a [Channel System Parameter.](https://spessasus.github.io/spessasynth_core/spessa-synth-processor/midi-channel/channel-parameters#system)

```ts
channel.setSystemParameter(type, value);
```

- type - the type of the parameter to set, a string of the parameter type.
- value - the value of the parameter to set, depends on the type.

### lockController

Locks or unlocks a given controller.
This prevents any changes to it until it's unlocked.

```ts
channel.lockController(controller, isLocked);
```

- controller - `MIDIController` to lock.
- isLocked - `boolean` if the controller should be locked.

### setDrums

Changes the preset to, or from drums.

```ts
channel.setDrums(isDrum);
```

- isDrum - if the channel should be a drum preset or not.

!!! Note

    This executes a program change.
