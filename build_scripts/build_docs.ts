import { runCommandSync } from "./run_command";

export const buildDocs = () => {
    runCommandSync("npm run docs");
};
