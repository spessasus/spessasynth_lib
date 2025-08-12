# Web MIDI API
SpessaSynth provides an easy way to connect physical MIDI Devices
to it and back using `MIDIDeviceHandler`.

!!! TIP

    If you encounter any errors in this documentation, please **open an issue!**

## Initialization
Initializes the connection to physical MIDI Devices.

```js
MIDIDeviceHandler.createMIDIDeviceHandler();
```
The returned value is `boolean`, true if succeeded, false if failed.

!!! Info

    This function is asynchronous.

