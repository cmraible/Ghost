#!/usr/bin/env node

const fs = require('fs');

const dotFile = fs.readFileSync('broccoli-viz.0.dot', 'utf8');

// Parse node information
const nodeRegex = /(\d+) \[.*label="([^"]+)"\]/g;
const nodes = new Map();

let match;
while ((match = nodeRegex.exec(dotFile)) !== null) {
    const [, id, label] = match;
    const lines = label.split('\\n');
    const name = lines[1] || lines[0];
    const timeSelfMatch = label.match(/time\.self \((\d+)ms\)/);
    const timeTotalMatch = label.match(/time\.total \((\d+)ms\)/);
    
    nodes.set(id, {
        id,
        name,
        timeSelf: timeSelfMatch ? parseInt(timeSelfMatch[1]) : 0,
        timeTotal: timeTotalMatch ? parseInt(timeTotalMatch[1]) : 0
    });
}

// Sort by total time
const sortedNodes = Array.from(nodes.values())
    .filter(n => n.timeTotal > 100) // Only show operations > 100ms
    .sort((a, b) => b.timeTotal - a.timeTotal);

console.log('🔥 Broccoli Build Profile Analysis');
console.log('==================================\n');

const totalTime = sortedNodes[0]?.timeTotal || 0;

console.log('Top 20 Slowest Operations:');
console.log('-------------------------');
sortedNodes.slice(0, 20).forEach((node, i) => {
    const percentage = ((node.timeTotal / totalTime) * 100).toFixed(1);
    const selfPercentage = ((node.timeSelf / node.timeTotal) * 100).toFixed(1);
    
    console.log(`${(i + 1).toString().padStart(2)}. ${node.name.padEnd(35)} ${node.timeTotal.toString().padStart(6)}ms (${percentage.padStart(5)}% of total)`);
    
    if (node.timeSelf > 10) {
        console.log(`    └─ Self time: ${node.timeSelf}ms (${selfPercentage}% of operation)`);
    }
});

// Group by operation type
const groups = {};
sortedNodes.forEach(node => {
    const type = node.name.split(':')[0].split(' ')[0];
    if (!groups[type]) groups[type] = { count: 0, totalTime: 0 };
    groups[type].count++;
    groups[type].totalTime += node.timeTotal;
});

console.log('\n\nTime by Operation Type:');
console.log('----------------------');
Object.entries(groups)
    .sort((a, b) => b[1].totalTime - a[1].totalTime)
    .forEach(([type, data]) => {
        const percentage = ((data.totalTime / totalTime) * 100).toFixed(1);
        console.log(`${type.padEnd(25)} ${data.totalTime.toString().padStart(6)}ms (${percentage.padStart(5)}%) - ${data.count} operations`);
    });

console.log('\n\n🎯 Key Bottlenecks:');
console.log('------------------');

const webpackNode = sortedNodes.find(n => n.name.includes('webpack'));
if (webpackNode) {
    console.log(`1. Webpack bundling: ${webpackNode.timeTotal}ms (${((webpackNode.timeTotal / totalTime) * 100).toFixed(1)}%)`);
    console.log('   → This is ember-auto-import processing npm dependencies');
}

const postcssNodes = sortedNodes.filter(n => n.name.toLowerCase().includes('postcss') || n.name.includes('CSS'));
if (postcssNodes.length > 0) {
    const postcssTotal = postcssNodes.reduce((sum, n) => sum + n.timeTotal, 0);
    console.log(`2. PostCSS processing: ${postcssTotal}ms (${((postcssTotal / totalTime) * 100).toFixed(1)}%)`);
    console.log('   → Processing 127 CSS files through multiple plugins');
}

const mergeNodes = sortedNodes.filter(n => n.name.includes('Merge'));
if (mergeNodes.length > 0) {
    const mergeTotal = mergeNodes.reduce((sum, n) => sum + n.timeTotal, 0);
    console.log(`3. File merging: ${mergeTotal}ms (${((mergeTotal / totalTime) * 100).toFixed(1)}%)`);
    console.log('   → Combining output files from various build steps');
}