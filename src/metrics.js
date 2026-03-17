const os = require('os');
// Use CommonJS build of axios so Jest can import it without ESM issues.
const axios = require('axios/dist/node/axios.cjs');
const config = require('./config');

// -----------------------------
// METRIC STORAGE
// -----------------------------
let httpMetrics = {
  total: 0,
  GET: 0,
  POST: 0,
  PUT: 0,
  DELETE: 0,
};

let endpointLatency = {
  total: 0,
  count: 0,
};

let authMetrics = {
  success: 0,
  failure: 0,
};

let pizzaMetrics = {
  sold: 0,
  failures: 0,
  revenue: 0,
  totalLatency: 0,
  latencyCount: 0,
};

let activeUsers = new Set();

// -----------------------------
// HTTP REQUEST TRACKER
// -----------------------------
function requestTracker(req, res, next) {
  const start = Date.now();

  httpMetrics.total++;

  if (httpMetrics[req.method] !== undefined) {
    httpMetrics[req.method]++;
  }

  res.on('finish', () => {
    const latency = Date.now() - start;
    endpointLatency.total += latency;
    endpointLatency.count++;
  });

  next();
}

// -----------------------------
// AUTH TRACKING
// -----------------------------
function trackAuth(success) {
  success ? authMetrics.success++ : authMetrics.failure++;
}

// -----------------------------
// USER TRACKING
// -----------------------------
function trackUser(userId) {
  if (userId) activeUsers.add(userId);
}

// -----------------------------
// PIZZA METRICS
// -----------------------------
function pizzaPurchase(success, latency, price, quantity = 1) {
  if (success) {
    pizzaMetrics.sold += quantity;
    pizzaMetrics.revenue += price;
  } else {
    pizzaMetrics.failures++;
  }

  pizzaMetrics.totalLatency += latency;
  pizzaMetrics.latencyCount++;
}

// -----------------------------
// SYSTEM METRICS
// -----------------------------
function getCpuUsagePercentage() {
  return (os.loadavg()[0] / os.cpus().length) * 100;
}

function getMemoryUsagePercentage() {
  const total = os.totalmem();
  const free = os.freemem();
  return ((total - free) / total) * 100;
}

// -----------------------------
// SEND METRICS
// -----------------------------
async function sendMetrics() {
    const now = Date.now() * 1000000;
  
    const metrics = [
      {
        name: 'http_requests',
        unit: '1',
        sum: {
          dataPoints: [
            {
              asInt: httpMetrics.GET,
              timeUnixNano: String(now),
              attributes: [
                { key: 'source', value: { stringValue: config.metrics.source } },
                { key: 'method', value: { stringValue: 'GET' } },
              ],
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      },
      {
        name: 'http_requests',
        unit: '1',
        sum: {
          dataPoints: [
            {
              asInt: httpMetrics.POST,
              timeUnixNano: String(now),
              attributes: [
                { key: 'source', value: { stringValue: config.metrics.source } },
                { key: 'method', value: { stringValue: 'POST' } },
              ],
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      },
      {
        name: 'http_requests',
        unit: '1',
        sum: {
          dataPoints: [
            {
              asInt: httpMetrics.PUT,
              timeUnixNano: String(now),
              attributes: [
                { key: 'source', value: { stringValue: config.metrics.source } },
                { key: 'method', value: { stringValue: 'PUT' } },
              ],
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      },
      {
        name: 'http_requests',
        unit: '1',
        sum: {
          dataPoints: [
            {
              asInt: httpMetrics.DELETE,
              timeUnixNano: String(now),
              attributes: [
                { key: 'source', value: { stringValue: config.metrics.source } },
                { key: 'method', value: { stringValue: 'DELETE' } },
              ],
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      },
  
      {
        name: 'cpu',
        unit: '%',
        gauge: {
          dataPoints: [
            {
              asDouble: getCpuUsagePercentage(),
              timeUnixNano: String(now),
              attributes: [
                {
                  key: 'source',
                  value: { stringValue: config.metrics.source },
                },
              ],
            },
          ],
        },
      },
  
      {
        name: 'memory',
        unit: '%',
        gauge: {
          dataPoints: [
            {
              asDouble: getMemoryUsagePercentage(),
              timeUnixNano: String(now),
              attributes: [
                {
                  key: 'source',
                  value: { stringValue: config.metrics.source },
                },
              ],
            },
          ],
        },
      },
  
      {
        name: 'pizzas_sold',
        unit: '1',
        sum: {
          dataPoints: [
            {
              asInt: pizzaMetrics.sold,
              timeUnixNano: String(now),
              attributes: [
                {
                  key: 'source',
                  value: { stringValue: config.metrics.source },
                },
              ],
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      },

      {
        name: 'pizza_failures',
        unit: '1',
        sum: {
          dataPoints: [
            {
              asInt: pizzaMetrics.failures,
              timeUnixNano: String(now),
              attributes: [{ key: 'source', value: { stringValue: config.metrics.source } }],
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      },
  
      {
        name: 'pizza_revenue',
        unit: '1',
        sum: {
          dataPoints: [
            {
              asDouble: pizzaMetrics.revenue,
              timeUnixNano: String(now),
              attributes: [
                {
                  key: 'source',
                  value: { stringValue: config.metrics.source },
                },
              ],
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      },

      {
        name: 'pizza_latency_milliseconds',
        unit: 'ms',
        gauge: {
          dataPoints: [
            {
              asDouble:
                pizzaMetrics.latencyCount === 0
                  ? 0
                  : pizzaMetrics.totalLatency / pizzaMetrics.latencyCount,
              timeUnixNano: String(now),
              attributes: [{ key: 'source', value: { stringValue: config.metrics.source } }],
            },
          ],
        },
      },

      {
        name: 'endpoint_latency_milliseconds',
        unit: 'ms',
        gauge: {
          dataPoints: [
            {
              asDouble:
                endpointLatency.count === 0
                  ? 0
                  : endpointLatency.total / endpointLatency.count,
              timeUnixNano: String(now),
              attributes: [{ key: 'source', value: { stringValue: config.metrics.source } }],
            },
          ],
        },
      },
  
      {
        name: 'auth_attempts',
        unit: '1',
        sum: {
          dataPoints: [
            {
              asInt: authMetrics.success,
              timeUnixNano: String(now),
              attributes: [
                {
                  key: 'source',
                  value: { stringValue: config.metrics.source },
                },
                {
                  key: 'result',
                  value: { stringValue: 'success' },
                },
              ],
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      },
  
      {
        name: 'auth_attempts',
        unit: '1',
        sum: {
          dataPoints: [
            {
              asInt: authMetrics.failure,
              timeUnixNano: String(now),
              attributes: [
                {
                  key: 'source',
                  value: { stringValue: config.metrics.source },
                },
                {
                  key: 'result',
                  value: { stringValue: 'failure' },
                },
              ],
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      },
  
      {
        name: 'active_users_ratio',
        unit: '1',
        gauge: {
          dataPoints: [
            {
              asInt: activeUsers.size,
              timeUnixNano: String(now),
              attributes: [
                {
                  key: 'source',
                  value: { stringValue: config.metrics.source },
                },
              ],
            },
          ],
        },
      },
    ];
  
    const body = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics,
            },
          ],
        },
      ],
    };
  
    try {
      const response = await axios.post(config.metrics.endpointUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization:
            'Basic ' +
            Buffer.from(
              `${config.metrics.accountId}:${config.metrics.apiKey}`
            ).toString('base64'),
        },
      });
  
      console.log('✅ Metrics sent:', response.status);
    } catch (err) {
      console.error('❌ Metrics error:', err.response?.data || err.message);
    }

    
  // RESET windowed gauges only (keep monotonic counters cumulative for Prometheus rates)
  endpointLatency = { total: 0, count: 0 };
  pizzaMetrics.totalLatency = 0;
  pizzaMetrics.latencyCount = 0;
  activeUsers.clear();
}

// -----------------------------
// INTERVAL
// -----------------------------
function startMetrics(interval = 60000) {
  setInterval(sendMetrics, interval);
}

module.exports = {
  requestTracker,
  trackAuth,
  trackUser,
  pizzaPurchase,
  startMetrics,
};