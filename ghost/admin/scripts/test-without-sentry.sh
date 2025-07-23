#!/bin/bash

echo "🧪 Testing build performance without Sentry"
echo "=========================================="
echo ""

# Clean start
echo "🧹 Cleaning build artifacts..."
rm -rf dist node_modules/.cache tmp

# Backup package.json
cp package.json package.json.backup

echo ""
echo "📦 Removing Sentry packages..."

# Remove Sentry from package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Remove Sentry packages
delete pkg.devDependencies['@sentry/ember'];
delete pkg.devDependencies['@sentry/integrations'];
delete pkg.devDependencies['@sentry/replay'];
delete pkg.devDependencies['sentry-testkit'];

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('✅ Removed Sentry dependencies from package.json');
"

echo ""
echo "🔧 Creating Sentry stub..."

# Create a minimal stub to prevent import errors
mkdir -p app/utils
cat > app/utils/sentry-stub.js << 'EOF'
// Sentry stub for build testing
export function startSentry() {
  console.log('Sentry disabled for testing');
}

export const captureException = () => {};
export const captureMessage = () => {};
export const configureScope = () => {};

export default {
  startSentry,
  captureException,
  captureMessage,
  configureScope
};
EOF

# Update sentry.js to export stubs
cat > app/utils/sentry.js << 'EOF'
// Sentry disabled for build performance testing
export * from './sentry-stub';
export { default } from './sentry-stub';
EOF

echo ""
echo "⏱️  Running baseline build with Sentry disabled..."
echo ""

# Time the build
start_time=$(date +%s.%N)
yarn ember build --environment=development
end_time=$(date +%s.%N)

build_time=$(echo "$end_time - $start_time" | bc)
echo ""
echo "✅ Build completed in ${build_time}s"

# Check bundle size
echo ""
echo "📊 Bundle analysis:"
du -sh dist
echo ""
echo "Largest files:"
find dist -name "*.js" -type f -exec ls -lh {} \; | sort -k5 -hr | head -10

# Restore original files
echo ""
echo "🔄 Restoring original package.json..."
mv package.json.backup package.json
rm -f app/utils/sentry-stub.js

echo ""
echo "✅ Test complete!"
echo ""
echo "🎯 Results:"
echo "  Build time without Sentry: ${build_time}s"
echo ""
echo "💡 To permanently remove Sentry:"
echo "  1. yarn remove @sentry/ember @sentry/integrations @sentry/replay sentry-testkit"
echo "  2. Update all imports to remove Sentry references"
echo "  3. Remove Sentry configuration from config/environment.js"