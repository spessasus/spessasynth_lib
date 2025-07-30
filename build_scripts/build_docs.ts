import { runCommandSync } from "./run_command.ts";
import { GH_PAGES_DIR } from "./util.ts";

console.log("Building MkDocs...");
runCommandSync("pip install -r docs/requirements.txt");
runCommandSync(`mkdocs build -s -d ${GH_PAGES_DIR}`);
console.log("MkDocs built successfully.");
