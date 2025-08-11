import { runCommandSync } from "./run_command.ts";
import { GH_PAGES_DIR } from "./util.ts";

console.log("Building MkDocs...");
runCommandSync(`mkdocs build -c -s -d ${GH_PAGES_DIR}`);
console.log("MkDocs built successfully.");
