#!/usr/bin/env node

const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

class BuildTimeProfiler {
    constructor() {
        this.phases = new Map();
        this.currentPhase = null;
        this.phaseStartTime = null;
        this.buildStartTime = null;
    }

    startPhase(name) {
        if (this.currentPhase) {
            this.endPhase();
        }
        this.currentPhase = name;
        this.phaseStartTime = performance.now();
    }

    endPhase() {
        if (this.currentPhase && this.phaseStartTime) {
            const duration = performance.now() - this.phaseStartTime;
            if (!this.phases.has(this.currentPhase)) {
                this.phases.set(this.currentPhase, []);
            }
            this.phases.get(this.currentPhase).push(duration);
            this.currentPhase = null;
            this.phaseStartTime = null;
        }
    }

    async profile() {
        console.log('🕐 Starting build time profiling...\n');
        
        // Clean environment
        const { execSync } = require('child_process');
        execSync('rm -rf dist node_modules/.cache tmp', { stdio: 'inherit' });
        
        this.buildStartTime = performance.now();
        
        // Run build with verbose output
        const env = {
            ...process.env,
            BROCCOLI_VERBOSE: 'true',
            DEBUG: '*build*,*babel*,*webpack*,*terser*,*postcss*',
            EMBER_CLI_MEASURE: '1'
        };
        
        const buildProcess = spawn('yarn', ['ember', 'build', '--environment=development'], {
            env,
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let lastLogTime = performance.now();
        const logTiming = (message) => {
            const now = performance.now();
            const sinceLast = ((now - lastLogTime) / 1000).toFixed(2);
            const total = ((now - this.buildStartTime) / 1000).toFixed(2);
            console.log(`[+${sinceLast}s | ${total}s] ${message}`);
            lastLogTime = now;
        };

        // Track build phases based on output
        buildProcess.stdout.on('data', (data) => {
            const output = data.toString();
            
            // Detect different build phases
            if (output.includes('Building')) {
                logTiming('🔨 Build phase started');
                this.startPhase('ember-build');
            }
            
            if (output.includes('Bundling')) {
                logTiming('📦 Bundling phase started');
                this.startPhase('bundling');
            }
            
            if (output.includes('processing:')) {
                const match = output.match(/processing:\s+(\S+)/);
                if (match) {
                    logTiming(`⚙️  Processing: ${match[1]}`);
                }
            }
            
            if (output.includes('babel:')) {
                this.startPhase('babel-transpilation');
                logTiming('🔄 Babel transpilation');
            }
            
            if (output.includes('postcss') || output.includes('CSS')) {
                this.startPhase('css-processing');
                logTiming('🎨 CSS processing');
            }
            
            if (output.includes('webpack')) {
                this.startPhase('webpack-bundling');
                logTiming('📦 Webpack bundling');
            }
            
            if (output.includes('terser') || output.includes('minify')) {
                this.startPhase('minification');
                logTiming('🗜️  Minification');
            }
            
            if (output.includes('writing:') || output.includes('wrote:')) {
                this.startPhase('file-writing');
                logTiming('💾 Writing files');
            }
            
            // Log any timing information in the output
            const timeMatch = output.match(/(\d+(?:\.\d+)?)\s*(ms|s)\b/g);
            if (timeMatch) {
                timeMatch.forEach(time => {
                    if (time.includes('ms') && parseFloat(time) > 100) {
                        logTiming(`  ⏱️  ${time}`);
                    } else if (time.includes('s') && parseFloat(time) > 0.1) {
                        logTiming(`  ⏱️  ${time}`);
                    }
                });
            }
            
            process.stdout.write(output);
        });

        buildProcess.stderr.on('data', (data) => {
            const output = data.toString();
            
            // Look for debug timing information
            if (output.includes('took')) {
                const match = output.match(/(.+?)\s+took\s+(\d+(?:\.\d+)?)\s*(ms|s)/);
                if (match) {
                    logTiming(`⏱️  ${match[1]}: ${match[2]}${match[3]}`);
                }
            }
            
            process.stderr.write(output);
        });

        return new Promise((resolve) => {
            buildProcess.on('close', (code) => {
                this.endPhase();
                const totalTime = ((performance.now() - this.buildStartTime) / 1000).toFixed(2);
                
                console.log('\n📊 Build Time Profile Summary');
                console.log('=============================');
                console.log(`Total Build Time: ${totalTime}s\n`);
                
                // Aggregate phase timings
                const phaseSummary = [];
                for (const [phase, timings] of this.phases) {
                    const total = timings.reduce((a, b) => a + b, 0) / 1000;
                    const count = timings.length;
                    const avg = total / count;
                    phaseSummary.push({
                        phase,
                        total: total.toFixed(2),
                        count,
                        average: avg.toFixed(2)
                    });
                }
                
                // Sort by total time
                phaseSummary.sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
                
                console.log('Time by Phase:');
                phaseSummary.forEach(({ phase, total, count, average }) => {
                    const percentage = ((parseFloat(total) / parseFloat(totalTime)) * 100).toFixed(1);
                    console.log(`  ${phase}: ${total}s (${percentage}%) - ${count} operations, avg ${average}s`);
                });
                
                resolve(code);
            });
        });
    }
}

if (require.main === module) {
    const profiler = new BuildTimeProfiler();
    profiler.profile().catch(console.error);
}