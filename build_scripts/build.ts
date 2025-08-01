import { runCommandSync } from "./run_command.ts";

console.log("Building spessasynth_lib...");
runCommandSync("npm run build:npm");
runCommandSync("npm run build:pages");
runCommandSync("npm run build:examples");
console.log("spessasynth_lib built successfully.");
