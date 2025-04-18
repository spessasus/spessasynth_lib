import { runCommandSync } from "./run_command.js";

runCommandSync("npm uninstall spessasynth_core");
runCommandSync("npm install ../spessasynth_core");
runCommandSync("npm run build");

console.log("All commands completed successfully.");
