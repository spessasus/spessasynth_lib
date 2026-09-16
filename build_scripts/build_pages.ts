import { buildDocs } from "./build_docs";
import { buildExamples } from "../examples/build_examples";

console.log("Building for GitHub Pages...");
try {
    buildDocs();
    buildExamples();
    console.log("Pages built successfully.");
} catch (error) {
    console.error(error, "\n\nFailed to build GitHub pages.");
}
