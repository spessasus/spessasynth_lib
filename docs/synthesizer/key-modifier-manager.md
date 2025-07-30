## Synthesizer Key Modifier Manager
This powerful tool allows modifying each key on each channel to your needs.

It is accessible via the `synth.keyModifierManager` property.

Currently, it supports overriding:
- the velocity of that note
- the preset used on that note
- the key's linear gain

### Adding a key modifier

This function modifies a single key.

```js
synth.keyModifierManager.addModifier(channel, midiNote, options);
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- midiNote - the MIDI note to modify. Ranges from 0 to 127.
- options - the note's modifiers. An `Object`:
  - velocity - `number` - optional. Forces this key on this channel to be the given velocity. Unchanged if undefined.
  - patch - `Object` - optional. Forces this key on this channel to play with the given patch.
    - program - `number` - the program number of the desired patch.
    - bank - `number` - the bank number of the desired patch.
    - Note that both `program` and `bank` must be provided if the `patch` option is used.
  - gain - `number` - optional. Linear gain of the voice

### Removing a key modifier

Clears the modifier from a note, making it behave normally.

```js
synth.keyModifierManager.deleteModifier(channel, midiNote)
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- midiNote - the MIDI note to modify. Ranges from 0 to 127.

### Retrieving a key modifier

Get the key modifier for a given key on a given channel. Returns `undefined` if there's none.

```js
synth.keyModifierManager.getModifier(channel, midiNote)
```

- channel - the MIDI channel to use. It usually ranges from 0 to 15, but it depends on the channel count.
- midiNote - the MIDI note to modify. Ranges from 0 to 127.

The returned value is a `KeyModifier` object.

### Clearing all modifiers

Clears ALL modifiers in this synthesizer instance.

```js
synth.keyModifierManager.clearModifiers();
```