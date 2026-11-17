import {spawn} from 'node:child_process';
import type {ServerResponse} from 'node:http';
import type {Plugin} from 'vite';

const DEVELOPMENT_CONSOLE_PATH = '/__admin-dev__/development-console';
const FRONTEND_ENTRY_PATH = `${DEVELOPMENT_CONSOLE_PATH}/frontend.js`;
const FRONTEND_SOURCE_PATH = '/src/development-console/frontend.tsx';
const LOG_STREAM_PATH = `${DEVELOPMENT_CONSOLE_PATH}/logs`;
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

function handleFrontendEntry(response: ServerResponse, viteBase: string) {
    const refreshRuntimeUrl = JSON.stringify(`${viteBase}/@react-refresh`);
    const viteClientUrl = JSON.stringify(`${viteBase}/@vite/client`);
    const sourceUrl = JSON.stringify(`${viteBase}${FRONTEND_SOURCE_PATH}`);

    response.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/javascript'
    });
    response.end([
        `import RefreshRuntime from ${refreshRuntimeUrl};`,
        `import ${viteClientUrl};`,
        'RefreshRuntime.injectIntoGlobalHook(window);',
        'window.$RefreshReg$ = () => {};',
        'window.$RefreshSig$ = () => type => type;',
        'window.__vite_plugin_react_preamble_installed__ = true;',
        `void import(${sourceUrl});`
    ].join('\n'));
}

export function developmentConsolePlugin(): Plugin {
    return {
        name: 'ghost-development-console',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const requestUrl = new URL(request.url ?? '/', 'http://localhost');
                const developmentPathIndex = requestUrl.pathname.indexOf(DEVELOPMENT_CONSOLE_PATH);
                if (developmentPathIndex === -1) {
                    return next();
                }

                const developmentPath = requestUrl.pathname.slice(developmentPathIndex);
                if (developmentPath === FRONTEND_ENTRY_PATH) {
                    const viteBase = `${requestUrl.pathname.slice(0, developmentPathIndex)}/__admin-dev__`;
                    handleFrontendEntry(response, viteBase);
                    return;
                }
                if (developmentPath !== LOG_STREAM_PATH) {
                    return next();
                }

                handleLogStream(response);
            });
        }
    };
}
