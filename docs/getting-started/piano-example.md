# Clickable Piano Example

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/piano.html)**

This example creates a simple piano to be played with the mouse.
It also allows uploading a sound bank instead of using a built-in one.

We need to add an input for uploading the sound bank and the table for our piano.

```html title='piano.html'
--8<-- "piano.html"
```

We create a 36-key keyboard and add pointer events to it
which control the note-on and note-off messages.

```js title='piano.js'
--8<-- "piano.js"
```
