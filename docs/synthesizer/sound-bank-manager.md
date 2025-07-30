## The Sound Bank Manager
The sound bank manager allows for handling multiple sound bank with a single synthesizer instance.

It is accessible via the `synth.soundfontManager` property.

Every operation sends a new `presetlist` event.

### Accessing the list of sound bank

```js
synth.soundfontManager.soundfontList;
```

Which is a list of objects defined as follows:

- id - `string` - the unique sound bank identifier.
- bankOffset - `number` - the bank offset for the sound bank.

The list is ordered from the most important sound bank to the least
(e.g., first sound bank is used as a base and other sound bank get added on top (not override))

!!! Info

    When first creating the synthesizer,
    soundfontList contains one sound bank with the identifier `main` and bank offset of 0.

The behavior is defined as follows:

- The program looks for the first sound bank that has the requested program:bank combo and uses it.
- If not found, the program looks for the first sound bank that has the requested program number and uses it.
- If not found, the program uses the first preset of the first sound bank.

### Adding a new sound bank

This function adds a new sound bank at the top of the sound bank stack.

```js
await synth.soundfontManager.addNewSoundFont(soundfontBuffer, id, bankOffset = 0);
```

- soundfontBuffer - `ArrayBuffer` - the sound bank binary data.
- id - `string` - unique ID for the sound bank. Any string as long as it's unique.
- bankOffset - `number`, optional - the bank offset for the sound bank.

!!! Info

    This function is asynchronous.

!!! Tip

    Using an existing ID will replace the existing bank in-place.

### Removing a sound bank

This function removes a specified sound bank.

```js
synth.soundfontManager.deleteSoundFont(id);
```

- id - `string` - unique ID for the sound bank to delete.

### Changing the order of sound banks

This function reorders the sound banks.

```js
synth.soundfontManager.rearrangeSoundFonts(newOrderedList);
```

- newOrderedList - array of `string` - The new list of the sound bank identifiers, in the desired order.

### Clearing the sound banks

This function removes all sound banks and adds a new one with id `main` and bank offset of 0.

```js
await synth.soundfontManager.reloadManager(soundfontBuffer);
```

- soundfontBuffer - `ArrayBuffer` - the new sound bank to reload the synth with.

!!! Into

    This function is asynchronous.