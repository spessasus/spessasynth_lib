## The Synthesizer Event Handler

The synthesizer supports event handling.
For example, the MIDI Keyboard in the demo uses handling to visualize key-presses.

It is accessible via the `synth.eventHandler` property.

**[Event types can be found here](https://spessasus.github.io/spessasynth_core/spessa-synth-processor/event-types/)**

## Managing the events

### Adding event listener

```js
synth.eventHandler.addEvent(name, id, callback);
```

- name - the type of the event. refer to the table below.
- id - unique id for the event listener. Can be anything, as long as it's unique.
- callback.
  a function that gets called on the event.
  Callback takes an `object` argument.
  The properties depend on the
  event type.
  Refer to the table below.

**Example:**

```js
// log every note played
synth.eventHandler.addEvent("noteOn", "note-on-listener", (data) => {
    console.log(
        `Note ${data.midiNote} played for channel ${data.channel} with velocity ${data.velocity}.`
    );
});
```

### Removing event listener

```js
synth.eventHandler.removeEvent(name, id);
```

- name - the type of the event.
- id - the unique id of the event you wish to remove.

**Example:**

```js
// remove the listener we set above
synth.eventHandler.removeEvent("noteOn", "note-on-listener");
```

### Delaying the event system

If you need to delay the events (for example, to sync up with something),
you can use the `timeDelay` property.

```js
synth.eventHandler.timeDelay = 5;
```

The delay time is specified in seconds. Set to 0 to disable (instant callback). Default is 0.
