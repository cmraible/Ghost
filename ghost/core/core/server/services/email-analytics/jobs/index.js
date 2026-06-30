const path = require('path');
const moment = require('moment');
const config = require('../../../../shared/config');
const models = require('../../../models');
const jobsService = require('../../jobs');

let hasScheduled = false;

module.exports = {
    async scheduleRecurringJobs(skipEmailCheck = false) {
        if (
            !hasScheduled &&
            config.get('emailAnalytics:enabled') &&
            config.get('backgroundJobs:emailAnalytics') &&
            !process.env.NODE_ENV.startsWith('test')
        ) {
            // Don't register email analytics job if we have no emails,
            // processor usage from many sites spinning up threads can be high.
            // Mega service will re-run this scheduling task when an email is sent
            const emailCount = skipEmailCheck ? 1 : (await models.Email
                .where('created_at', '>', moment.utc().subtract(30, 'days').toDate())
                .where('status', '<>', 'failed')
                .count());

            if (emailCount > 0) {
                jobsService.addJob({
                    // Spike: run frequently so incremental aggregation can be validated locally.
                    at: `*/30 * * * * *`,
                    job: path.resolve(__dirname, 'fetch-latest/index.js'),
                    name: 'email-analytics-fetch-latest'
                });

                hasScheduled = true;
            }
        }

        return hasScheduled;
    }
};
