## The Sound Bank Manager

The sound bank manager allows for handling multiple sound bank with a single synthesizer instance.

It is accessible via the `synth.soundBankManager` property.

Every operation sends a new `presetList` event.

## Methods

### deleteSoundBank

This method removes a sound bank with a given ID from the sound bank list.

```js
await soundBankManager.deleteSoundBank(id);
```

- `id` - `string` - the ID of the sound bank to remove.

!!! Tip

    This method is *asynchronous.*

### addSoundBank

This method adds a new sound bank with a given ID to the list,
or replaces an existing one.

```js
await soundBankManager.addSoundBank(soundBank, id, (bankOffset = 0));
```

- `soundBank` - the new sound bank to add, an `ArrayBuffer` of the file.
- `id` - the ID of the sound bank. If it already exists, it will be replaced.
- `bankOffset` - the bank number offset of the sound bank, set to 0 for no change.

!!! Tip

    This method is *asynchronous.*

!!! Warning

    This method detaches the provided `ArrayBuffer` by transferring it to the synthesizer.
    It can't be used after passing it to the object!

## Properties

### priorityOrder

The IDs of the sound banks in the current order. (from the most important to last)
This can be used to set or retrieve the current order.
Presets in the first bank override the second bank if they have the same MIDI patch and so on.
