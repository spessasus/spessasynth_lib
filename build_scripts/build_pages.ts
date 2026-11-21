import { buildDocs } from "./build_docs";
import { buildExamples } from "../examples/build_examples";

console.info("Building for GitHub Pages...");
try {
    buildDocs();
    buildExamples();
    console.info("Pages built successfully.");
} catch (error) {
    console.error(error, "\n\nFailed to build GitHub pages.");
    process.exitCode = 1;
}
