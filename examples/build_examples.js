import fs from "fs";
import path from "path";
import esbuild from "esbuild";
import url from "url";

console.log("building examples");
// file paths and directories
const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const TEMPLATE_FILE = path.join(dirname, `template.html`);
const PARTIALS_DIR = path.join(dirname, "examples_src");
const OUTPUT_DIR = path.join(dirname, "..", "dist", "examples");
const CSS_FILE = path.join(dirname, "examples.css");
const WORKLET_JS_FILE = path.join(dirname, "..", "synthetizer", "worklet_processor.min.js");


// create out and clear old files
if (fs.existsSync(OUTPUT_DIR))
{
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// copy CSS file to the output directory
fs.copyFileSync(CSS_FILE, path.join(OUTPUT_DIR, "examples.css"));
fs.copyFileSync(WORKLET_JS_FILE, path.join(OUTPUT_DIR, "worklet_processor.min.js"));


// read the HTML template content
const TEMPLATE_CONTENT = fs.readFileSync(TEMPLATE_FILE, "utf8");

// process each partial HTML file
const partials = fs.readdirSync(PARTIALS_DIR).filter(file => file.endsWith(".html"));
partials.forEach(partial =>
{
    const partialPath = path.join(PARTIALS_DIR, partial);
    const basename = path.basename(partial, ".html");
    const outputFile = path.join(OUTPUT_DIR, `${basename}.html`);
    
    // modify the template content with the specific title
    let modifiedTemplate = TEMPLATE_CONTENT.replace(
        /<title>.*<\/title>/,
        `<title>spessasynth_lib example: ${basename}</title>`
    );
    
    // split header and footer based on placeholder div
    const header = modifiedTemplate.split("<div class='example_content'>")[0].trimEnd();
    const footer = modifiedTemplate.split("<div class='example_content'>")[1].split("</div>")[1];
    
    // create the output HTML file
    const partialContent = fs.readFileSync(partialPath, "utf8");
    const outputHTML = `${header}\n<div class='example_content'>\n${partialContent}</div>${footer}\n`;
    
    fs.writeFileSync(outputFile, outputHTML);
    console.log(`compiled HTML: ${outputFile}`);
});

// process each js file and bundle with esbuild
const jsFiles = fs.readdirSync(PARTIALS_DIR).filter(file => file.endsWith(".js"));
jsFiles.forEach(jsFile =>
{
    const jsFilePath = path.join(PARTIALS_DIR, jsFile);
    const basename = path.basename(jsFile, ".js");
    const outputJsFile = path.join(OUTPUT_DIR, `${basename}.js`);
    
    try
    {
        // Use esbuild to bundle and minify the JS file
        esbuild.buildSync({
            entryPoints: [jsFilePath],
            bundle: true,
            treeShaking: true,
            minify: true,
            format: "esm",
            outfile: outputJsFile,
            platform: "browser"
        });
        console.log(`built: ${outputJsFile}`);
    }
    catch (err)
    {
        console.error(`error bundling: ${err.message}`);
    }
});

console.log("examples built successfully");
