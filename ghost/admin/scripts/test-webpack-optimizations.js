#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Backup the original ember-cli-build.js
const buildFilePath = path.join(__dirname, '..', 'ember-cli-build.js');
const backupPath = buildFilePath + '.backup';
const originalContent = fs.readFileSync(buildFilePath, 'utf8');
fs.writeFileSync(backupPath, originalContent);

// Different optimization configurations to test
const optimizations = [
    {
        name: 'baseline',
        description: 'No optimizations (original configuration)',
        config: `autoImport: {
            publicAssetURL,
            alias: {
                'sentry-testkit/browser': 'sentry-testkit/dist/browser'
            },
            webpack: {
                resolve: {
                    fallback: {
                        util: require.resolve('util'),
                        path: require.resolve('path-browserify'),
                        fs: false
                    }
                },
                plugins: [
                    new webpack.ProvidePlugin({
                        process: 'process/browser'
                    }),
                    ...(process.env.ANALYZE_BUNDLE ? [
                        new BundleAnalyzerPlugin({
                            analyzerMode: 'static',
                            reportFilename: 'bundle-report.html',
                            openAnalyzer: false
                        })
                    ] : [])
                ],
                // disable verbose logging about webpack resolution mismatches
                infrastructureLogging: {
                    level: 'error'
                }
            }
        }`
    },
    {
        name: 'skipBabel',
        description: 'Only skipBabel optimization',
        config: `autoImport: {
            publicAssetURL,
            alias: {
                'sentry-testkit/browser': 'sentry-testkit/dist/browser'
            },
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
            ],
            webpack: {
                resolve: {
                    fallback: {
                        util: require.resolve('util'),
                        path: require.resolve('path-browserify'),
                        fs: false
                    }
                },
                plugins: [
                    new webpack.ProvidePlugin({
                        process: 'process/browser'
                    }),
                    ...(process.env.ANALYZE_BUNDLE ? [
                        new BundleAnalyzerPlugin({
                            analyzerMode: 'static',
                            reportFilename: 'bundle-report.html',
                            openAnalyzer: false
                        })
                    ] : [])
                ],
                infrastructureLogging: {
                    level: 'error'
                }
            }
        }`
    },
    {
        name: 'cache',
        description: 'Only filesystem cache',
        config: `autoImport: {
            publicAssetURL,
            alias: {
                'sentry-testkit/browser': 'sentry-testkit/dist/browser'
            },
            webpack: {
                resolve: {
                    fallback: {
                        util: require.resolve('util'),
                        path: require.resolve('path-browserify'),
                        fs: false
                    },
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
                },
                plugins: [
                    new webpack.ProvidePlugin({
                        process: 'process/browser'
                    }),
                    ...(process.env.ANALYZE_BUNDLE ? [
                        new BundleAnalyzerPlugin({
                            analyzerMode: 'static',
                            reportFilename: 'bundle-report.html',
                            openAnalyzer: false
                        })
                    ] : [])
                ],
                infrastructureLogging: {
                    level: 'error'
                }
            }
        }`
    },
    {
        name: 'sourcemaps',
        description: 'Only cheaper source maps',
        config: `autoImport: {
            publicAssetURL,
            alias: {
                'sentry-testkit/browser': 'sentry-testkit/dist/browser'
            },
            webpack: {
                devtool: isDevelopment ? 'eval-cheap-module-source-map' : 'source-map',
                resolve: {
                    fallback: {
                        util: require.resolve('util'),
                        path: require.resolve('path-browserify'),
                        fs: false
                    }
                },
                plugins: [
                    new webpack.ProvidePlugin({
                        process: 'process/browser'
                    }),
                    ...(process.env.ANALYZE_BUNDLE ? [
                        new BundleAnalyzerPlugin({
                            analyzerMode: 'static',
                            reportFilename: 'bundle-report.html',
                            openAnalyzer: false
                        })
                    ] : [])
                ],
                infrastructureLogging: {
                    level: 'error'
                }
            }
        }`
    },
    {
        name: 'optimization',
        description: 'Only disabled expensive optimizations',
        config: `autoImport: {
            publicAssetURL,
            alias: {
                'sentry-testkit/browser': 'sentry-testkit/dist/browser'
            },
            webpack: {
                resolve: {
                    fallback: {
                        util: require.resolve('util'),
                        path: require.resolve('path-browserify'),
                        fs: false
                    }
                },
                optimization: {
                    // Skip expensive optimizations in development
                    minimize: !isDevelopment,
                    removeAvailableModules: !isDevelopment,
                    removeEmptyChunks: !isDevelopment
                },
                plugins: [
                    new webpack.ProvidePlugin({
                        process: 'process/browser'
                    }),
                    ...(process.env.ANALYZE_BUNDLE ? [
                        new BundleAnalyzerPlugin({
                            analyzerMode: 'static',
                            reportFilename: 'bundle-report.html',
                            openAnalyzer: false
                        })
                    ] : [])
                ],
                infrastructureLogging: {
                    level: 'error'
                }
            }
        }`
    },
    {
        name: 'skipBabel+cache',
        description: 'skipBabel + filesystem cache',
        config: `autoImport: {
            publicAssetURL,
            alias: {
                'sentry-testkit/browser': 'sentry-testkit/dist/browser'
            },
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
            ],
            webpack: {
                resolve: {
                    fallback: {
                        util: require.resolve('util'),
                        path: require.resolve('path-browserify'),
                        fs: false
                    },
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
                },
                plugins: [
                    new webpack.ProvidePlugin({
                        process: 'process/browser'
                    }),
                    ...(process.env.ANALYZE_BUNDLE ? [
                        new BundleAnalyzerPlugin({
                            analyzerMode: 'static',
                            reportFilename: 'bundle-report.html',
                            openAnalyzer: false
                        })
                    ] : [])
                ],
                infrastructureLogging: {
                    level: 'error'
                }
            }
        }`
    }
];

function updateBuildFile(autoImportConfig) {
    let content = fs.readFileSync(buildFilePath, 'utf8');
    
    // Replace the autoImport section
    const autoImportStart = content.indexOf('autoImport: {');
    const autoImportEnd = content.indexOf('},', autoImportStart) + 2;
    
    content = content.substring(0, autoImportStart) + 
              autoImportConfig + 
              content.substring(autoImportEnd);
    
    fs.writeFileSync(buildFilePath, content);
}

function measureBuild(name, warmup = false) {
    const times = [];
    const iterations = warmup ? 1 : 3;
    
    for (let i = 0; i < iterations; i++) {
        if (!warmup) {
            console.log(`  Run ${i + 1}/${iterations}...`);
        }
        
        const start = Date.now();
        try {
            execSync('yarn build:dev', { 
                stdio: warmup ? 'ignore' : 'pipe',
                encoding: 'utf8'
            });
        } catch (error) {
            console.error(`Build failed for ${name}:`, error.message);
            return null;
        }
        const duration = Date.now() - start;
        times.push(duration);
    }
    
    return times;
}

console.log('🔬 Testing Webpack Optimizations');
console.log('================================\n');

// Clean webpack cache before starting
console.log('Cleaning webpack cache...');
try {
    execSync('rm -rf node_modules/.cache/webpack', { stdio: 'pipe' });
} catch (e) {
    // Ignore if doesn't exist
}

const results = [];

for (const opt of optimizations) {
    console.log(`\nTesting: ${opt.name}`);
    console.log(`Description: ${opt.description}`);
    console.log('-'.repeat(50));
    
    // Update build file
    updateBuildFile(opt.config);
    
    // Clean webpack cache for fair comparison
    try {
        execSync('rm -rf node_modules/.cache/webpack', { stdio: 'pipe' });
    } catch (e) {
        // Ignore if doesn't exist
    }
    
    // Cold build
    console.log('Cold build:');
    const coldTimes = measureBuild(opt.name);
    
    if (coldTimes) {
        // Warm build (do one warmup run first)
        console.log('Warming up...');
        measureBuild(opt.name, true);
        
        console.log('Warm build:');
        const warmTimes = measureBuild(opt.name);
        
        if (warmTimes) {
            const avgCold = Math.round(coldTimes.reduce((a, b) => a + b) / coldTimes.length);
            const avgWarm = Math.round(warmTimes.reduce((a, b) => a + b) / warmTimes.length);
            
            results.push({
                name: opt.name,
                description: opt.description,
                coldTime: avgCold,
                warmTime: avgWarm,
                coldTimes,
                warmTimes
            });
            
            console.log(`\n✅ ${opt.name} Results:`);
            console.log(`  Cold: ${(avgCold / 1000).toFixed(1)}s`);
            console.log(`  Warm: ${(avgWarm / 1000).toFixed(1)}s`);
        }
    }
}

// Restore original file
fs.writeFileSync(buildFilePath, originalContent);
fs.unlinkSync(backupPath);

// Print summary
console.log('\n\n📊 SUMMARY');
console.log('==========\n');

// Sort by warm build time
results.sort((a, b) => a.warmTime - b.warmTime);

const baseline = results.find(r => r.name === 'baseline');
if (baseline) {
    console.log('Optimization Results (sorted by warm build time):');
    console.log('-'.repeat(80));
    console.log('Configuration'.padEnd(25) + 'Cold Build'.padEnd(15) + 'Warm Build'.padEnd(15) + 'Improvement');
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
    
    console.log('\n\nKey Findings:');
    console.log('-------------');
    
    // Find most effective optimizations
    const bestCold = results.reduce((best, r) => r.coldTime < best.coldTime ? r : best);
    const bestWarm = results.reduce((best, r) => r.warmTime < best.warmTime ? r : best);
    
    console.log(`🏆 Best for cold builds: ${bestCold.name} (${((baseline.coldTime - bestCold.coldTime) / baseline.coldTime * 100).toFixed(1)}% improvement)`);
    console.log(`🏆 Best for warm builds: ${bestWarm.name} (${((baseline.warmTime - bestWarm.warmTime) / baseline.warmTime * 100).toFixed(1)}% improvement)`);
    
    // Individual optimization impact
    console.log('\n\nIndividual Optimization Impact:');
    console.log('-------------------------------');
    ['skipBabel', 'cache', 'sourcemaps', 'optimization'].forEach(opt => {
        const result = results.find(r => r.name === opt);
        if (result) {
            const coldImpact = ((baseline.coldTime - result.coldTime) / baseline.coldTime * 100).toFixed(1);
            const warmImpact = ((baseline.warmTime - result.warmTime) / baseline.warmTime * 100).toFixed(1);
            console.log(`${opt}: ${coldImpact}% cold / ${warmImpact}% warm improvement`);
        }
    });
}

// Save detailed results
fs.writeFileSync('webpack-optimization-results.json', JSON.stringify(results, null, 2));
console.log('\n\nDetailed results saved to webpack-optimization-results.json');