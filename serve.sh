#!/bin/bash

echo "🧹 Cleaning previous build..."
# Clean previous build and indices
rm -rf public/* resources/* assets/indices/*

echo "🔄 Running preprocess.py..."
# Run preprocessing
python3 preprocess.py --source_path content --target_path content --target_attachment_path static

echo "📊 Generating initial graph data..."
# Generate initial graph data
mkdir -p assets/indices
echo '{
  "index": {
    "links": {},
    "backlinks": {},
    "tags": {}
  },
  "links": [],
  "tags": []
}' > assets/indices/linkIndex.json

# Process all markdown files to build link index
for file in content/*.md; do
  filename=$(basename "$file" .md)
  links=$(grep -o '\[\[[^]]*\]\]' "$file" | sed 's/\[\[\([^]]*\)\]\]/\1/g' | sed 's/|.*$//' | sort -u)
  if [ ! -z "$links" ]; then
    # Convert links to JSON array
    json_links=$(echo "$links" | jq -R . | jq -s .)
    # Add to linkIndex.json
    tmp=$(mktemp)
    jq --arg key "$filename" --argjson arr "$json_links" '.index.links[$key] = $arr' assets/indices/linkIndex.json > "$tmp" && mv "$tmp" assets/indices/linkIndex.json
  fi
done

echo "🔄 Running postprocess.py..."
# Run postprocessing to clean up the graph data
python3 postprocess.py

echo "🚀 Starting development server..."
# Start Hugo server
hugo server --enableGitInfo --poll 5000
