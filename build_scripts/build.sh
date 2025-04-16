#!/bin/bash
cd "$(dirname "$0")" || exit

cd ..

chmod +x examples/build_examples.sh
./examples/build_examples.sh

esbuild src/synthetizer/worklet_processor.js --bundle --tree-shaking=true --minify --sourcemap=linked --format=esm --outfile=synthetizer/worklet_processor.min.js --platform=browser
echo "Processor minified successfully"