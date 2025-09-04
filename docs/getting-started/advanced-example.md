# Advanced Example

**[See this demo live](https://spessasus.github.io/spessasynth_lib/examples/advanced_demo.html)**

The example before is very basic, it only allows uploading a single MIDI file.
We can add more features such as play/pause and time controls to our player without much effort.

Let's add some control buttons:

```html title='advanced_demo.html'
--8<-- "advanced_demo.html"
```

Now we need to add functionality to those buttons:
- Input can now accept more files
- Previous song button
- Pause button
- Next song button
- Song progress slider

```js title='advanced_demo.js'
--8<-- "advanced_demo.js"
```