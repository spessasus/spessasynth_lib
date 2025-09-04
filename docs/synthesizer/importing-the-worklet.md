# Importing the worklet module

!!! Warning

    Make sure you always update `spessasynth_processor.min.js` along with the npm package!
    Creating a script that automatically copies it is recommended.
    

!!! Tip

    This only applies to the `WorkletSynthesizer`. If you're using the `WorkerSynthesizer`, bundlers will take care of everything.

## The problem

the `addModule` method uses URL _relative to the page URL_, so I (the creator) can't simply just do:

```ts
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

```ts
await context.audioWorklet.addModule(new ULR("./spessasynth_processor.min.js", import.meta.url));
```

I suggest creating an automation script, such as the one shown [here](../extra/working-with-browsers.md#automation).

!!! Tip

    This method seems to work with WebPack.
