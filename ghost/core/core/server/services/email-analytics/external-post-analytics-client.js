const errors = require('@tryghost/errors');

class ExternalPostAnalyticsClient {
    /**
     * @param {object} deps
     * @param {object} deps.config
     * @param {object} deps.request
     */
    constructor(deps) {
        this.config = deps.config;
        this.request = deps.request || require('../../lib/request-external');
    }

    getConfig() {
        return this.config.get('emailAnalytics:postAnalyticsExternalReads') || {};
    }

    /**
     * @param {string} emailId
     * @returns {Promise<{recipient_count: number|null, opened_count: number|null, open_rate: number|null}>}
     */
    async fetchPostEmailAnalytics(emailId) {
        const clientConfig = this.getConfig();
        const baseUrl = clientConfig.baseUrl;

        if (!baseUrl) {
            throw new errors.InternalServerError({
                message: 'External post analytics baseUrl is not configured'
            });
        }

        const url = new URL(baseUrl);
        if (clientConfig.apiKey) {
            url.searchParams.set('token', clientConfig.apiKey);
        }
        url.searchParams.set('email_id', emailId);

        const response = await this.request.get(url.toString(), {
            timeout: {
                request: clientConfig.timeoutMs || 2000
            }
        });

        const body = this.parseResponse(response);
        return this.validateResponse(this.normalizeResponseBody(body), emailId);
    }

    parseResponse(response) {
        if (response?.body) {
            if (typeof response.body === 'string') {
                return JSON.parse(response.body);
            }
            return response.body;
        }

        if (typeof response === 'string') {
            return JSON.parse(response);
        }

        return response;
    }

    validateResponse(body, emailId) {
        if (!body || typeof body !== 'object') {
            throw new errors.InternalServerError({
                message: 'External post analytics response was empty or invalid'
            });
        }

        if (body.email_id && body.email_id !== emailId) {
            throw new errors.InternalServerError({
                message: 'External post analytics response email_id did not match request'
            });
        }

        return {
            recipient_count: this.validateMetric(body.recipient_count, 'recipient_count'),
            opened_count: this.validateMetric(body.opened_count, 'opened_count'),
            open_rate: this.validateMetric(body.open_rate, 'open_rate')
        };
    }

    normalizeResponseBody(body) {
        if (Array.isArray(body?.data)) {
            return body.data[0];
        }

        return body;
    }

    validateMetric(value, name) {
        if (value === null || value === undefined) {
            return null;
        }

        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            throw new errors.InternalServerError({
                message: `External post analytics response contained an invalid ${name}`
            });
        }

        return numberValue;
    }
}

module.exports = ExternalPostAnalyticsClient;
