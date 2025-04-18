import * as child_process from "node:child_process";


export function runCommandSync(command)
{
    const [cmd, ...args] = command.split(" ");
    const process = child_process.spawnSync(cmd, args, { stdio: "inherit" });
    
    if (process.error)
    {
        console.error(`Error executing command: ${command}`, process.error);
        process.exit(process.status);
    }
}