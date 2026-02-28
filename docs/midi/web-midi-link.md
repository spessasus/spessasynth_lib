# Web MIDI Link

This module adds [Web MIDI Link](https://www.g200kg.com/en/docs/webmidilink/) support to the synthesizer.
Web MIDI Link allows external apps (e.g. MIDI editors, DAWs) to control the synthesizer over MIDI by sending messages through a browser window.

## Initialization

```js
new WebMIDILinkHandler(synth);
```

- synth - a synthesizer instance to connect the link to.
  One of `WorkletSynthesizer` or `WorkerSynthesizer`.

Once created, the handler listens for `postMessage` events from the parent window.
When it receives a MIDI message in the format `"midi,xx,yy,zz"` (hex bytes), it forwards it to the synthesizer.
