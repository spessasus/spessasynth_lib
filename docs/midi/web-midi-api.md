# MIDIDeviceHandler

SpessaSynth provides an easy way to connect physical MIDI Devices
to it and back using `MIDIDeviceHandler`.

!!! TIP

    If you encounter any errors in this documentation, please **open an issue!**

## Initialization

Initializes the connection to physical MIDI Devices.

```js
MIDIDeviceHandler.createMIDIDeviceHandler();
```

The returned value is a `MIDIDeviceHandler`. An error is throws if the MIDI Devices fail to initialize.

!!! Info

    This method is *asynchronous.*

## Properties

### inputs

The available MIDI inputs, a `Map`.
Key (the ID of the input, a string) maps to the input (`LibMIDIInput`).

### outputs

The available MIDI outputs, a `Map`.
Key (the ID of the output, a string) maps to the output (`LibMIDIOutput`).

## LibMIDIPort

A shared interface between `LibMIDIInput` and `LibMIDIOutput`.

### port

The actual `MIDIPort` object this instance represents.

### id, name, manufacturer, version

Mirrored from the inner `MIDIPort`.

## LibMIDIInput

### connect

Connects the input to a given synth, listening for all incoming events.

```ts
input.connect(synth);
```

- synth - the synthesizer to connect to.

### disconnect

Disconnects the input from a given synth.

```ts
input.disconnect(synth);
```

- synth - the synthesizer to disconnect from.

## LibMIDIOutput

### connect

Connects a given sequencer to the output, playing back the MIDI file to it.

```ts
output.connect(seq);
```

- seq - the sequencer to connect to.

### disconnect

Disconnects sequencer from the output, making it play to the attached Synthesizer instead.

```ts
output.disconnect(seq);
```

- seq - the sequencer to disconnect.
