# Web MIDI API
SpessaSynth provides an easy way to connect physical MIDI Devices
to it and back using `MIDIDeviceHandler`.

!!! TIP

    If you encounter any errors in this documentation, please **open an issue!**

## Initialization
```js
const MIDIHandler = new MIDIDeviceHandler();
```

## Properties
### inputs
The MIDI inputs as [MIDIInputMap](https://developer.mozilla.org/en-US/docs/Web/API/MIDIInputMap).

### outputs
The MIDI outputs as [MIDIOutputMap](https://developer.mozilla.org/en-US/docs/Web/API/MIDIOutputMap).

## Methods
### createMIDIDeviceHandler
Initializes the connection to physical MIDI Devices.

```js
MIDIHandler.createMIDIDeviceHandler();
```
The returned value is `boolean`, true if succeeded, false if failed.

!!! Info

    This function is asynchronous.

### connectMIDIOutputToSeq
Connects a `Sequencer` instance to a MIDI Output, playing back the sequence to it.

```js
MIDIHandler.connectMIDIOutputToSeq(output, seq);
```
- output - a `MIDIOutput` to connect to.
- seq - a `Sequencer` instance to connect.

### disconnectSeqFromMIDI
Disconnects all MIDI devices from the sequencer.

```js
MIDIHandler.connectMIDIOutputToSeq(seq);
```
- seq - a `Sequencer` instance to disconnect.

### connectDeviceToSynth
Connects a MIDI Input to a `Synthetizer` instance, responding to all received messages.
```js
MIDIHandler.connectDeviceToSynth(input, synth);
```
- input - a `MIDIInput` to connect.
- synth - a `Synthetizer` instance to connect to.
### disconnectAllDevicesFromSynth
Disconnects all MIDI Inputs from the `Synthetizer` instance.
```js
MIDIHandler.disconnectAllDevicesFromSynth();
```
No arguments as this simply removes the `onmidimessage` property from the inputs.