import { runCommandSync } from "./run_command.js";
import { rimraf } from "rimraf";
import path from "path";
import esbuild from "esbuild";

await rimraf.rimraf(path.resolve(import.meta.dirname, "..", "dist"));

const dirname = import.meta.dirname;
const INPUT_PATH = path.join(dirname, "..", "src", "worklet_processor.ts");
const OUTPUT_PATH = path.join(
    dirname,
    "..",
    "dist",
    "worklet_processor.min.js"
);

// esbuild src/worklet_processor/ts --bundle --tree-shaking=true --minify --sourcemap=linked --format=esm --outfile=dist/worklet_processor.min.js --platform=browser
esbuild.buildSync({
    entryPoints: [INPUT_PATH],
    bundle: true,
    treeShaking: true,
    minify: true,
    format: "esm",
    platform: "browser",
    outfile: OUTPUT_PATH,
    logLevel: "info",
    target: "esnext"
});

runCommandSync("npm run build:pages");
runCommandSync("tsup src/index.ts --sourcemap --dts --format esm");
runCommandSync("npm run build:examples");
console.log("spessasynth_lib built successfully");
