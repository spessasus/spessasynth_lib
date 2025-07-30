import path from "path";
import { NPM_DIST_DIR } from "./util.ts";
import { runCommandSync } from "./run_command.ts";
import esbuild from "esbuild";

console.log("Building NPM package...");
const dirname = import.meta.dirname;
const INPUT_PATH = path.join(dirname, "..", "src", "worklet_processor.ts");
const OUTPUT_PATH = path.join(
    dirname,
    "..",
    NPM_DIST_DIR,
    "worklet_processor.min.js"
);
// main bundle
runCommandSync("tsup src/index.ts --clean --sourcemap --dts --format esm");

// worklet
// esbuild src/worklet_processor/ts
// --bundle
// --tree-shaking=true
// --minify
// --sourcemap=linked
// --format=esm
// --outfile=dist/worklet_processor.min.js
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
