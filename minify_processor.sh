#!/bin/bash
cd "$(dirname "$0")" || exit
esbuild synthetizer/worklet_processor.js --bundle --tree-shaking=true --minify --sourcemap=linked --format=esm --outfile=synthetizer/worklet_processor.min.js --platform=browser
echo "Processor minified successfully"