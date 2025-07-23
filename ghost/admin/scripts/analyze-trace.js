#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Find the trace file
const traceFiles = fs.readdirSync('.').filter(f => f.startsWith('trace-') && f.endsWith('.log'));
if (traceFiles.length === 0) {
    console.error('No trace files found. Run trace-events-build.sh first.');
    process.exit(1);
}

const traceFile = traceFiles[traceFiles.length - 1]; // Get the most recent
console.log(`📊 Analyzing ${traceFile}...\n`);

const traceData = fs.readFileSync(traceFile, 'utf8');
const events = traceData.split('\n')
    .filter(line => line.trim())
    .map(line => {
        try {
            return JSON.parse(line);
        } catch (e) {
            return null;
        }
    })
    .filter(e => e);

console.log(`Total events: ${events.length}`);

// Categorize events
const categories = {
    fs: { read: 0, write: 0, stat: 0, open: 0, total: 0, time: 0 },
    gc: { count: 0, time: 0 },
    compile: { count: 0, time: 0 },
    async: { count: 0 },
    other: { count: 0 }
};

const fileOperations = new Map();
const durations = [];

events.forEach(event => {
    if (event.cat === 'node,node.fs.sync' || event.cat === 'node.fs.sync') {
        categories.fs.total++;
        
        if (event.name.includes('read')) categories.fs.read++;
        else if (event.name.includes('write')) categories.fs.write++;
        else if (event.name.includes('stat')) categories.fs.stat++;
        else if (event.name.includes('open')) categories.fs.open++;
        
        if (event.dur) {
            categories.fs.time += event.dur / 1000; // Convert to ms
            
            // Track individual file operations
            if (event.args && event.args.path) {
                const path = event.args.path;
                if (!fileOperations.has(path)) {
                    fileOperations.set(path, { count: 0, time: 0 });
                }
                fileOperations.get(path).count++;
                fileOperations.get(path).time += event.dur / 1000;
            }
        }
    } else if (event.cat === 'v8' && event.name.includes('GC')) {
        categories.gc.count++;
        if (event.dur) categories.gc.time += event.dur / 1000;
    } else if (event.cat === 'v8.compile') {
        categories.compile.count++;
        if (event.dur) categories.compile.time += event.dur / 1000;
    } else if (event.cat === 'node.async_hooks') {
        categories.async.count++;
    } else {
        categories.other.count++;
    }
    
    if (event.dur && event.dur > 1000) { // Track operations > 1ms
        durations.push({ name: event.name, dur: event.dur / 1000, cat: event.cat });
    }
});

// Sort operations by duration
durations.sort((a, b) => b.dur - a.dur);

console.log('\n📊 Event Categories:');
console.log('===================');
console.log(`File System Operations: ${categories.fs.total} (${categories.fs.time.toFixed(0)}ms total)`);
console.log(`  - Read: ${categories.fs.read}`);
console.log(`  - Write: ${categories.fs.write}`);
console.log(`  - Stat: ${categories.fs.stat}`);
console.log(`  - Open: ${categories.fs.open}`);
console.log(`Garbage Collection: ${categories.gc.count} events (${categories.gc.time.toFixed(0)}ms)`);
console.log(`V8 Compilation: ${categories.compile.count} events (${categories.compile.time.toFixed(0)}ms)`);
console.log(`Async Operations: ${categories.async.count}`);
console.log(`Other: ${categories.other.count}`);

console.log('\n🔥 Top 20 Slowest Operations (>1ms):');
console.log('====================================');
durations.slice(0, 20).forEach(op => {
    console.log(`${op.dur.toFixed(1).padStart(8)}ms - ${op.name} [${op.cat}]`);
});

// Most accessed files
const topFiles = Array.from(fileOperations.entries())
    .map(([path, data]) => ({ path, ...data }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 20);

console.log('\n📁 Top 20 Most Time-Consuming File Paths:');
console.log('=========================================');
topFiles.forEach(file => {
    const shortPath = file.path.replace(process.cwd(), '.');
    console.log(`${file.time.toFixed(1).padStart(8)}ms - ${file.count.toString().padStart(4)} ops - ${shortPath}`);
});

// Summary
const totalTracedTime = categories.fs.time + categories.gc.time + categories.compile.time;
console.log('\n📈 Summary:');
console.log('===========');
console.log(`Total traced time: ${totalTracedTime.toFixed(0)}ms`);
console.log(`File system: ${((categories.fs.time / totalTracedTime) * 100).toFixed(1)}%`);
console.log(`GC: ${((categories.gc.time / totalTracedTime) * 100).toFixed(1)}%`);
console.log(`Compilation: ${((categories.compile.time / totalTracedTime) * 100).toFixed(1)}%`);