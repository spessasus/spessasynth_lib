import fs from "fs";
import path from "path";
import esbuild from "esbuild";
import url from "url";
import { GH_PAGES_DIR } from "../build_scripts/util.ts";

export const buildExamples = () => {
    // File paths and directories
    const dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const TEMPLATE_FILE = path.join(dirname, `template.html`);
    const PARTIALS_DIR = path.join(dirname, "..", "examples", "examples_code");
    const OUTPUT_DIR = path.join(dirname, "..", GH_PAGES_DIR, "examples");
    const CSS_FILE = path.join(dirname, "examples.css");

    // Create out
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Copy CSS file to the output directory
    fs.copyFileSync(CSS_FILE, path.join(OUTPUT_DIR, "examples.css"));

    // Read the HTML template content
    const TEMPLATE_CONTENT = fs.readFileSync(TEMPLATE_FILE, "utf8");

    // Process each partial HTML file
    const partials = fs
        .readdirSync(PARTIALS_DIR)
        .filter((file) => file.endsWith(".html"));
    partials.forEach((partial) => {
        const partialPath = path.join(PARTIALS_DIR, partial);
        const basename = path.basename(partial, ".html");
        const outputFile = path.join(OUTPUT_DIR, `${basename}.html`);

        // Modify the template content with the specific title
        const modifiedTemplate = TEMPLATE_CONTENT.replace(
            /<title>.*<\/title>/,
            `<title>spessasynth_lib example: ${basename.replaceAll("_", " ")}</title>`
        );

        // Split header and footer based on placeholder div
        const header = modifiedTemplate
            .split("<div class='example_content'>")[0]
            .trimEnd();
        const footer = modifiedTemplate
            .split("<div class='example_content'>")[1]
            .split("</div>")[1];

        // Create the output HTML file
        const partialContent = fs.readFileSync(partialPath, "utf8");
        const outputHTML = `${header}\n<div class='example_content'>\n${partialContent}</div>${footer}\n`;

        fs.writeFileSync(outputFile, outputHTML);
        console.log(`compiled HTML: ${outputFile}`);
    });

    // Process each js file and bundle with esbuild
    const jsFiles = fs
        .readdirSync(PARTIALS_DIR)
        .filter((file) => file.endsWith(".js"));
    jsFiles.forEach((jsFile) => {
        const jsFilePath = path.join(PARTIALS_DIR, jsFile);
        const basename = path.basename(jsFile, ".js");
        const outputJsFile = path.join(OUTPUT_DIR, `${basename}.js`);

        try {
            // Use esbuild to bundle and minify the JS file
            esbuild.buildSync({
                entryPoints: [jsFilePath],
                bundle: true,
                treeShaking: true,
                minify: true,
                format: "esm",
                outfile: outputJsFile,
                platform: "browser",
                sourcemap: "linked"
            });
            console.log(`built: ${outputJsFile}`);
        } catch (err) {
            console.error(`error bundling: ${err as string}`);
        }
    });

    console.log("examples built successfully");
};
