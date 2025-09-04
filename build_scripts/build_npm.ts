import path from "path";
import { NPM_DIST_DIR } from "./util.ts";
import esbuild from "esbuild";
import * as tsup from "tsup";

console.log("Building NPM package...");
const dirname = import.meta.dirname;
const INPUT_PATH = path.join(dirname, "..", "src", "worklet_processor.ts");
const OUTPUT_PATH = path.join(
    dirname,
    "..",
    NPM_DIST_DIR,
    "spessasynth_processor.min.js"
);
try 
{
// Main bundle
await tsup.build({
    entry: ["src/index.ts"],
    format: "esm",
    dts: true,
    sourcemap: true,
    outDir: "dist"
})

// Worklet
// Esbuild src/worklet_processor/ts
// --bundle
// --tree-shaking=true
// --minify
// --sourcemap=linked
// --format=esm
// --outfile=dist/spessasynth_processor.min.js
// --platform=browser
esbuild.buildSync({
    entryPoints: [INPUT_PATH],
    bundle: true,
    treeShaking: true,
    minify: true,
    format: "esm",
    platform: "browser",
    sourcemap: "linked",
    outfile: OUTPUT_PATH,
    logLevel: "info",
    target: "esnext"
});
console.log("NPM package built successfully.");
}
catch(e)
{
    console.error(e, "\nFailed to build the NPM package.")
}