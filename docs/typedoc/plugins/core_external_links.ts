import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Application } from "typedoc";

const CORE_PACKAGE = "spessasynth_core";
const CORE_DOCS = "https://spessasus.github.io/spessasynth_core";

const KIND_DIRECTORIES: Record<string, string> = {
    class: "classes",
    interface: "interfaces",
    enum: "enums",
    namespace: "modules",
    type: "types",
    function: "functions",
    const: "variables",
    let: "variables",
    var: "variables"
};

const DECLARATION_PATTERN =
    /^(?:export\s+)?(?:declare\s+)?(abstract\s+class|class|interface|enum|namespace|type|function|const|let|var)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_ITEM_PATTERN =
    /^(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/;

function hasDocComment(lines: string[], index: number) {
    let cursor = index - 1;
    while (cursor >= 0 && lines[cursor].trim() === "") {
        cursor--;
    }
    return cursor >= 0 && lines[cursor].trimEnd().endsWith("*/");
}

// Export names and declaration kinds are read from dist/index.d.ts
function buildCoreLinks() {
    const links = new Map<string, string>();
    try {
        const require = createRequire(import.meta.url);
        const packagePath = require.resolve(`${CORE_PACKAGE}/package.json`);
        const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
            types?: string;
            typings?: string;
        };
        const declarationsUrl = new URL(
            packageJson.types ?? packageJson.typings ?? "dist/index.d.ts",
            pathToFileURL(packagePath).href
        );
        const lines = readFileSync(
            fileURLToPath(declarationsUrl),
            "utf8"
        ).split("\n");

        const kinds = new Map<string, string>();
        const documented = new Set<string>();
        for (const [index, line] of lines.entries()) {
            const match = DECLARATION_PATTERN.exec(line);
            if (!match) continue;

            const kind = match[1] === "abstract class" ? "class" : match[1];
            if (!kinds.has(match[2])) kinds.set(match[2], kind);

            if (hasDocComment(lines, index)) documented.add(match[2]);
        }

        const text = lines.join("\n");
        for (const block of text.matchAll(/^export\s*\{([\s\S]*?)};/gm)) {
            for (const item of block[1].split(",")) {
                const match = EXPORT_ITEM_PATTERN.exec(item.trim());
                if (!match) {
                    continue;
                }
                const exported = match[2] ?? match[1];
                const kind = kinds.get(match[1]);
                if (kind && documented.has(match[1]) && !links.has(exported)) {
                    links.set(
                        exported,
                        `${CORE_DOCS}/${KIND_DIRECTORIES[kind]}/${exported}/`
                    );
                }
            }
        }
    } catch {
        // Core is unavailable, links stay unlinked
    }
    return links;
}

// noinspection JSUnusedGlobalSymbols
export function load(application: Application) {
    const links = buildCoreLinks();
    application.converter.addUnknownSymbolResolver((ref) => {
        const parts = ref.symbolReference?.path;
        if (!parts) return;

        const name = parts.map((part) => part.path).join(".");
        if (ref.moduleSource === CORE_PACKAGE) return links.get(name);

        if (ref.resolutionStart === "local" && parts.length === 1)
            return links.get(name);

        // Local member links to documented core exports
        if (ref.resolutionStart === "local" && parts.length === 2) {
            const target = links.get(parts[0].path);
            if (target) {
                return `${target}#${parts[1].path.toLowerCase()}`;
            }
        }
        return undefined;
    });
}
