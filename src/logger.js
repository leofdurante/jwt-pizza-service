const config = require('./config');

class Logger {
  httpLogger = (req, res, next) => {
    const startedAt = Date.now();
    const originalSend = res.send.bind(res);

    res.send = (body) => {
      res.locals.responseBody = body;
      return originalSend(body);
    };

    res.on('finish', () => {
      const logData = {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        authorized: !!req.headers.authorization,
        reqBody: req.body,
        resBody: res.locals.responseBody,
        durationMs: Date.now() - startedAt,
      };
      this.log(this.statusToLogLevel(res.statusCode), 'http-req', logData);
    });

    next();
  };

  log(level, type, data) {
    if (!config.logging?.endpointUrl || !config.logging?.accountId || !config.logging?.apiKey) {
      return;
    }

    const labels = {
      component: config.logging.source || 'jwt-pizza-service-dev',
      level,
      type,
    };

    const values = [[this.nowString(), this.sanitize(data)]];
    const logEvent = { streams: [{ stream: labels, values }] };
    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(data) {
    const asText = JSON.stringify(data ?? {});
    return asText
      .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"*****"')
      .replace(/"token"\s*:\s*"[^"]*"/gi, '"token":"*****"')
      .replace(/"jwt"\s*:\s*"[^"]*"/gi, '"jwt":"*****"')
      .replace(/\\"password\\"\s*:\s*\\"[^"]*\\"/gi, '\\"password\\":\\"*****\\"')
      .replace(/\\"token\\"\s*:\s*\\"[^"]*\\"/gi, '\\"token\\":\\"*****\\"')
      .replace(/\\"jwt\\"\s*:\s*\\"[^"]*\\"/gi, '\\"jwt\\":\\"*****\\"')
      .replace(/"authorization"\s*:\s*"[^"]*"/gi, '"authorization":"*****"')
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer *****');
  }

  sendLogToGrafana(event) {
    if (process.env.NODE_ENV === 'test') return;

    fetch(config.logging.endpointUrl, {
      method: 'POST',
      body: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          console.log('Failed to send log to Grafana');
        }
      })
      .catch(() => {
        // Logging must never break request flow.
      });
  }
}

module.exports = new Logger();
