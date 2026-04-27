const assert = require('node:assert/strict');
const crypto = require('crypto');
const sinon = require('sinon');

const MailgunWebhookController = require('../../../../../core/server/services/email-analytics/mailgun-webhook-controller');

describe('MailgunWebhookController', function () {
    let config;
    let emailAnalytics;
    let controller;
    let req;
    let res;

    function signatureFor({timestamp = '123', token = 'abc', signingKey = 'test-key'} = {}) {
        return {
            timestamp,
            token,
            signature: crypto
                .createHmac('sha256', signingKey)
                .update(`${timestamp}${token}`)
                .digest('hex')
        };
    }

    function eventData(overrides = {}) {
        return {
            id: 'event-1',
            event: 'delivered',
            recipient: 'member@example.com',
            timestamp: 1704067200,
            tags: ['bulk-email'],
            message: {
                headers: {
                    'message-id': 'provider-1'
                }
            },
            'user-variables': {
                'email-id': 'email-1'
            },
            ...overrides
        };
    }

    beforeEach(function () {
        config = {
            get: sinon.stub().withArgs('emailAnalytics:mailgun:webhookSigningKey').returns('test-key')
        };
        emailAnalytics = {
            processWebhookEvent: sinon.stub().resolves()
        };
        controller = new MailgunWebhookController({config, emailAnalytics});

        req = {
            body: {
                signature: signatureFor(),
                'event-data': eventData()
            }
        };

        res = {
            writeHead: sinon.stub(),
            end: sinon.stub()
        };
    });

    it('returns 503 when the signing key is not configured', async function () {
        config.get.returns(null);

        await controller.handle(req, res);

        sinon.assert.calledWith(res.writeHead, 503);
        sinon.assert.notCalled(emailAnalytics.processWebhookEvent);
    });

    it('returns 400 when the payload is missing required fields', async function () {
        req.body = {};

        await controller.handle(req, res);

        sinon.assert.calledWith(res.writeHead, 400);
        sinon.assert.notCalled(emailAnalytics.processWebhookEvent);
    });

    it('returns 401 when the signature is invalid', async function () {
        req.body.signature.signature = 'bad-signature';

        await controller.handle(req, res);

        sinon.assert.calledWith(res.writeHead, 401);
        sinon.assert.notCalled(emailAnalytics.processWebhookEvent);
    });

    it('ignores non-bulk-email events', async function () {
        req.body['event-data'] = eventData({
            tags: [],
            'user-variables': {}
        });

        await controller.handle(req, res);

        sinon.assert.calledWith(res.writeHead, 200);
        sinon.assert.notCalled(emailAnalytics.processWebhookEvent);
    });

    it('processes a valid Mailgun event', async function () {
        await controller.handle(req, res);

        sinon.assert.calledOnceWithMatch(emailAnalytics.processWebhookEvent, {
            id: 'event-1',
            type: 'delivered',
            recipientEmail: 'member@example.com',
            emailId: 'email-1',
            providerId: 'provider-1'
        });
        sinon.assert.calledWith(res.writeHead, 200);
        sinon.assert.called(res.end);
    });

    it('normalizes Mailgun webhook fail events to existing analytics event names', function () {
        const result = controller.normalizeEvent(eventData({
            event: 'permanent_fail',
            severity: undefined
        }));

        assert.equal(result.type, 'failed');
        assert.equal(result.severity, 'permanent');
    });
});
