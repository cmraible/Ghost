#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

function measureBuild(name, runs = 3) {
    const times = [];
    
    for (let i = 0; i < runs; i++) {
        console.log(`  Run ${i + 1}/${runs}...`);
        const start = Date.now();
        
        try {
            execSync('yarn build:dev', { 
                stdio: 'pipe',
                encoding: 'utf8'
            });
        } catch (error) {
            console.error(`Build failed: ${error.message}`);
            return null;
        }
        
        const duration = Date.now() - start;
        times.push(duration);
    }
    
    const avg = Math.round(times.reduce((a, b) => a + b) / times.length);
    return { times, avg };
}

console.log('🔬 Testing Individual Webpack Optimizations');
console.log('==========================================\n');

console.log('Instructions: Apply each optimization manually to ember-cli-build.js,');
console.log('then press Enter to run the test.\n');

const tests = [
    {
        name: 'baseline',
        description: 'Original configuration (no optimizations)',
        instructions: 'Ensure ember-cli-build.js has the original webpack config'
    },
    {
        name: 'skipBabel',
        description: 'Add skipBabel for pre-built packages',
        instructions: `Add this after the alias section in autoImport:

            // Skip Babel transpilation for pre-built packages
            skipBabel: [
                { package: 'moment' },
                { package: 'moment-timezone' },
                { package: '@sentry/ember' },
                { package: '@sentry/integrations' },
                { package: '@sentry/replay' },
                { package: 'jose' },
                { package: 'lru-cache' },
                { package: 'i18n-iso-countries' }
            ],`
    },
    {
        name: 'cache',
        description: 'Use filesystem cache',
        instructions: `Replace the cache configuration in webpack with:

                // Cache module resolution
                cache: true
            },
            // Always use filesystem cache
            cache: {
                type: 'filesystem',
                buildDependencies: {
                    config: [__filename]
                },
                // More aggressive caching
                maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
                profile: true
            },`
    },
    {
        name: 'sourcemaps',
        description: 'Use cheaper source maps',
        instructions: `Change the devtool line to:

                devtool: isDevelopment ? 'eval-cheap-module-source-map' : 'source-map',`
    },
    {
        name: 'optimization',
        description: 'Disable expensive optimizations',
        instructions: `Add after the resolve section:

                optimization: {
                    // Skip expensive optimizations in development
                    minimize: !isDevelopment,
                    removeAvailableModules: !isDevelopment,
                    removeEmptyChunks: !isDevelopment
                },`
    },
    {
        name: 'all',
        description: 'All optimizations combined',
        instructions: 'Apply all the above optimizations together'
    }
];

const results = [];

async function runTest(test) {
    console.log(`\n${'-'.repeat(60)}`);
    console.log(`Test: ${test.name}`);
    console.log(`Description: ${test.description}`);
    console.log(`${'-'.repeat(60)}\n`);
    
    console.log('Instructions:');
    console.log(test.instructions);
    console.log('\nPress Enter when ready to test...');
    
    // Wait for user input
    await new Promise(resolve => {
        process.stdin.once('data', resolve);
    });
    
    // Clean cache for fair comparison
    console.log('Cleaning webpack cache...');
    try {
        execSync('rm -rf node_modules/.cache/webpack', { stdio: 'pipe' });
    } catch (e) {
        // Ignore if doesn't exist
    }
    
    // Cold build
    console.log('\nCold build:');
    const coldResult = measureBuild(`${test.name}-cold`);
    
    if (!coldResult) {
        console.log('❌ Cold build failed');
        return null;
    }
    
    // Warm build (do one warmup first)
    console.log('\nWarming up...');
    measureBuild(`${test.name}-warmup`, 1);
    
    console.log('\nWarm build:');
    const warmResult = measureBuild(`${test.name}-warm`);
    
    if (!warmResult) {
        console.log('❌ Warm build failed');
        return null;
    }
    
    const result = {
        name: test.name,
        description: test.description,
        coldTime: coldResult.avg,
        warmTime: warmResult.avg,
        coldTimes: coldResult.times,
        warmTimes: warmResult.times
    };
    
    console.log(`\n✅ Results for ${test.name}:`);
    console.log(`  Cold: ${(result.coldTime / 1000).toFixed(1)}s`);
    console.log(`  Warm: ${(result.warmTime / 1000).toFixed(1)}s`);
    
    return result;
}

// Enable raw mode to read single keypress
process.stdin.setRawMode(true);
process.stdin.resume();

(async () => {
    for (const test of tests) {
        const result = await runTest(test);
        if (result) {
            results.push(result);
        }
    }
    
    // Print summary
    console.log('\n\n📊 FINAL SUMMARY');
    console.log('================\n');
    
    const baseline = results.find(r => r.name === 'baseline');
    if (baseline) {
        console.log('Optimization Results:');
        console.log('-'.repeat(80));
        console.log('Configuration'.padEnd(25) + 'Cold Build'.padEnd(15) + 'Warm Build'.padEnd(15) + 'Improvement vs Baseline');
        console.log('-'.repeat(80));
        
        results.forEach(result => {
            const coldImprovement = baseline.coldTime - result.coldTime;
            const warmImprovement = baseline.warmTime - result.warmTime;
            const coldPercent = ((coldImprovement / baseline.coldTime) * 100).toFixed(1);
            const warmPercent = ((warmImprovement / baseline.warmTime) * 100).toFixed(1);
            
            console.log(
                result.name.padEnd(25) +
                `${(result.coldTime / 1000).toFixed(1)}s`.padEnd(15) +
                `${(result.warmTime / 1000).toFixed(1)}s`.padEnd(15) +
                `${coldPercent}% / ${warmPercent}%`
            );
        });
        
        console.log('\n\nIndividual Optimization Impact:');
        console.log('-------------------------------');
        ['skipBabel', 'cache', 'sourcemaps', 'optimization'].forEach(opt => {
            const result = results.find(r => r.name === opt);
            if (result) {
                const coldImpact = ((baseline.coldTime - result.coldTime) / baseline.coldTime * 100).toFixed(1);
                const warmImpact = ((baseline.warmTime - result.warmTime) / baseline.warmTime * 100).toFixed(1);
                console.log(`${opt.padEnd(20)}: ${coldImpact}% cold / ${warmImpact}% warm`);
            }
        });
    }
    
    // Save results
    fs.writeFileSync('optimization-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n\nDetailed results saved to optimization-test-results.json');
    
    process.exit(0);
})();