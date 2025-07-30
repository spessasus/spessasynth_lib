import { runCommandSync } from "./run_command.js";


runCommandSync("pip install -r docs/requirements.txt");
runCommandSync("mkdocs build -s -d dist");