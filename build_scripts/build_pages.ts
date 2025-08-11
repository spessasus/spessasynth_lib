import { buildDocs } from "./build_docs.ts";
import { buildExamples } from "../examples/build_examples.ts";

console.log("Building for GitHub Pages...");
buildDocs();
buildExamples();
console.log("Pages built successfully.");
