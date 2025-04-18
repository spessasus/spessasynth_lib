import path from "node:path";
import esbuild from "esbuild";
import url from "node:url";
import { runCommandSync } from "./run_command.js";


const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const INPUT_PATH = path.join(dirname, "..", "src", "synthetizer", "worklet_processor.js");
const OUTPUT_PATH = path.join(dirname, "..", "synthetizer", "worklet_processor.min.js");

// esbuild src/synthetizer/worklet_processor.js --bundle --tree-shaking=true --minify --sourcemap=linked --format=esm --outfile=synthetizer/worklet_processor.min.js --platform=browser
esbuild.buildSync({
    entryPoints: [INPUT_PATH],
    bundle: true,
    treeShaking: true,
    minify: true,
    sourcemap: "linked",
    format: "esm",
    platform: "browser",
    outfile: OUTPUT_PATH,
    logLevel: "info"
});

runCommandSync("npm run build_examples");
console.log("spessasynth_lib built successfully");