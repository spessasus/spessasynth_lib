# Working with browsers

Since `spessasynth_lib` is a npm package, you need to do two things to make it work with browsers:
1. Bundle the code
2. Copy the processor

## Copying the processor

Copy the `spessasynth_processor.min.js` from `spessasynth_lib/dist/spessasynth_processor.min.js` to the destination
where the browsers can see it (for example, a `public` directory).
Make sure that the path set in `audioWorklet.addModule()` works correctly in the minified file!

### Automation
For example, you can make a basic script for building the project:

**build.sh**
```shell
# Copy the worklet
cp node_modules/spessasynth_lib/dist/spessasynth_processor.min.js public/spessasynth_processor.min.js

# Your build script here
esbuild --bundle --minify --sourcemap=linked --platform=browser index.js --outfile=index.min.js
```
then in your `package.json`:
```json
{
  "scripts": {
      "build": "./build.sh"
    }
}
```
which allows you to `npm run build` to compile the project.

This is just an example, of course, make sure that your path is correct.


## Bundling the code

!!! Tip

    If you've worked with bundlers before, you don't have to read this..

For that, you will need a bundler like `webpack` or `esbuild`. For simplicity, I recommend the latter.
```shell
npm install esbuild -D
```

### Preparing the code
Example file (named `main.js` in this example)
```js
import { WorkletSynthesizer } from "spessasynth_lib";

console.log("yay, we have imported", WorkletSynthesizer);
```

### Bundling and minification
```shell
esbuild main.js --bundle --minify --sourcemap=linked --format=esm --platform=browser --outfile=main.min.js
```
This will produce an output file called `main.min.js` and `main.min.js.map` for debugging. Make sure to exclude the latter from production builds!

### Linking to HTMl
Link the minified file to your HTML script.

```html
<script src='main.min.js' type='module'></script>
```

That's it! It will work after that.
Make sure to run the esbuild command every time you make changes.