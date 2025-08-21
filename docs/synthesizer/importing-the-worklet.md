# Importing the worklet module

!!! Warning

    Make sure you always update `spessasynth_processor.min.js` along with the npm package!
    Creating a script that automatically copies it is recommended.

## The problem
the `addModule` method uses URL _relative to the page URL_, so I (the creator) can't simply just do
```js
async function addWorkletHelper(context)
{
    await context.audioWorklet.addModule("./spessasynth_processor.min.js")
}
```
This forces us to import the worklet manually.

!!! Tip

    If you know a better way of doing this, please let me know!

## The Solution

Copy the `spessasynth_processor.min.js` from `spessasynth_lib/synthetizer` to your destination, for example `src` folder.
```js
await context.audioWorklet.addModule("./spessasynth_processor.min.js");
```

I suggest creating an automation script, such as the one shown [here](../extra/working-with-browsers.md#automation).

!!! Tip

    This method seems to work with webpack.
