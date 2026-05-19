const {parentPort} = require('worker_threads');
const StartEmailAnalyticsTinybirdReconciliationJobEvent = require('../../events/start-email-analytics-tinybird-reconciliation-job-event');

function cancel() {
    if (parentPort) {
        parentPort.postMessage('Email analytics Tinybird reconciliation job cancelled before completion');
        parentPort.postMessage('cancelled');
    } else {
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
}

if (parentPort) {
    parentPort.once('message', (message) => {
        if (message === 'cancel') {
            return cancel();
        }
    });
}

(async () => {
    parentPort.postMessage({
        event: {
            type: StartEmailAnalyticsTinybirdReconciliationJobEvent.name
        }
    });

    if (parentPort) {
        parentPort.postMessage('done');
    } else {
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
})();
