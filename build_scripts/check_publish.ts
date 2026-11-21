import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const packagePath = path.join(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "..",
    "package.json"
);
const packageJSON = JSON.parse(fs.readFileSync(packagePath, "utf8")) as {
    dependencies?: Record<string, string>;
};
const core = packageJSON.dependencies?.spessasynth_core ?? "";
if (core.startsWith("file:")) {
    throw new Error(
        `spessasynth_core is linked locally (${core}). Run npm run deps:npm before publishing.`
    );
}
console.info(
    `spessasynth_core is ${core}. Using NPM version, so OK to publish.`
);
