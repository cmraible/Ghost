import {waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {clearApiRequests, getApiRequests, installApiRequestTracker} from './api-request-tracker';

class XMLHttpRequestMock extends EventTarget {
    responseText = '{"posts":[]}';
    responseType = '';
    status = 204;

    getResponseHeader(name: string) {
        return name.toLowerCase() === 'content-length' ? '0' : null;
    }

    open() {}

    send() {
        this.dispatchEvent(new Event('loadend'));
    }
}

describe('ApiRequestTracker', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
    });

    it('captures completed Ghost API fetch and XMLHttpRequest calls', async () => {
        const script = document.createElement('script');
        script.dataset.ghostDevelopmentConsole = '';
        script.dataset.ghostSubdir = '/blog';
        document.body.appendChild(script);

        const fetchMock = vi.fn(() => Promise.resolve(new Response('{"posts":[{"id":"1"}]}', {
            headers: {
                'content-length': '128',
                'content-type': 'application/json'
            },
            status: 201
        })));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('XMLHttpRequest', XMLHttpRequestMock);

        installApiRequestTracker();
        await window.fetch('/blog/ghost/api/admin/posts/?limit=1', {
            body: '{"posts":[{"title":"Hello"}]}',
            method: 'POST'
        });
        await window.fetch('/blog/members/api/member/');

        const xhr = new XMLHttpRequest();
        xhr.open('DELETE', '/blog/ghost/api/admin/posts/123/');
        xhr.send('{"id":"123"}');

        await waitFor(() => expect(getApiRequests()).toHaveLength(3));
        await waitFor(() => expect(getApiRequests().every(request => request.responseBody !== null)).toBe(true));

        const requests = getApiRequests();
        expect(requests.find(request => request.method === 'DELETE')).toMatchObject({
            method: 'DELETE',
            path: '/blog/ghost/api/admin/posts/123/',
            requestBody: '{\n  "id": "123"\n}',
            responseBody: '{\n  "posts": []\n}',
            responseSize: 0,
            status: 204
        });
        expect(requests.find(request => request.method === 'POST')).toMatchObject({
            method: 'POST',
            path: '/blog/ghost/api/admin/posts/?limit=1',
            requestBody: '{\n  "posts": [\n    {\n      "title": "Hello"\n    }\n  ]\n}',
            responseBody: '{\n  "posts": [\n    {\n      "id": "1"\n    }\n  ]\n}',
            responseSize: 128,
            status: 201
        });
        expect(requests.find(request => request.path === '/blog/members/api/member/')).toMatchObject({
            method: 'GET',
            status: 201
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);

        clearApiRequests();
        expect(getApiRequests()).toEqual([]);
    });
});
