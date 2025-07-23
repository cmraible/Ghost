#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

class BuildProfiler {
    constructor() {
        this.events = [];
        this.startTime = null;
    }

    logEvent(phase, message, metadata = {}) {
        const timestamp = performance.now();
        const elapsed = this.startTime ? (timestamp - this.startTime) / 1000 : 0;
        
        this.events.push({
            timestamp,
            elapsed: elapsed.toFixed(2),
            phase,
            message,
            ...metadata
        });
        
        console.log(`[${elapsed.toFixed(2)}s] ${phase}: ${message}`);
    }

    async profileBuild() {
        console.log('🔍 Starting build profiling...\n');
        
        // Clean environment
        console.log('🧹 Cleaning build artifacts...');
        const { execSync } = require('child_process');
        try {
            execSync('rm -rf dist node_modules/.cache tmp', { stdio: 'inherit' });
        } catch (error) {
            // Ignore errors
        }

        this.startTime = performance.now();
        this.logEvent('START', 'Build profiling started');

        // Set up environment variables for detailed logging
        const env = {
            ...process.env,
            BROCCOLI_VIZ: '1',
            DEBUG: 'ember-cli:*,broccoli:*',
            EMBER_CLI_INSTRUMENTATION: '1',
            JOBS: '1' // Single job to get clearer timing
        };

        // Run the build with instrumentation
        const buildProcess = spawn('yarn', ['build:dev'], {
            env,
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let lastPhase = 'INIT';
        
        // Parse build output for timing information
        buildProcess.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            
            // Parse Broccoli tree timings
            if (output.includes('Build successful')) {
                this.logEvent('COMPLETE', 'Build completed successfully');
            }
            
            // Look for specific build phases
            if (output.includes('building...')) {
                this.logEvent('BUILD', 'Main build phase started');
                lastPhase = 'BUILD';
            }
            
            if (output.includes('Bundling...')) {
                this.logEvent('BUNDLE', 'Bundling phase started');
                lastPhase = 'BUNDLE';
            }
            
            if (output.includes('cleaning up...')) {
                this.logEvent('CLEANUP', 'Cleanup phase started');
                lastPhase = 'CLEANUP';
            }
            
            // Capture tree rebuild times
            const treeMatch = output.match(/(\w+(?:Tree|Plugin|Funnel|Merger))\s+\|\s+([\d.]+)ms/);
            if (treeMatch) {
                const [, treeName, time] = treeMatch;
                this.logEvent('TREE', `${treeName} processed`, { 
                    tree: treeName, 
                    duration_ms: parseFloat(time) 
                });
            }
            
            // Capture file processing
            const fileMatch = output.match(/(\d+) files? (?:created|updated|deleted)/);
            if (fileMatch) {
                this.logEvent('FILES', fileMatch[0], { phase: lastPhase });
            }
            
            // Write partial output for monitoring
            process.stdout.write(output);
        });

        buildProcess.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            
            // Parse debug output for detailed timings
            if (output.includes('ember-cli:')) {
                const emberMatch = output.match(/ember-cli:(\w+)\s+(.*)/);
                if (emberMatch) {
                    const [, component, message] = emberMatch;
                    this.logEvent('EMBER_CLI', `${component}: ${message}`, { component });
                }
            }
            
            // Webpack timings
            if (output.includes('webpack built')) {
                const webpackMatch = output.match(/webpack built.*in (\d+)ms/);
                if (webpackMatch) {
                    this.logEvent('WEBPACK', `Webpack build completed`, { 
                        duration_ms: parseInt(webpackMatch[1]) 
                    });
                }
            }
            
            process.stderr.write(output);
        });

        return new Promise((resolve, reject) => {
            buildProcess.on('close', (code) => {
                const totalTime = (performance.now() - this.startTime) / 1000;
                
                this.logEvent('END', `Build process exited with code ${code}`, {
                    total_duration_s: totalTime.toFixed(2),
                    exit_code: code
                });

                // Analyze the events to find bottlenecks
                this.analyzeProfile();
                
                // Save detailed profile
                const profilePath = path.join(__dirname, '..', 'build-profile.json');
                fs.writeFileSync(profilePath, JSON.stringify({
                    totalTime: totalTime.toFixed(2),
                    events: this.events,
                    stdout: stdout.slice(-10000), // Last 10k chars
                    stderr: stderr.slice(-10000)
                }, null, 2));
                
                console.log(`\n📄 Detailed profile saved to: ${profilePath}`);
                
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Build failed with code ${code}`));
                }
            });
        });
    }

    analyzeProfile() {
        console.log('\n📊 Build Profile Analysis');
        console.log('========================\n');
        
        // Group events by phase
        const phaseGroups = {};
        let lastPhaseStart = this.startTime;
        let lastPhase = 'INIT';
        
        this.events.forEach(event => {
            if (['BUILD', 'BUNDLE', 'CLEANUP', 'COMPLETE'].includes(event.phase)) {
                if (lastPhase && lastPhase !== event.phase) {
                    const duration = (event.timestamp - lastPhaseStart) / 1000;
                    phaseGroups[lastPhase] = (phaseGroups[lastPhase] || 0) + duration;
                }
                lastPhaseStart = event.timestamp;
                lastPhase = event.phase;
            }
        });
        
        // Add final phase
        if (lastPhase && this.events.length > 0) {
            const lastEvent = this.events[this.events.length - 1];
            const duration = (lastEvent.timestamp - lastPhaseStart) / 1000;
            phaseGroups[lastPhase] = (phaseGroups[lastPhase] || 0) + duration;
        }
        
        // Find slowest trees
        const treeEvents = this.events.filter(e => e.phase === 'TREE' && e.duration_ms);
        treeEvents.sort((a, b) => b.duration_ms - a.duration_ms);
        
        console.log('⏱️  Phase Breakdown:');
        Object.entries(phaseGroups).forEach(([phase, duration]) => {
            console.log(`   ${phase}: ${duration.toFixed(2)}s`);
        });
        
        if (treeEvents.length > 0) {
            console.log('\n🌳 Slowest Trees (top 10):');
            treeEvents.slice(0, 10).forEach(event => {
                console.log(`   ${event.tree}: ${event.duration_ms}ms`);
            });
        }
        
        // Count file operations
        const fileEvents = this.events.filter(e => e.phase === 'FILES');
        if (fileEvents.length > 0) {
            console.log('\n📁 File Operations:');
            fileEvents.forEach(event => {
                console.log(`   ${event.message} (during ${event.phase})`);
            });
        }
    }
}

// Run profiler if called directly
if (require.main === module) {
    const profiler = new BuildProfiler();
    profiler.profileBuild().catch(console.error);
}

module.exports = BuildProfiler;