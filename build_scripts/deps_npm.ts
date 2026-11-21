import { runCommandSync } from "./run_command";

runCommandSync("npm uninstall spessasynth_core");
runCommandSync("npm install spessasynth_core");
runCommandSync("npm prune");

console.info("spessasynth_core now comes from the npm registry.");
