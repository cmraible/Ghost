import {type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState} from 'react';
import {Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerCount} from '@tryghost/shade/components';
import {Box, Grid, Inline, Stack, Text} from '@tryghost/shade/primitives';
import {formatNumber, LucideIcon} from '@tryghost/shade/utils';
import {type ApiRequest, clearApiRequests, getApiRequests, subscribeToApiRequests} from './api-request-tracker';
import {developmentConsoleUrl} from './development-console-url';

const MAX_LOG_LINES = 1000;
const MIN_CONSOLE_HEIGHT = 256;
const CONSOLE_VIEWPORT_MARGIN = 72;
const RESIZE_KEYBOARD_STEP = 24;

type ConnectionState = 'connecting' | 'connected' | 'error';
type ConsoleTab = 'logs' | 'api';

interface LogLine {
    id: number;
    message: string;
}

interface StatusEvent {
    message?: string;
    state: ConnectionState;
}

function clampConsoleHeight(height: number) {
    const maxHeight = Math.max(MIN_CONSOLE_HEIGHT, window.innerHeight - CONSOLE_VIEWPORT_MARGIN);
    return Math.min(maxHeight, Math.max(MIN_CONSOLE_HEIGHT, height));
}

function logTone(message: string) {
    const normalized = message.toLowerCase();
    if (normalized.includes('[error]') || normalized.includes('error:')) {
        return 'text-destructive';
    }
    if (normalized.includes('[warn]') || normalized.includes('warning:')) {
        return 'text-orange';
    }

    return 'text-foreground';
}

function requestTimeLabel(startedAt: number) {
    return new Date(startedAt).toLocaleTimeString([], {
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
        second: '2-digit'
    });
}

function requestStatusTone(status: number | null) {
    if (status === null || status >= 500) {
        return 'text-destructive';
    }
    if (status >= 400) {
        return 'text-orange';
    }
    if (status >= 300) {
        return 'text-muted-foreground';
    }
    return 'text-green';
}

export function DevelopmentConsole() {
    const [activeTab, setActiveTab] = useState<ConsoleTab>('logs');
    const [apiRequests, setApiRequests] = useState<ApiRequest[]>(getApiRequests);
    const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
    const [consoleHeight, setConsoleHeight] = useState(() => clampConsoleHeight(window.innerHeight * 0.4));
    const [isFollowing, setIsFollowing] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [lines, setLines] = useState<LogLine[]>([]);
    const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
    const resizeStart = useRef<{height: number; y: number} | null>(null);
    const scrollContainer = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const source = new EventSource(developmentConsoleUrl(import.meta.env.BASE_URL));

        const appendLine = (message: string) => {
            setLines(current => {
                const id = (current.at(-1)?.id ?? 0) + 1;
                return [...current, {id, message}].slice(-MAX_LOG_LINES);
            });
        };
        const handleLog = (event: MessageEvent<string>) => {
            const line = JSON.parse(event.data) as Omit<LogLine, 'id'>;
            appendLine(line.message);
        };
        const handleStatus = (event: MessageEvent<string>) => {
            const status = JSON.parse(event.data) as StatusEvent;
            setConnectionState(status.state);
            if (status.message) {
                appendLine(status.message);
            }
        };

        source.addEventListener('log', handleLog);
        source.addEventListener('status', handleStatus);
        source.onopen = () => setConnectionState('connected');
        source.onerror = () => {
            setConnectionState(source.readyState === EventSource.CLOSED ? 'error' : 'connecting');
        };

        return () => source.close();
    }, []);

    useEffect(() => subscribeToApiRequests(setApiRequests), []);

    useEffect(() => {
        const container = scrollContainer.current;
        if (container && activeTab === 'logs' && isOpen && isFollowing) {
            container.scrollTop = container.scrollHeight;
        }
    }, [activeTab, isFollowing, isOpen, lines]);

    const statusLabel = connectionState === 'connected' ? 'Live' : connectionState === 'connecting' ? 'Connecting' : 'Disconnected';
    const statusTone = connectionState === 'connected' ? 'bg-green' : connectionState === 'connecting' ? 'bg-orange' : 'bg-destructive';
    const selectedRequest = apiRequests.find(request => request.id === selectedRequestId);

    const handleResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
            return;
        }

        event.preventDefault();
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        setConsoleHeight(current => clampConsoleHeight(current + (RESIZE_KEYBOARD_STEP * direction)));
    };

    const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        resizeStart.current = {height: consoleHeight, y: event.clientY};
        if ('setPointerCapture' in event.currentTarget) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    };

    const handleResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!resizeStart.current) {
            return;
        }

        const height = resizeStart.current.height + resizeStart.current.y - event.clientY;
        setConsoleHeight(clampConsoleHeight(height));
    };

    const handleResizePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
        resizeStart.current = null;
        if ('hasPointerCapture' in event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    return (
        <Box className="fixed inset-x-0 bottom-0 z-50 border-t border-border-default bg-surface-elevated shadow-lg">
            {isOpen && (
                <Stack data-testid="development-console-drawer" gap="none" style={{height: consoleHeight}}>
                    <button
                        aria-label="Resize development console"
                        aria-valuemax={Math.max(MIN_CONSOLE_HEIGHT, window.innerHeight - CONSOLE_VIEWPORT_MARGIN)}
                        aria-valuemin={MIN_CONSOLE_HEIGHT}
                        aria-valuenow={Math.round(consoleHeight)}
                        className="group flex h-3 w-full shrink-0 cursor-row-resize touch-none items-center justify-center bg-surface-elevated focus-visible:ring-1 focus-visible:ring-focus-ring focus-visible:outline-hidden"
                        role="separator"
                        type="button"
                        onKeyDown={handleResizeKeyDown}
                        onPointerCancel={handleResizePointerUp}
                        onPointerDown={handleResizePointerDown}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                    >
                        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-border-default transition-colors group-hover:bg-foreground/40" />
                    </button>
                    <Inline align="center" justify="between" className="h-11 shrink-0 border-b border-border-default px-3">
                        <Inline align="center" gap="sm">
                            <LucideIcon.Terminal className="size-4" />
                            <Text weight="semibold">Console</Text>
                        </Inline>
                        <Button aria-label="Close development console" size="icon" variant="ghost" onClick={() => setIsOpen(false)}>
                            <LucideIcon.ChevronDown />
                        </Button>
                    </Inline>
                    <Tabs
                        className="flex min-h-0 flex-1 flex-col"
                        value={activeTab}
                        variant="underline"
                        onValueChange={value => setActiveTab(value as ConsoleTab)}
                    >
                        <Inline align="center" justify="between" className="h-10 shrink-0 border-b border-border-default px-3">
                            <TabsList className="w-auto border-b-0">
                                <TabsTrigger value="logs">
                                    Logs
                                    <TabsTriggerCount>{formatNumber(lines.length)}</TabsTriggerCount>
                                </TabsTrigger>
                                <TabsTrigger value="api">
                                    API
                                    <TabsTriggerCount>{formatNumber(apiRequests.length)}</TabsTriggerCount>
                                </TabsTrigger>
                            </TabsList>
                            {activeTab === 'logs' && (
                                <Inline align="center" gap="xs">
                                    <Button
                                        aria-label={isFollowing ? 'Pause log autoscroll' : 'Follow latest logs'}
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setIsFollowing(current => !current)}
                                    >
                                        {isFollowing ? <LucideIcon.Pause /> : <LucideIcon.ArrowDownToLine />}
                                        {isFollowing ? 'Pause' : 'Follow'}
                                    </Button>
                                    <Button
                                        aria-label="Clear logs"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setLines([])}
                                    >
                                        <LucideIcon.Trash2 />
                                        Clear
                                    </Button>
                                </Inline>
                            )}
                            {activeTab === 'api' && (
                                <Button
                                    aria-label="Clear API requests"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setSelectedRequestId(null);
                                        clearApiRequests();
                                    }}
                                >
                                    <LucideIcon.Trash2 />
                                    Clear
                                </Button>
                            )}
                        </Inline>
                        <TabsContent className="min-h-0 flex-1 overflow-hidden data-[state=active]:flex" value="logs">
                            <Box
                                ref={scrollContainer}
                                className="h-full w-full overflow-auto bg-background px-3 py-2 font-mono text-sm"
                                onScroll={(event) => {
                                    const target = event.currentTarget;
                                    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
                                    setIsFollowing(distanceFromBottom < 24);
                                }}
                            >
                                {lines.length === 0 ? (
                                    <Text className="font-sans" size="sm" tone="secondary">Waiting for Ghost server logs…</Text>
                                ) : (
                                    lines.map(line => (
                                        <div className={`leading-5 break-all whitespace-pre-wrap ${logTone(line.message)}`} key={line.id}>
                                            {line.message}
                                        </div>
                                    ))
                                )}
                            </Box>
                        </TabsContent>
                        <TabsContent className="min-h-0 flex-1 flex-col overflow-hidden bg-background" value="api">
                            {apiRequests.length === 0 ? (
                                <Box padding="md">
                                    <Text size="sm" tone="secondary">No API requests captured yet.</Text>
                                </Box>
                            ) : (
                                <>
                                    <Box className="min-h-0 flex-1 overflow-auto">
                                        <Table className="font-mono text-sm">
                                            <TableHeader className="sticky top-0 z-10 bg-surface-elevated">
                                                <TableRow>
                                                    <TableHead className="w-24">Time</TableHead>
                                                    <TableHead className="w-20">Method</TableHead>
                                                    <TableHead>Request</TableHead>
                                                    <TableHead className="w-20 text-right">Status</TableHead>
                                                    <TableHead className="w-24 text-right">Duration</TableHead>
                                                    <TableHead className="w-24 text-right">Size</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {apiRequests.map(request => (
                                                    <TableRow
                                                        aria-label={`${request.method} ${request.path}`}
                                                        aria-selected={request.id === selectedRequestId}
                                                        className="cursor-pointer focus-visible:ring-1 focus-visible:ring-focus-ring focus-visible:outline-hidden focus-visible:ring-inset"
                                                        data-state={request.id === selectedRequestId ? 'selected' : undefined}
                                                        key={request.id}
                                                        tabIndex={0}
                                                        onClick={() => setSelectedRequestId(request.id)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                setSelectedRequestId(request.id);
                                                            }
                                                        }}
                                                    >
                                                        <TableCell className="py-1.5 text-muted-foreground">{requestTimeLabel(request.startedAt)}</TableCell>
                                                        <TableCell className="py-1.5 font-semibold">{request.method}</TableCell>
                                                        <TableCell className="max-w-0 truncate py-1.5" title={request.path}>{request.path}</TableCell>
                                                        <TableCell className={`py-1.5 text-right font-semibold ${requestStatusTone(request.status)}`}>
                                                            {request.status === null ? 'Error' : formatNumber(request.status)}
                                                        </TableCell>
                                                        <TableCell className="py-1.5 text-right">{formatNumber(Math.round(request.durationMs))} ms</TableCell>
                                                        <TableCell className="py-1.5 text-right text-muted-foreground">
                                                            {request.responseSize === null ? '—' : `${formatNumber(request.responseSize)} B`}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                    {selectedRequest && (
                                        <Box className="max-h-[55%] shrink-0 overflow-auto border-t border-border-default bg-surface-elevated">
                                            <Inline align="center" justify="between" className="sticky top-0 border-b border-border-default bg-surface-elevated px-3 py-2">
                                                <Inline align="center" gap="sm" className="min-w-0 font-mono">
                                                    <Text size="sm" weight="semibold">{selectedRequest.method}</Text>
                                                    <Text className="truncate" size="sm" title={selectedRequest.path}>{selectedRequest.path}</Text>
                                                </Inline>
                                                <Button aria-label="Close API request details" className="size-7" size="icon" variant="ghost" onClick={() => setSelectedRequestId(null)}>
                                                    <LucideIcon.X />
                                                </Button>
                                            </Inline>
                                            <Grid columns={2} gap="none">
                                                <Stack gap="sm" className="min-w-0 border-r border-border-default p-3">
                                                    <Text size="sm" tone="secondary" weight="semibold">Request body</Text>
                                                    <pre className="overflow-auto font-mono text-sm break-all whitespace-pre-wrap">
                                                        {selectedRequest.requestBody ?? 'No request body'}
                                                    </pre>
                                                </Stack>
                                                <Stack gap="sm" className="min-w-0 p-3">
                                                    <Text size="sm" tone="secondary" weight="semibold">Response</Text>
                                                    <pre className="overflow-auto font-mono text-sm break-all whitespace-pre-wrap">
                                                        {selectedRequest.responseBody ?? 'No response body'}
                                                    </pre>
                                                </Stack>
                                            </Grid>
                                        </Box>
                                    )}
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                </Stack>
            )}
            <Inline align="center" justify="between" className="h-9 px-3">
                <Button className="-ml-2" size="sm" variant="ghost" onClick={() => setIsOpen(current => !current)}>
                    <LucideIcon.Terminal />
                    Console
                    <LucideIcon.ChevronUp className={isOpen ? 'rotate-180' : ''} />
                </Button>
                <Inline align="center" gap="sm">
                    <span aria-hidden="true" className={`size-2 rounded-full ${statusTone}`} />
                    <Text size="sm" tone="secondary">{statusLabel}</Text>
                </Inline>
            </Inline>
        </Box>
    );
}
