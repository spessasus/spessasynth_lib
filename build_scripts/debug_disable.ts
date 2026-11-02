import { runCommandSync } from "./run_command";

runCommandSync("npm uninstall spessasynth_core");
runCommandSync("npm install spessasynth_core");
runCommandSync("npm prune");
runCommandSync("npm update");
runCommandSync("npm run build");

console.log("All commands completed successfully.");
