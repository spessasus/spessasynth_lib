# Importing the worklet module

!!! Warning

    Make sure you always update `spessasynth_processor.min.js` along with the npm package!
    Creating a script that automatically copies it is recommended.

!!! Tip

    This only applies to the `WorkletSynthesizer`. If you're using the `WorkerSynthesizer`, bundlers will take care of everything.

## The problem

the `addModule` method uses a URL _relative to the page URL_, so I (the creator) can't simply just do:

```ts
async function addWorkletHelper(context) {
    await context.audioWorklet.addModule("./spessasynth_processor.min.js");
}
```

This forces us to import the worklet manually.

!!! Tip

    If you know a better way of doing this, please let me know!

## The Solution

Copy the `spessasynth_processor.min.js` from `node_modules/spessasynth_lib/dist/` to your destination, for example a `public` or `src` folder.
See [working with browsers](../extra/working-with-browsers.md#copying-the-processor) for an automation example.

```ts
await context.audioWorklet.addModule(
    new URL("./spessasynth_processor.min.js", import.meta.url)
);
```

!!! Tip

    This method seems to work with WebPack.
