# Migration Guide
If you have used spessasynth_lib before 3.26.0 (the Split Update), you need to make some changes to make it work again.

## spessasynth_core
If you have used anything other than:
- Sequencer,
- Synthetizer,
- audioBufferToWav,
- MIDIDeviceHandler,
- WebMIDILinkHandler

You'll need to `npm install spessasynth_core` as it now contains those. `spessasynth_lib` now only acts as the WebAudioAPI wrapper for `spessasynth_core`.

## Migration
It depends on the way you have installed the package.

### npm package
If you already have used the npm package and bundled your code, then congratulations, everything should work fine!

### copied the folder
This method no longer works.
You will have to remove the folder and install it through npm (`npm install spessasynth_lib`)

You also will have to adjust the imports, replacing the file path with `"spessasynth_lib"`.

Then you will have to set up a bundler for your project. For more info, see [working with browsers](working-with-browsers.md)