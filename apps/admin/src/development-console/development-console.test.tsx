import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {API_REQUESTS_EVENT, clearApiRequests} from './api-request-tracker';
import {DevelopmentConsole} from './development-console';
import {developmentConsoleUrl} from './development-console-url';

class EventSourceMock extends EventTarget {
    static CLOSED = 2;
    static instance: EventSourceMock;

    onerror: ((event: Event) => void) | null = null;
    onopen: ((event: Event) => void) | null = null;
    close = vi.fn();
    readyState = 0;
    url: string | URL;

    constructor(url: string | URL) {
        super();
        this.url = url;
        EventSourceMock.instance = this;
    }

    emit(type: string, data: unknown) {
        this.dispatchEvent(new MessageEvent(type, {data: JSON.stringify(data)}));
    }

    emitError() {
        this.onerror?.(new Event('error'));
    }

    emitOpen() {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
    }
}

describe('DevelopmentConsole', () => {
    beforeEach(() => {
        vi.stubGlobal('EventSource', EventSourceMock);
        clearApiRequests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('builds the stream URL from Vite bases with or without a trailing slash', () => {
        expect(developmentConsoleUrl('/__admin-dev__')).toBe('/__admin-dev__/development-console/logs');
        expect(developmentConsoleUrl('/__admin-dev__/')).toBe('/__admin-dev__/development-console/logs');
    });

    it('streams Ghost logs into the drawer and can clear them', () => {
        render(<DevelopmentConsole />);

        expect(EventSourceMock.instance.url).toBe('/development-console/logs');
        expect(screen.queryByTestId('development-console-drawer')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /console/i}));
        expect(within(screen.getByTestId('development-console-drawer')).getByText('Console')).toBeInTheDocument();

        act(() => {
            EventSourceMock.instance.emit('status', {state: 'connected'});
            EventSourceMock.instance.emit('log', {
                message: '[2026-07-28 12:34:56] INFO Ghost is running'
            });
        });

        expect(screen.getByText('[2026-07-28 12:34:56] INFO Ghost is running')).toBeInTheDocument();
        expect(within(screen.getByRole('tab', {name: /Logs/})).getByText('1')).toBeInTheDocument();
        expect(screen.getByText('Live')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: 'Clear logs'}));
        expect(screen.getByText('Waiting for Ghost server logs…')).toBeInTheDocument();
    });

    it('closes the stream when unmounted', () => {
        const {unmount} = render(<DevelopmentConsole />);

        unmount();

        expect(EventSourceMock.instance.close).toHaveBeenCalledOnce();
    });

    it('resizes the open drawer by dragging its top handle', () => {
        render(<DevelopmentConsole />);
        fireEvent.click(screen.getByRole('button', {name: /console/i}));

        const drawer = screen.getByTestId('development-console-drawer');
        const handle = screen.getByRole('separator', {name: 'Resize development console'});
        const initialHeight = Number.parseFloat(drawer.style.height);

        fireEvent.pointerDown(handle, {clientY: 400, pointerId: 1});
        fireEvent.pointerMove(handle, {clientY: 300, pointerId: 1});
        fireEvent.pointerUp(handle, {clientY: 300, pointerId: 1});

        expect(drawer).toHaveStyle({height: `${initialHeight + 100}px`});
    });

    it('switches between the Logs and API tabs', () => {
        render(<DevelopmentConsole />);
        fireEvent.click(screen.getByRole('button', {name: /console/i}));

        const logsTab = screen.getByRole('tab', {name: /Logs/});
        const apiTab = screen.getByRole('tab', {name: /API/});
        expect(logsTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Waiting for Ghost server logs…')).toBeVisible();

        fireEvent.mouseDown(apiTab, {button: 0, ctrlKey: false});

        expect(apiTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('No API requests captured yet.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Clear logs'})).not.toBeInTheDocument();
    });

    it('shows captured API request timing and status information', () => {
        render(<DevelopmentConsole />);
        fireEvent.click(screen.getByRole('button', {name: /console/i}));

        act(() => {
            window.dispatchEvent(new CustomEvent(API_REQUESTS_EVENT, {
                detail: [{
                    durationMs: 42,
                    id: 1,
                    method: 'GET',
                    path: '/ghost/api/admin/posts/?limit=5',
                    requestBody: '{\n  "filter": "status:published"\n}',
                    responseBody: '{\n  "posts": []\n}',
                    responseSize: 1024,
                    startedAt: new Date('2026-07-28T12:34:56').valueOf(),
                    status: 200
                }]
            }));
        });
        fireEvent.mouseDown(screen.getByRole('tab', {name: /API/}), {button: 0, ctrlKey: false});

        expect(screen.getByText('/ghost/api/admin/posts/?limit=5')).toBeVisible();
        expect(screen.getByText('GET')).toBeVisible();
        expect(screen.getByText('200')).toBeVisible();
        expect(screen.getByText('42 ms')).toBeVisible();
        expect(screen.getByText('1,024 B')).toBeVisible();

        fireEvent.click(screen.getByText('/ghost/api/admin/posts/?limit=5'));

        expect(screen.getByText('Request body')).toBeVisible();
        expect(screen.getByText('Response')).toBeVisible();
        expect(screen.getByText(/"filter": "status:published"/)).toBeVisible();
        expect(screen.getByText(/"posts": \[\]/)).toBeVisible();
    });

    it('shows reconnecting state after a transient error and recovers when reopened', () => {
        render(<DevelopmentConsole />);

        act(() => {
            EventSourceMock.instance.emitError();
        });
        expect(screen.getByText('Connecting')).toBeInTheDocument();

        act(() => {
            EventSourceMock.instance.emitOpen();
        });
        expect(screen.getByText('Live')).toBeInTheDocument();
    });
});
