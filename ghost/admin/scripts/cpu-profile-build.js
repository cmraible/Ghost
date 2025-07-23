#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔥 CPU Profiling Ember Build\n');

// Clean start
console.log('🧹 Cleaning build artifacts...');
execSync('rm -rf dist node_modules/.cache tmp', { stdio: 'inherit' });

// Install dependencies if needed
try {
    require.resolve('0x');
} catch (e) {
    console.log('📦 Installing 0x profiler...');
    execSync('npm install -g 0x', { stdio: 'inherit' });
}

console.log('\n🎯 Starting CPU profile of build process...');
console.log('This will generate an interactive flamegraph when complete.\n');

// Run the build with 0x profiler
const profileCmd = '0x --open -- node_modules/.bin/ember build --environment=development';

const profileProcess = spawn('bash', ['-c', profileCmd], {
    stdio: 'inherit',
    env: {
        ...process.env,
        // Disable some optimizations to get clearer profiling data
        NODE_ENV: 'development',
        // Ensure V8 profiling is enabled
        NODE_OPTIONS: '--no-turbo-inlining --max-old-space-size=4096'
    }
});

profileProcess.on('close', (code) => {
    if (code === 0) {
        console.log('\n✅ Profiling complete!');
        console.log('📊 The flamegraph should open automatically in your browser.');
        console.log('💡 Look for:');
        console.log('   - Wide bars (time-consuming functions)');
        console.log('   - Deep stacks (complex call chains)');
        console.log('   - Repeated patterns (optimization opportunities)');
    } else {
        console.error(`\n❌ Profiling failed with code ${code}`);
    }
});