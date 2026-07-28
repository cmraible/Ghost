import {spawn} from 'node:child_process';
import type {ServerResponse} from 'node:http';
import type {Plugin} from 'vite';

const LOG_STREAM_PATH = '/__admin-dev__/development-console/logs';
const ANSI_ESCAPE_SEQUENCE = new RegExp(`${String.fromCharCode(27)}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, 'g');

function writeEvent(response: ServerResponse, event: string, data: unknown) {
    response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function streamLines(stream: NodeJS.ReadableStream, onLine: (line: string) => void) {
    let buffer = '';

    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        lines.forEach(onLine);
    });
    stream.on('end', () => {
        if (buffer) {
            onLine(buffer);
        }
    });
}

function startGhostLogStream() {
    return spawn('docker', [
        'logs',
        '--follow',
        '--tail',
        '200',
        'ghost-dev'
    ], {
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

function handleLogStream(response: ServerResponse) {
    response.writeHead(200, {
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Content-Type': 'text/event-stream',
        'X-Accel-Buffering': 'no'
    });
    response.flushHeaders();

    writeEvent(response, 'status', {state: 'connecting'});

    const child = startGhostLogStream();
    let closed = false;

    const close = () => {
        if (closed) {
            return;
        }
        closed = true;
        child.kill();
        response.end();
    };

    const onLine = (line: string) => {
        const cleanLine = line.replace(ANSI_ESCAPE_SEQUENCE, '');
        if (!cleanLine) {
            return;
        }

        writeEvent(response, 'log', {message: cleanLine});
    };

    streamLines(child.stdout, onLine);
    streamLines(child.stderr, onLine);

    child.once('spawn', () => {
        writeEvent(response, 'status', {state: 'connected'});
    });
    child.once('error', (error) => {
        writeEvent(response, 'status', {
            message: `Could not start Docker log stream: ${error.message}`,
            state: 'error'
        });
        close();
    });
    child.once('exit', (code, signal) => {
        if (!closed) {
            writeEvent(response, 'status', {
                message: `Docker log stream stopped (${signal ?? `exit ${code ?? 'unknown'}`})`,
                state: 'error'
            });
            close();
        }
    });

    response.once('close', close);
}

export function developmentConsolePlugin(): Plugin {
    return {
        name: 'ghost-development-console',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : '';
                if (pathname !== LOG_STREAM_PATH) {
                    next();
                    return;
                }

                handleLogStream(response);
            });
        }
    };
}
