class PrometheusClient {
    constructor() {
        this.client = require('prom-client');
        this.gateway = new this.client.Pushgateway('http://pushgateway:9091');
        this.prefix = 'ghost_';
        this.collectDefaultMetrics();
        this.init();
    }

    async init() {
        // Push metrics to pushgateway every 5 seconds
        setInterval(async () => {
            try {
                const result = await this.pushMetrics();
                console.log('Metrics pushed to pushgateway', result);
            } catch (err) {
                // Avoid crashing if pushgateway is not available
                console.error('Error pushing metrics to pushgateway', err);
            }
        }, 5000);
    }

    async pushMetrics() {
        await this.gateway.pushAdd({jobName: 'ghost'});
    }

    collectDefaultMetrics() {
        this.client.collectDefaultMetrics({prefix: this.prefix});
    }

    async handleMetricsRequest(req, res) {
        try {
            res.set('Content-Type', this.getContentType());
            res.end(await this.getMetrics());
        } catch (err) {
            res.status(500).end(err.message);
        }
    }

    async getMetrics() {
        return this.client.register.metrics();
    }

    getRegistry() {
        return this.client.register;
    }

    getContentType() {
        return this.getRegistry().contentType;
    }
}

// Create a singleton instance and export it as the default export
const prometheusClient = new PrometheusClient();
module.exports = prometheusClient;
