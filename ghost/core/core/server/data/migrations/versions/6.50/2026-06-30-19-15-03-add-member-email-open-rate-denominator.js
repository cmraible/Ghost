const logging = require('@tryghost/logging');
const {combineNonTransactionalMigrations, createAddColumnMigration, createNonTransactionalMigration} = require('../../utils');

const MIN_EMAIL_COUNT_FOR_OPEN_RATE = 1;

module.exports = combineNonTransactionalMigrations(
    createAddColumnMigration('members', 'email_open_rate_denominator', {
        type: 'integer',
        unsigned: true,
        nullable: false,
        defaultTo: 0
    }),
    createNonTransactionalMigration(
        async function up(knex) {
            logging.info('Backfilling members.email_open_rate_denominator');

            const trackedCounts = await knex('email_recipients')
                .leftJoin('emails', 'emails.id', 'email_recipients.email_id')
                .select('email_recipients.member_id')
                .count('email_recipients.id as tracked_count')
                .where('emails.track_opens', true)
                .groupBy('email_recipients.member_id');

            await trackedCounts.reduce(async (previous, row) => {
                await previous;

                return knex('members')
                    .where('id', row.member_id)
                    .update({
                        email_open_rate_denominator: row.tracked_count,
                        email_open_rate: knex.raw(
                            'CASE WHEN ? >= ? THEN ROUND(email_opened_count / ? * 100) ELSE NULL END',
                            [row.tracked_count, MIN_EMAIL_COUNT_FOR_OPEN_RATE, row.tracked_count]
                        )
                    });
            }, Promise.resolve());
        },
        async function down() {
            logging.info('Skipping members.email_open_rate_denominator backfill rollback');
        }
    )
);
