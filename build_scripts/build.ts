import { runCommandSync } from "./run_command";

console.info("Building spessasynth_lib...");
runCommandSync("npm run build:npm");
runCommandSync("npm run build:pages");
console.info("spessasynth_lib built successfully.");
