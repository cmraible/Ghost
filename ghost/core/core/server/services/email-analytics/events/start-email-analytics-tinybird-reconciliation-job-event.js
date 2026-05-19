/**
 * This event lets the scheduled worker trigger Tinybird email/member aggregate reconciliation on the main thread.
 */
module.exports = class StartEmailAnalyticsTinybirdReconciliationJobEvent {
    /**
     * @param {any} data
     * @param {Date} timestamp
     */
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }

    /**
     * @param {any} [data]
     * @param {Date} [timestamp]
     */
    static create(data, timestamp) {
        return new StartEmailAnalyticsTinybirdReconciliationJobEvent(data, timestamp ?? new Date);
    }
};
