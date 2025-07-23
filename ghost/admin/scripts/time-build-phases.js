#!/usr/bin/env node

const { execSync } = require('child_process');
const { performance } = require('perf_hooks');

console.log('⏱️  Build Phase Timing Analysis\n');

function timeCommand(label, command, options = {}) {
    const start = performance.now();
    try {
        execSync(command, { stdio: 'inherit', ...options });
        const duration = ((performance.now() - start) / 1000).toFixed(2);
        console.log(`✅ ${label}: ${duration}s`);
        return { label, duration: parseFloat(duration), success: true };
    } catch (error) {
        const duration = ((performance.now() - start) / 1000).toFixed(2);
        console.log(`❌ ${label}: ${duration}s (failed)`);
        return { label, duration: parseFloat(duration), success: false, error: error.message };
    }
}

async function analyzeBuildPhases() {
    const results = [];
    
    // Clean start
    console.log('🧹 Cleaning build artifacts...\n');
    execSync('rm -rf dist node_modules/.cache tmp', { stdio: 'inherit' });
    
    // Test individual build components
    console.log('📊 Testing build phases:\n');
    
    // 1. Test pure Ember build without addons
    results.push(timeCommand(
        'Ember core build',
        'yarn ember build --environment=development --suppress-sizes --silent'
    ));
    
    console.log('\n🔍 Checking build output size...');
    try {
        const distSize = execSync('du -sh dist', { encoding: 'utf8' }).trim();
        console.log(`   Build size: ${distSize}`);
    } catch (e) {}
    
    // 2. Check if webpack/ember-auto-import is the bottleneck
    console.log('\n🔍 Analyzing webpack bundle...');
    
    // Check for webpack stats
    try {
        const webpackStats = execSync('find dist -name "*.map" | wc -l', { encoding: 'utf8' }).trim();
        console.log(`   Source map files: ${webpackStats}`);
    } catch (e) {}
    
    // 3. Analyze dependencies that might be slow
    console.log('\n📦 Analyzing heavy dependencies...');
    
    const heavyDeps = [
        '@sentry/ember',
        'ember-auto-import',
        'liquid-fire',
        'codemirror',
        '@tryghost/koenig-lexical'
    ];
    
    heavyDeps.forEach(dep => {
        try {
            const size = execSync(`du -sh node_modules/${dep} 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
            if (size) {
                console.log(`   ${dep}: ${size}`);
            }
        } catch (e) {}
    });
    
    // 4. Test with minimal PostCSS
    console.log('\n🎨 Testing CSS processing impact...');
    const cssFiles = execSync('find app/styles -name "*.css" | wc -l', { encoding: 'utf8' }).trim();
    console.log(`   CSS files to process: ${cssFiles}`);
    
    // Summary
    console.log('\n📊 Build Phase Summary:');
    console.log('======================');
    
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`Total time: ${totalTime.toFixed(2)}s`);
    
    // Try to identify bottlenecks
    console.log('\n🎯 Potential Bottlenecks:');
    
    // Check if PostCSS is slow
    if (parseInt(cssFiles) > 50) {
        console.log('- Large number of CSS files (consider concatenation)');
    }
    
    // Check node_modules size
    try {
        const nodeModulesSize = execSync('du -sh node_modules | cut -f1', { encoding: 'utf8' }).trim();
        console.log(`- node_modules size: ${nodeModulesSize}`);
    } catch (e) {}
    
    // Check for .map files indicating source map generation
    try {
        const mapFiles = execSync('find dist -name "*.map" -size +1M | wc -l', { encoding: 'utf8' }).trim();
        if (parseInt(mapFiles) > 0) {
            console.log(`- ${mapFiles} large source map files (>1MB each)`);
        }
    } catch (e) {}
}

analyzeBuildPhases().catch(console.error);