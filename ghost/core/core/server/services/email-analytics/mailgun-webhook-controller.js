const crypto = require('crypto');
const logging = require('@tryghost/logging');
const MailgunClient = require('../lib/mailgun-client');

module.exports = class MailgunWebhookController {
    /**
     * @param {object} deps
     * @param {object} deps.config
     * @param {{processWebhookEvent: (event: object) => Promise<object>}} deps.emailAnalytics
     */
    constructor({config, emailAnalytics}) {
        this.config = config;
        this.emailAnalytics = emailAnalytics;
    }

    getSigningKey() {
        return this.config.get('emailAnalytics:mailgun:webhookSigningKey');
    }

    verifySignature(signature) {
        const signingKey = this.getSigningKey();
        if (!signingKey || !signature?.timestamp || !signature?.token || !signature?.signature) {
            return false;
        }

        const digest = crypto
            .createHmac('sha256', signingKey)
            .update(`${signature.timestamp}${signature.token}`)
            .digest('hex');

        const expected = Buffer.from(digest, 'hex');
        const actual = Buffer.from(signature.signature, 'hex');

        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }

    isBulkEmailEvent(eventData) {
        if (!eventData) {
            return false;
        }

        const tags = eventData.tags || [];
        const emailId = eventData['user-variables']?.['email-id'];

        return tags.includes('bulk-email') || !!emailId;
    }

    normalizeEvent(eventData) {
        return MailgunClient.normalizeEvent(eventData);
    }

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @returns {Promise<void>}
     */
    async handle(req, res) {
        if (!this.getSigningKey()) {
            res.writeHead(503);
            return res.end();
        }

        if (!req.body?.signature || !req.body?.['event-data']) {
            res.writeHead(400);
            return res.end();
        }

        if (!this.verifySignature(req.body.signature)) {
            res.writeHead(401);
            return res.end();
        }

        const eventData = req.body['event-data'];
        logging.info(`[EmailAnalytics] Received Mailgun webhook event=${eventData.event} recipient=${eventData.recipient || 'unknown'} tags=${(eventData.tags || []).join(',') || 'none'} email_id=${eventData['user-variables']?.['email-id'] || 'none'}`);

        if (!this.isBulkEmailEvent(eventData)) {
            logging.info('[EmailAnalytics] Ignoring Mailgun webhook because it is not tagged as a Ghost bulk email');
            res.writeHead(200);
            return res.end();
        }

        const event = this.normalizeEvent(eventData);
        if (!event) {
            res.writeHead(200);
            return res.end();
        }

        try {
            const result = await this.emailAnalytics.processWebhookEvent(event);
            logging.info(`[EmailAnalytics] Processed Mailgun webhook event=${event.type} opened=${result.opened} delivered=${result.delivered} failed=${result.permanentFailed + result.temporaryFailed} unhandled=${result.unhandled} unprocessable=${result.unprocessable}`);
            res.writeHead(200);
            return res.end();
        } catch (err) {
            logging.error('[EmailAnalytics] Error handling Mailgun webhook');
            logging.error(err);
            res.writeHead(err.statusCode || 500);
            return res.end();
        }
    }
};
