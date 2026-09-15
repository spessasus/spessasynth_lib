import { readdir } from "node:fs/promises";
import path from "node:path";
import { Application } from "typedoc";
import type MarkdownIt from "markdown-it";

import { admonitionPlugin } from "./markdown-it/admonition";
import { footnotePlugin } from "./markdown-it/footnotes";
import { snippetsPlugin } from "./markdown-it/snippets";

// noinspection JSUnusedGlobalSymbols
export function load(application: Application) {
    void (async () => {
        // Watch snippet sources so --watch rebuilds when examples change.
        // .ts files are already covered by tsconfig, but .html files are not.
        try {
            const dir = path.resolve(
                process.cwd(),
                "examples",
                "examples_code"
            );
            const entries = await readdir(dir);
            for (const file of entries) {
                application.watchFile(path.join(dir, file));
            }
        } catch {
            // No snippets
        }
    })();
    application.on(Application.EVENT_BOOTSTRAP_END, () => {
        application.options.setValue(
            "markdownItLoader",
            (parser: MarkdownIt) => {
                parser.use(admonitionPlugin);
                parser.use(footnotePlugin);
                parser.use(snippetsPlugin);
            }
        );
    });
}
