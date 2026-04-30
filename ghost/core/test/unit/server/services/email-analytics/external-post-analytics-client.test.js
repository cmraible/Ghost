const assert = require('node:assert/strict');
const ExternalPostAnalyticsClient = require('../../../../../core/server/services/email-analytics/external-post-analytics-client');

describe('ExternalPostAnalyticsClient', function () {
    it('calls the configured Tinybird pipe URL with token and email_id query params', async function () {
        let requestUrl;
        let requestOptions;

        const client = new ExternalPostAnalyticsClient({
            config: {
                get: (key) => {
                    if (key === 'emailAnalytics:postAnalyticsExternalReads') {
                        return {
                            baseUrl: 'https://api.us-east.tinybird.co/v0/pipes/post_email_analytics.json',
                            apiKey: 'tinybird-token',
                            timeoutMs: 3000
                        };
                    }
                }
            },
            request: {
                get: async (url, options) => {
                    requestUrl = url;
                    requestOptions = options;
                    return {
                        body: JSON.stringify({
                            data: [{
                                email_id: 'email_1',
                                recipient_count: 100,
                                opened_count: 25,
                                open_rate: 25
                            }]
                        })
                    };
                }
            }
        });

        const result = await client.fetchPostEmailAnalytics('email_1');
        const url = new URL(requestUrl);

        assert.equal(url.origin + url.pathname, 'https://api.us-east.tinybird.co/v0/pipes/post_email_analytics.json');
        assert.equal(url.searchParams.get('token'), 'tinybird-token');
        assert.equal(url.searchParams.get('email_id'), 'email_1');
        assert.deepEqual(requestOptions, {
            timeout: {
                request: 3000
            }
        });
        assert.deepEqual(result, {
            recipient_count: 100,
            opened_count: 25,
            open_rate: 25
        });
    });

    it('preserves existing query params on the configured Tinybird pipe URL', async function () {
        let requestUrl;

        const client = new ExternalPostAnalyticsClient({
            config: {
                get: (key) => {
                    if (key === 'emailAnalytics:postAnalyticsExternalReads') {
                        return {
                            baseUrl: 'https://api.us-east.tinybird.co/v0/pipes/post_email_analytics.json?foo=bar',
                            apiKey: 'tinybird-token'
                        };
                    }
                }
            },
            request: {
                get: async (url) => {
                    requestUrl = url;
                    return {
                        body: {
                            data: [{
                                email_id: 'email_1',
                                recipient_count: 100,
                                opened_count: 25,
                                open_rate: 25
                            }]
                        }
                    };
                }
            }
        });

        await client.fetchPostEmailAnalytics('email_1');
        const url = new URL(requestUrl);

        assert.equal(url.searchParams.get('foo'), 'bar');
        assert.equal(url.searchParams.get('token'), 'tinybird-token');
        assert.equal(url.searchParams.get('email_id'), 'email_1');
    });
});
