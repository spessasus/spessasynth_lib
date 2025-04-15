#!/bin/bash
cd "$(dirname "$0")" || exit

echo "building examples..."



# build html

TEMPLATE_FILE="template.html"
PARTIALS_DIR="examples_src"
OUTPUT_DIR="../docs/examples"

# clear the old ones
rm -rf $OUTPUT_DIR
mkdir -p $OUTPUT_DIR

cp examples.css "$OUTPUT_DIR/examples.css"

ln ../synthetizer/worklet_processor.min.js "$OUTPUT_DIR/worklet_processor.min.js"

# read template
TEMPLATE_CONTENT=$(<"$TEMPLATE_FILE")

# loop through
for PARTIAL in "$PARTIALS_DIR"/*.html; do
    BASENAME=$(basename "$PARTIAL" .html)
    OUTPUT_FILE="$OUTPUT_DIR/$BASENAME.html"

    # replace title
    MODIFIED_TEMPLATE=$(echo "$TEMPLATE_CONTENT" | sed "s|<title>.*</title>|<title>spessasynth_lib example: $BASENAME</title>|")

    # split header and footer based on placeholder div
    HEADER=$(echo "$MODIFIED_TEMPLATE" | awk '/<div class=.example_content.>/ {exit} {print}')
    FOOTER=$(echo "$MODIFIED_TEMPLATE" | awk '/<div class=.example_content.>/,EOF' | tail -n +2)

    touch $OUTPUT_FILE
    {
        echo "$HEADER"
        echo "<div class='example_content'>"
        cat "$PARTIAL"
        echo "$FOOTER"
    } > "$OUTPUT_FILE"

    echo "built: $OUTPUT_FILE"
done

for file in "$PARTIALS_DIR"/*.js; do
  [ -e "$file" ] || continue
  BASENAME=$(basename "$file" .js)

  # Run esbuild
  esbuild "$file" \
    --bundle \
    --tree-shaking=true \
    --minify \
    --format=esm \
    --outfile="$OUTPUT_DIR/$BASENAME.js" \
    --platform=browser
done

echo "examples built successfully"