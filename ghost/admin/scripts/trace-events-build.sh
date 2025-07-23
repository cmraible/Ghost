#!/bin/bash

echo "🔍 Capturing Trace Events for Build Process"
echo "==========================================="
echo ""

# Clean start
echo "🧹 Cleaning build artifacts..."
rm -rf dist node_modules/.cache tmp

echo ""
echo "📊 Starting build with trace events enabled..."
echo "This will capture both JavaScript and native operations."
echo ""

# Run build with trace events
node --trace-event-categories=node,node.async_hooks,node.fs.sync,v8,node.perf --trace-event-file-pattern='trace-${pid}.log' \
    node_modules/.bin/ember build --environment=development

echo ""
echo "✅ Build completed!"
echo ""
echo "📄 Trace files generated:"
ls -la trace-*.log

echo ""
echo "🔥 To analyze the trace:"
echo "   1. Open Chrome/Edge"
echo "   2. Navigate to chrome://tracing"
echo "   3. Click 'Load' and select the trace-*.log file"
echo ""
echo "💡 Look for:"
echo "   - Long bars in the flame chart (time-consuming operations)"
echo "   - FileSystem operations (open, read, write, stat)"
echo "   - Module loading patterns"
echo "   - GC pauses"
echo "   - Main thread blocking"