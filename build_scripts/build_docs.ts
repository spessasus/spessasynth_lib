import { runCommandSync } from "./run_command.ts";
import { GH_PAGES_DIR } from "./util.ts";

export const buildDocs = () => {
    console.log("Building Zensical...");
    runCommandSync(`rm -rf ${GH_PAGES_DIR}`);
    runCommandSync(`zensical build --clean`);
    console.log("MkDocs built successfully.");
};
