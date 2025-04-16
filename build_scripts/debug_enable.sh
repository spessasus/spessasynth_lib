#!/bin/bash
cd "$(dirname "$0")" || exit

cd ..

npm uninstall spessasynth_core
npm install ../spessasynth_core
npm run build