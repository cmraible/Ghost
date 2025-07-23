#!/bin/bash

echo "⏱️  Build Time Analysis"
echo "======================"
echo ""

# Clean start
rm -rf dist node_modules/.cache tmp

# Function to time a command
time_command() {
    local label=$1
    shift
    local start=$(date +%s.%N)
    echo -n "$label: "
    "$@" > /tmp/build_output.log 2>&1
    local end=$(date +%s.%N)
    local duration=$(echo "$end - $start" | bc)
    echo "${duration}s"
}

# Time the full build
echo "Starting cold build..."
start_total=$(date +%s.%N)

# Run the build and capture key timing points
yarn ember build --environment=development 2>&1 | while IFS= read -r line; do
    current_time=$(date +%s.%N)
    elapsed=$(echo "$current_time - $start_total" | bc)
    
    # Look for key phases
    if [[ $line == *"Building"* ]]; then
        printf "[%6.2fs] 🔨 Build phase started\n" $elapsed
    elif [[ $line == *"building..."* ]]; then
        printf "[%6.2fs] 🏗️  Core building phase\n" $elapsed
    elif [[ $line == *"Bundling"* ]]; then
        printf "[%6.2fs] 📦 Bundling phase\n" $elapsed
    elif [[ $line == *"Built project successfully"* ]]; then
        printf "[%6.2fs] ✅ Build completed\n" $elapsed
    elif [[ $line == *"File sizes:"* ]]; then
        printf "[%6.2fs] 📊 Calculating file sizes\n" $elapsed
    elif [[ $line == *"Total size:"* ]]; then
        echo "$line"
    fi
done

end_total=$(date +%s.%N)
total_duration=$(echo "$end_total - $start_total" | bc)

echo ""
echo "Total build time: ${total_duration}s"