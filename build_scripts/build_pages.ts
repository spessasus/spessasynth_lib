import { buildDocs } from "./build_docs.ts";
import { buildExamples } from "../examples/build_examples.ts";

console.log("Building for GitHub Pages...");
try {
    buildDocs();
    buildExamples();
    console.log("Pages built successfully.");
} catch (error) {
    console.error(
        error,
        "\n\nFailed to build GitHub pages. Did you install MkDocs?"
    );
}
