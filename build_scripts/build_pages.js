import path from "path";
import url from "url";
import fs from "fs";
import { runCommandSync } from "./run_command.js";


console.log("building pages");
const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(dirname, "..", "dist", "examples");


// create out and clear old files
if (fs.existsSync(OUTPUT_DIR))
{
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}

runCommandSync("npm run build:docs");
runCommandSync("npm run build:examples");