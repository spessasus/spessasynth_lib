import * as child_process from "node:child_process";
import url from "node:url";
import path from "node:path";

// Resolve to root
const dirname = path.join(
    path.dirname(url.fileURLToPath(import.meta.url)),
    ".."
);

export function runCommandSync(command: string) {
    try {
        child_process.execSync(command, {
            stdio: "inherit",
            cwd: dirname,
            shell: process.platform === "win32" ? "cmd.exe" : undefined
        });
    } catch (error) {
        throw new Error(`Failed to execute ${command}`, { cause: error });
    }
}
