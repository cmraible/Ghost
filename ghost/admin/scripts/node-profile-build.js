#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔥 CPU Profiling with Node.js Inspector\n');

// Clean start
console.log('🧹 Cleaning build artifacts...');
execSync('rm -rf dist node_modules/.cache tmp', { stdio: 'inherit' });

console.log('\n🎯 Starting CPU profile...');

// Create profiles directory
const profileDir = path.join(__dirname, '..', 'profiles');
if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const cpuProfilePath = path.join(profileDir, `build-cpu-${timestamp}.cpuprofile`);

// Run ember build with inspector and CPU profiling
const buildProcess = spawn('node', [
    '--inspect-brk=0',
    '--cpu-prof',
    '--cpu-prof-dir=' + profileDir,
    'node_modules/.bin/ember',
    'build',
    '--environment=development'
], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=4096'
    }
});

let debuggerUrl = null;

buildProcess.stderr.on('data', (data) => {
    const output = data.toString();
    process.stderr.write(output);
    
    // Look for debugger URL
    const match = output.match(/ws:\/\/[^\s]+/);
    if (match && !debuggerUrl) {
        debuggerUrl = match[0];
        console.log(`\n🔗 Debugger URL: ${debuggerUrl}`);
        console.log('📝 You can open Chrome DevTools and navigate to chrome://inspect to see live profiling\n');
        
        // Auto-continue execution after a short delay
        setTimeout(() => {
            console.log('▶️  Continuing build execution...\n');
            // Send continue command via inspector protocol
            const inspectorCmd = `echo 'c' | nc -w 1 127.0.0.1 9229 2>/dev/null || true`;
            execSync(inspectorCmd);
        }, 2000);
    }
});

buildProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
});

buildProcess.on('close', (code) => {
    if (code === 0) {
        console.log('\n✅ Build completed successfully!');
        
        // Find the generated CPU profile
        const profiles = fs.readdirSync(profileDir)
            .filter(f => f.endsWith('.cpuprofile'))
            .sort()
            .reverse();
            
        if (profiles.length > 0) {
            const latestProfile = path.join(profileDir, profiles[0]);
            console.log(`\n📊 CPU profile saved to: ${latestProfile}`);
            console.log('\n🔥 To view the flamegraph:');
            console.log('   1. Open Chrome DevTools');
            console.log('   2. Go to the Performance tab');
            console.log('   3. Click "Load profile" button');
            console.log(`   4. Select: ${latestProfile}`);
            console.log('\n💡 Or use VS Code: right-click the .cpuprofile file → "Open with CPU Profile Visualizer"');
            
            // Try to open with speedscope if available
            try {
                console.log('\n🚀 Attempting to open with speedscope...');
                execSync(`npx speedscope "${latestProfile}"`, { stdio: 'inherit' });
            } catch (e) {
                console.log('   (speedscope not available - install with: npm install -g speedscope)');
            }
        }
    } else {
        console.error(`\n❌ Build failed with code ${code}`);
    }
});