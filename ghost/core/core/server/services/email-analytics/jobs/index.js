const path = require('path');
const moment = require('moment');
const config = require('../../../../shared/config');
const labs = require('../../../../shared/labs');
const models = require('../../../models');
const jobsService = require('../../jobs');

const EMAIL_ANALYTICS_TINYBIRD_AGGREGATIONS_FLAG = 'emailAnalyticsTinybirdAggregations';

let hasScheduled = {
    fetchLatest: false,
    tinybirdReconciliation: false
};

module.exports = {
    async scheduleRecurringJobs(skipEmailCheck = false) {
        const shouldScheduleFetchLatest = !hasScheduled.fetchLatest;
        const shouldScheduleTinybirdReconciliation = !hasScheduled.tinybirdReconciliation && labs.isSet(EMAIL_ANALYTICS_TINYBIRD_AGGREGATIONS_FLAG);

        if (
            (shouldScheduleFetchLatest || shouldScheduleTinybirdReconciliation) &&
            config.get('emailAnalytics:enabled') &&
            config.get('backgroundJobs:emailAnalytics') &&
            !process.env.NODE_ENV.startsWith('test')
        ) {
            // Don't register email analytics jobs if we have no emails,
            // processor usage from many sites spinning up threads can be high.
            // Mega service will re-run this scheduling task when an email is sent.
            const emailCount = skipEmailCheck ? 1 : (await models.Email
                .where('created_at', '>', moment.utc().subtract(30, 'days').toDate())
                .where('status', '<>', 'failed')
                .count());

            if (emailCount > 0) {
                if (shouldScheduleFetchLatest) {
                    // run twice per minute, offset by a random seconds value to avoid spikes to external APIs
                    const s = Math.floor(Math.random() * 30); // 0-29

                    jobsService.addJob({
                        at: `${s}/30 * * * * *`,
                        job: path.resolve(__dirname, 'fetch-latest/index.js'),
                        name: 'email-analytics-fetch-latest'
                    });

                    hasScheduled.fetchLatest = true;
                }

                if (shouldScheduleTinybirdReconciliation) {
                    // run once per minute, offset by a random seconds value to avoid synchronized write-back
                    const s = Math.floor(Math.random() * 60); // 0-59

                    jobsService.addJob({
                        at: `${s} * * * * *`,
                        job: path.resolve(__dirname, 'reconcile-stats-tinybird/index.js'),
                        name: 'email-analytics-reconcile-stats-tinybird'
                    });

                    hasScheduled.tinybirdReconciliation = true;
                }
            }
        }

        return hasScheduled.fetchLatest;
    }
};
