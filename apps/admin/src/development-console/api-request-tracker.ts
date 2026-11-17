const MAX_API_REQUESTS = 500;
const MAX_PAYLOAD_LENGTH = 100_000;

export const API_REQUESTS_EVENT = 'ghost:development-console:api-requests';

export interface ApiRequest {
    durationMs: number;
    id: number;
    method: string;
    path: string;
    requestBody: string | null;
    responseBody: string | null;
    responseSize: number | null;
    startedAt: number;
    status: number | null;
}

interface RequestMetadata {
    method: string;
    path: string;
}

interface TrackerState {
    installed: boolean;
    nextId: number;
    requests: ApiRequest[];
    xhrMetadata: WeakMap<XMLHttpRequest, RequestMetadata>;
}

interface DevelopmentConsoleWindow extends Window {
    __ghostApiRequestTracker?: TrackerState;
}

function trackerState() {
    const developmentWindow = window as DevelopmentConsoleWindow;
    developmentWindow.__ghostApiRequestTracker ??= {
        installed: false,
        nextId: 1,
        requests: [],
        xhrMetadata: new WeakMap()
    };
    return developmentWindow.__ghostApiRequestTracker;
}

function siteSubdir() {
    const configuredSubdir = document.querySelector<HTMLScriptElement>('script[data-ghost-development-console]')?.dataset.ghostSubdir;
    if (configuredSubdir !== undefined) {
        return configuredSubdir;
    }

    // Frontend pages do not have Admin's getGhostPaths() context, so fall back to
    // the Admin route only when the injected frontend subdirectory is unavailable.
    // eslint-disable-next-line local/no-hardcoded-ghost-paths
    const adminPathIndex = window.location.pathname.indexOf('/ghost/');
    return adminPathIndex === -1 ? '' : window.location.pathname.slice(0, adminPathIndex);
}

function requestMetadata(url: string | URL, method: string): RequestMetadata | null {
    try {
        const parsedUrl = new URL(url, window.location.href);
        if (parsedUrl.origin !== window.location.origin) {
            return null;
        }

        const subdir = siteSubdir();
        const apiRoots = [
            `${subdir}/ghost/api`,
            `${subdir}/members/api`
        ];
        if (!apiRoots.some(apiRoot => parsedUrl.pathname === apiRoot || parsedUrl.pathname.startsWith(`${apiRoot}/`))) {
            return null;
        }

        return {
            method: method.toUpperCase(),
            path: `${parsedUrl.pathname}${parsedUrl.search}`
        };
    } catch {
        return null;
    }
}

function responseSize(value: string | null) {
    if (!value) {
        return null;
    }

    const size = Number.parseInt(value, 10);
    return Number.isNaN(size) ? null : size;
}

function formatPayload(value: string) {
    if (!value) {
        return null;
    }

    let formatted = value;
    try {
        formatted = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
        // Non-JSON payloads are displayed as-is.
    }

    if (formatted.length <= MAX_PAYLOAD_LENGTH) {
        return formatted;
    }
    return `${formatted.slice(0, MAX_PAYLOAD_LENGTH)}\n… truncated`;
}

function requestBodyPayload(body: BodyInit | Document | null | undefined) {
    if (body === null || body === undefined) {
        return null;
    }
    if (typeof body === 'string') {
        return formatPayload(body);
    }
    if (body instanceof URLSearchParams) {
        return formatPayload(body.toString());
    }
    if (body instanceof FormData) {
        return formatPayload(JSON.stringify(Array.from(body.entries()).map(([name, value]) => [
            name,
            typeof value === 'string' ? value : `[File: ${value.name}, ${value.size} bytes]`
        ])));
    }
    if (body instanceof Blob) {
        return `[Blob: ${body.type || 'unknown type'}, ${body.size} bytes]`;
    }
    if (body instanceof ArrayBuffer) {
        return `[Binary request body: ${body.byteLength} bytes]`;
    }
    if (ArrayBuffer.isView(body)) {
        return `[Binary request body: ${body.byteLength} bytes]`;
    }
    if (body instanceof Document) {
        return formatPayload(new XMLSerializer().serializeToString(body));
    }

    return '[Streaming request body]';
}

async function fetchRequestBody(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.body !== undefined && init.body !== null) {
        return requestBodyPayload(init.body);
    }
    if (!(input instanceof Request) || input.body === null) {
        return null;
    }

    try {
        return formatPayload(await input.clone().text());
    } catch {
        return '[Unable to read request body]';
    }
}

async function fetchResponseBody(response: Response) {
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const isTextResponse = contentType.includes('json') || contentType.includes('xml') || contentType.startsWith('text/');
    if (contentType && !isTextResponse) {
        return `[Binary response: ${contentType}]`;
    }

    try {
        return formatPayload(await response.clone().text());
    } catch {
        return '[Unable to read response body]';
    }
}

function xhrResponseBody(request: XMLHttpRequest) {
    if (request.responseType === '' || request.responseType === 'text') {
        return formatPayload(request.responseText);
    }
    if (request.responseType === 'json') {
        return formatPayload(JSON.stringify(request.response));
    }
    if (request.response instanceof Blob) {
        return `[Binary response: ${request.response.type || 'unknown type'}, ${request.response.size} bytes]`;
    }
    if (request.response instanceof ArrayBuffer) {
        return `[Binary response: ${request.response.byteLength} bytes]`;
    }
    return request.response === null ? null : `[${request.responseType || 'unknown'} response]`;
}

function dispatchRequests() {
    const state = trackerState();
    window.dispatchEvent(new CustomEvent<ApiRequest[]>(API_REQUESTS_EVENT, {
        detail: [...state.requests]
    }));
}

function publishRequest(request: Omit<ApiRequest, 'id'>) {
    const state = trackerState();
    const completedRequest = {...request, id: state.nextId};
    state.nextId += 1;
    state.requests = [completedRequest, ...state.requests].slice(0, MAX_API_REQUESTS);
    dispatchRequests();
    return completedRequest.id;
}

function updateRequestPayloads(id: number, requestBody: string | null, responseBody: string | null) {
    const state = trackerState();
    const request = state.requests.find(item => item.id === id);
    if (!request) {
        return;
    }

    request.requestBody = requestBody;
    request.responseBody = responseBody;
    dispatchRequests();
}

function installFetchTracker() {
    const originalFetch = window.fetch;
    window.fetch = async function trackedFetch(input, init) {
        const url = input instanceof Request ? input.url : input;
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
        const metadata = requestMetadata(url, method);
        if (!metadata) {
            return originalFetch.call(window, input, init);
        }

        const startedAt = Date.now();
        const startedAtPerformance = performance.now();
        const requestBody = fetchRequestBody(input, init);
        try {
            const response = await originalFetch.call(window, input, init);
            const id = publishRequest({
                ...metadata,
                durationMs: performance.now() - startedAtPerformance,
                requestBody: null,
                responseBody: null,
                responseSize: responseSize(response.headers.get('content-length')),
                startedAt,
                status: response.status
            });
            void Promise.all([requestBody, fetchResponseBody(response)]).then(([capturedRequestBody, capturedResponseBody]) => {
                updateRequestPayloads(id, capturedRequestBody, capturedResponseBody);
            });
            return response;
        } catch (error) {
            const id = publishRequest({
                ...metadata,
                durationMs: performance.now() - startedAtPerformance,
                requestBody: null,
                responseBody: null,
                responseSize: null,
                startedAt,
                status: null
            });
            void requestBody.then(capturedRequestBody => updateRequestPayloads(id, capturedRequestBody, null));
            throw error;
        }
    };
}

function installXhrTracker() {
    const state = trackerState();
    // These methods must be retained so the wrappers can delegate with each XHR instance as `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalOpen = XMLHttpRequest.prototype.open;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function trackedOpen(...args: [method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null]) {
        const [method, url] = args;
        const metadata = requestMetadata(url, method);
        if (metadata) {
            state.xhrMetadata.set(this, metadata);
        }
        Reflect.apply(originalOpen, this, args);
    };

    XMLHttpRequest.prototype.send = function trackedSend(...args: Parameters<XMLHttpRequest['send']>) {
        const metadata = state.xhrMetadata.get(this);
        if (metadata) {
            const requestBody = requestBodyPayload(args[0]);
            const startedAt = Date.now();
            const startedAtPerformance = performance.now();
            this.addEventListener('loadend', () => {
                publishRequest({
                    ...metadata,
                    durationMs: performance.now() - startedAtPerformance,
                    requestBody,
                    responseBody: xhrResponseBody(this),
                    responseSize: responseSize(this.getResponseHeader('content-length')),
                    startedAt,
                    status: this.status || null
                });
            }, {once: true});
        }
        Reflect.apply(originalSend, this, args);
    };
}

export function installApiRequestTracker() {
    const state = trackerState();
    if (state.installed) {
        return;
    }

    state.installed = true;
    installFetchTracker();
    installXhrTracker();
}

export function getApiRequests() {
    return [...trackerState().requests];
}

export function subscribeToApiRequests(listener: (requests: ApiRequest[]) => void) {
    const handleRequests = (event: Event) => {
        listener((event as CustomEvent<ApiRequest[]>).detail);
    };
    window.addEventListener(API_REQUESTS_EVENT, handleRequests);
    return () => window.removeEventListener(API_REQUESTS_EVENT, handleRequests);
}

export function clearApiRequests() {
    const state = trackerState();
    state.requests = [];
    dispatchRequests();
}
