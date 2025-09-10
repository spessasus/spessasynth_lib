import * as tsup from "tsup";

console.log("Building NPM package...");
try {
    // Main bundle
    await tsup.build({
        entry: ["src/index.ts"],
        format: "esm",
        dts: true,
        sourcemap: true,
        outDir: "dist"
    });

    console.log("NPM package built successfully.");
} catch (e) {
    console.error(e, "\nFailed to build the NPM package.");
}
