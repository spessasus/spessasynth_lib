import { runCommandSync } from "./run_command.ts";

runCommandSync("npm uninstall spessasynth_core");
runCommandSync("npm install spessasynth_core");
runCommandSync("npm pkg set dependencies.spessasynth_core=latest");
runCommandSync("npm update");
runCommandSync("npm run build");

console.log("All commands completed successfully.");
