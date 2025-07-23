#!/usr/bin/env node

const { performance, PerformanceObserver } = require('perf_hooks');
const fs = require('fs');
const Module = require('module');
const { spawn } = require('child_process');

console.log('🔍 Tracing Node.js Operations During Build\n');

// Track file operations
const fileOps = new Map();
const moduleLoads = new Map();

// Monkey-patch fs operations to track them
const originalReadFile = fs.readFile;
const originalReadFileSync = fs.readFileSync;
const originalWriteFile = fs.writeFile;
const originalWriteFileSync = fs.writeFileSync;
const originalStat = fs.stat;
const originalStatSync = fs.statSync;

function trackOperation(type, path, startTime) {
    const duration = performance.now() - startTime;
    const key = `${type}:${path}`;
    
    if (!fileOps.has(key)) {
        fileOps.set(key, { count: 0, totalTime: 0, type, path });
    }
    
    const op = fileOps.get(key);
    op.count++;
    op.totalTime += duration;
}

// Wrap sync operations
fs.readFileSync = function(path, ...args) {
    const start = performance.now();
    try {
        return originalReadFileSync.call(fs, path, ...args);
    } finally {
        trackOperation('readFileSync', path.toString(), start);
    }
};

fs.writeFileSync = function(path, ...args) {
    const start = performance.now();
    try {
        return originalWriteFileSync.call(fs, path, ...args);
    } finally {
        trackOperation('writeFileSync', path.toString(), start);
    }
};

fs.statSync = function(path, ...args) {
    const start = performance.now();
    try {
        return originalStatSync.call(fs, path, ...args);
    } finally {
        trackOperation('statSync', path.toString(), start);
    }
};

// Track module loads
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    const start = performance.now();
    try {
        return originalRequire.apply(this, arguments);
    } finally {
        const duration = performance.now() - start;
        if (!moduleLoads.has(id)) {
            moduleLoads.set(id, { count: 0, totalTime: 0 });
        }
        const load = moduleLoads.get(id);
        load.count++;
        load.totalTime += duration;
    }
};

// Set up performance observer for GC
const obs = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
        if (entry.entryType === 'gc') {
            console.log(`🗑️  GC: ${entry.kind} - ${entry.duration.toFixed(2)}ms`);
        }
    });
});
obs.observe({ entryTypes: ['gc'], buffered: true });

// Clean environment
console.log('🧹 Cleaning build artifacts...');
require('child_process').execSync('rm -rf dist node_modules/.cache tmp', { stdio: 'inherit' });

console.log('\n📊 Starting traced build...\n');

const buildStart = performance.now();

// Run the build as a child process
const child = spawn('yarn', ['ember', 'build', '--environment=development'], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_OPTIONS: '--expose-gc --trace-warnings'
    }
});

child.on('close', (code) => {
    const totalTime = ((performance.now() - buildStart) / 1000).toFixed(2);
    
    console.log(`\n✅ Build completed in ${totalTime}s with code ${code}\n`);
    
    // Analyze file operations
    const sortedFileOps = Array.from(fileOps.values())
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 20);
    
    console.log('🔥 Top 20 File Operations by Total Time:');
    console.log('==========================================');
    sortedFileOps.forEach(op => {
        const avgTime = (op.totalTime / op.count).toFixed(2);
        const shortPath = op.path.replace(process.cwd(), '.');
        console.log(`${op.type.padEnd(15)} ${op.count.toString().padStart(5)} calls, ${op.totalTime.toFixed(0).padStart(6)}ms total, ${avgTime.padStart(6)}ms avg - ${shortPath}`);
    });
    
    // Analyze module loads
    const sortedModules = Array.from(moduleLoads.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 10);
    
    console.log('\n🔥 Top 10 Module Loads by Total Time:');
    console.log('=====================================');
    sortedModules.forEach(mod => {
        const avgTime = (mod.totalTime / mod.count).toFixed(2);
        console.log(`${mod.id.padEnd(50)} ${mod.count.toString().padStart(3)} loads, ${mod.totalTime.toFixed(0).padStart(6)}ms total, ${avgTime.padStart(6)}ms avg`);
    });
    
    // Summary statistics
    const totalFileOps = Array.from(fileOps.values()).reduce((sum, op) => sum + op.count, 0);
    const totalFileTime = Array.from(fileOps.values()).reduce((sum, op) => sum + op.totalTime, 0) / 1000;
    const totalModuleLoads = Array.from(moduleLoads.values()).reduce((sum, m) => sum + m.count, 0);
    const totalModuleTime = Array.from(moduleLoads.values()).reduce((sum, m) => sum + m.totalTime, 0) / 1000;
    
    console.log('\n📊 Summary Statistics:');
    console.log('======================');
    console.log(`Total file operations: ${totalFileOps}`);
    console.log(`Time in file ops: ${totalFileTime.toFixed(2)}s (${((totalFileTime / parseFloat(totalTime)) * 100).toFixed(1)}% of build time)`);
    console.log(`Total module loads: ${totalModuleLoads}`);
    console.log(`Time in module loads: ${totalModuleTime.toFixed(2)}s (${((totalModuleTime / parseFloat(totalTime)) * 100).toFixed(1)}% of build time)`);
    
    process.exit(code);
});