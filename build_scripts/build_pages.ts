import { runCommandSync } from "./run_command.ts";

console.log("Building for GitHub Pages...");
runCommandSync("npm run build:docs");
runCommandSync("npm run build:examples");
console.log("Pages built successfully.");
