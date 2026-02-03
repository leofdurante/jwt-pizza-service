// Prevent `service.js` from pulling in the real DB layer during tests.
// `service.js` imports routers, and those routers import `database.js` which
// instantiates a DB connection at module load.

jest.mock('./version.json', () => ({ version: 'test-version' }));
jest.mock('./config.js', () => ({
  jwtSecret: 'test-secret',
  factory: { url: 'https://pizza-factory.cs329.click', apiKey: 'test-api-key' },
  db: { connection: { host: 'localhost' } },
}));

jest.mock('./routes/authRouter.js', () => {
  const express = require('express');
  const router = express.Router();
  router.docs = [];
  router.authenticateToken = (req, res, next) => next();
  return {
    authRouter: router,
    setAuthUser: (req, res, next) => next(),
  };
});

jest.mock('./routes/userRouter.js', () => {
  const express = require('express');
  const router = express.Router();
  router.docs = [];
  return router;
});

jest.mock('./routes/orderRouter.js', () => {
  const express = require('express');
  const router = express.Router();
  router.docs = [];
  return router;
});

jest.mock('./routes/franchiseRouter.js', () => {
  const express = require('express');
  const router = express.Router();
  router.docs = [];
  return router;
});

describe('service', () => {
  test('exports an Express app', () => {
    const app = require('./service.js');
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
    expect(typeof app.use).toBe('function');
    expect(typeof app.get).toBe('function');
  });
});
