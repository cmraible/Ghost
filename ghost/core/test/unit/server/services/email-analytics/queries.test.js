const assert = require('node:assert/strict');
const db = require('../../../../../core/server/data/db');
const queries = require('../../../../../core/server/services/email-analytics/lib/queries');

describe('Email analytics queries', function () {
    const mockDb = require('../../../../utils/mock-knex');
    let tracker;

    beforeAll(function () {
        mockDb.mock(db.knex);
        tracker = mockDb.getTracker();
    });

    afterAll(function () {
        mockDb.unmock(db.knex);
    });

    afterEach(function () {
        tracker.uninstall();
    });

    it('increments delivered email stats', async function () {
        const queryLog = [];
        tracker.install();
        tracker.on('query', (query) => {
            queryLog.push(query);
            query.response(1);
        });

        await queries.incrementDeliveredStats({emailId: 'email-1'});

        assert.equal(queryLog.length, 1);
        assert.equal(queryLog[0].sql, 'update `emails` set `delivered_count` = `delivered_count` + ? where `id` = ?');
        assert.deepEqual(queryLog[0].bindings, [1, 'email-1']);
    });

    it('increments failed email stats', async function () {
        const queryLog = [];
        tracker.install();
        tracker.on('query', (query) => {
            queryLog.push(query);
            query.response(1);
        });

        await queries.incrementFailedStats({emailId: 'email-1'});

        assert.equal(queryLog.length, 1);
        assert.equal(queryLog[0].sql, 'update `emails` set `failed_count` = `failed_count` + ? where `id` = ?');
        assert.deepEqual(queryLog[0].bindings, [1, 'email-1']);
    });

    it('increments opened email and member stats', async function () {
        const queryLog = [];
        tracker.install();
        tracker.on('query', (query) => {
            queryLog.push(query);
            query.response(1);
        });

        await queries.incrementOpenedStats({emailId: 'email-1', memberId: 'member-1'});

        assert.equal(queryLog.length, 2);
        assert.equal(queryLog[0].sql, 'update `emails` set `opened_count` = `opened_count` + ? where `id` = ?');
        assert.deepEqual(queryLog[0].bindings, [1, 'email-1']);
        assert.equal(queryLog[1].sql, 'update members set email_opened_count = email_opened_count + 1, email_open_rate = case when email_open_rate_denominator >= ? then round(email_opened_count / email_open_rate_denominator * 100) else null end where id = ?');
        assert.deepEqual(queryLog[1].bindings, [1, 'member-1']);
    });
});
