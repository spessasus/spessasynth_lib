import { runCommandSync } from "./run_command";

runCommandSync("npm uninstall spessasynth_core");
runCommandSync("npm install ../spessasynth_core");
runCommandSync("npm run build:fast");

console.info("spessasynth_core now links ../spessasynth_core.");
