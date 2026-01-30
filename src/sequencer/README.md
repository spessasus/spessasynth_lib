## This is the sequencer's folder.

The code here is responsible for wrapping the `SpessaSynthSequencer` from `spessasynth_core`.

### Message protocol:

#### Message structure

```js
const message = {
    type: number, // WorkletSequencerMessageType
    data: any // any
};
```

#### To worklet

Sequencer uses `WorkletSynthesizer`'s `post` method to post a message with `data` set to
`workletMessageType.sequencerSpecific`.
The `data` is set to the sequencer's message.

#### From worklet

`WorkletSequencer` uses `SpessaSynthProcessor`'s post to send a message with `data` set to
`returnMessageType.sequencerReturn`.
The `data` is set to the sequencer's return message.

### Process tick

`processTick` is called every time the `process` method is called via `sequencer.processTick()` every rendering quantum.
