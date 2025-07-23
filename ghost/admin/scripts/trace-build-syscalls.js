#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 System Call Tracing for Build Process\n');

// Clean start
console.log('🧹 Cleaning build artifacts...');
execSync('rm -rf dist node_modules/.cache tmp', { stdio: 'inherit' });

const platform = process.platform;

if (platform === 'darwin') {
    console.log('🍎 Using DTrace on macOS...\n');
    
    // Create DTrace script
    const dtraceScript = `
#!/usr/sbin/dtrace -s

#pragma D option quiet

dtrace:::BEGIN
{
    printf("Tracing filesystem operations... Hit Ctrl-C to stop\\n");
    printf("%-20s %-10s %-10s %s\\n", "OPERATION", "COUNT", "LATENCY(µs)", "PATH");
}

syscall::open*:entry,
syscall::stat*:entry,
syscall::read*:entry,
syscall::write*:entry
/execname == "node"/
{
    self->start[probefunc] = timestamp;
    self->path[probefunc] = copyinstr(arg0);
}

syscall::open*:return,
syscall::stat*:return,
syscall::read*:return,
syscall::write*:return
/self->start[probefunc]/
{
    @ops[probefunc] = count();
    @latency[probefunc] = avg((timestamp - self->start[probefunc]) / 1000);
    @paths[probefunc, self->path[probefunc]] = count();
    
    self->start[probefunc] = 0;
    self->path[probefunc] = 0;
}

profile:::tick-1sec
{
    printf("\\n=== File System Operations Summary ===\\n");
    printa("%-20s %-10@d %-10@d\\n", @ops, @latency);
    
    printf("\\n=== Top 10 Most Accessed Paths ===\\n");
    trunc(@paths, 10);
    printa("%-20s %s: %@d times\\n", @paths);
    
    clear(@ops);
    clear(@latency);
    clear(@paths);
}
`;

    const dtracePath = path.join(__dirname, 'build-trace.d');
    fs.writeFileSync(dtracePath, dtraceScript);
    
    console.log('⚠️  DTrace requires sudo access. You may be prompted for your password.\n');
    console.log('📊 Starting trace... The build will begin in 3 seconds.\n');
    
    // Start DTrace
    const dtraceProcess = spawn('sudo', ['dtrace', '-s', dtracePath], {
        stdio: 'inherit'
    });
    
    // Give DTrace time to start
    setTimeout(() => {
        console.log('\n🔨 Starting build...\n');
        
        // Run the build
        const buildProcess = spawn('yarn', ['ember', 'build', '--environment=development'], {
            stdio: 'inherit',
            env: process.env
        });
        
        buildProcess.on('close', (code) => {
            console.log(`\n✅ Build completed with code ${code}`);
            console.log('⏹️  Stopping trace (press Ctrl+C)...');
            
            // Clean up
            setTimeout(() => {
                dtraceProcess.kill('SIGINT');
                fs.unlinkSync(dtracePath);
            }, 2000);
        });
    }, 3000);
    
} else if (platform === 'linux') {
    console.log('🐧 Using strace on Linux...\n');
    
    // Run build with strace
    const straceCmd = 'strace -c -f -e trace=file,desc,process yarn ember build --environment=development';
    
    console.log('📊 Running build with syscall tracing...\n');
    
    execSync(straceCmd, {
        stdio: 'inherit',
        env: process.env
    });
    
} else {
    console.log('❌ Unsupported platform:', platform);
    console.log('This script supports macOS (dtrace) and Linux (strace)');
}