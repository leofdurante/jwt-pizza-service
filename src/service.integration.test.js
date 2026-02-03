const request = require('supertest');

// Mock version.json before requiring service
jest.mock('./version.json', () => ({
  version: '20240202.120000',
}));

// Mock config before requiring service
jest.mock('./config.js', () => ({
  jwtSecret: 'test-secret',
  factory: {
    url: 'https://pizza-factory.cs329.click',
    apiKey: 'test-api-key',
  },
  db: {
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'test',
      database: 'pizza',
      connectTimeout: 60000,
    },
    listPerPage: 10,
  },
}));

// Mock routers to have docs property AND be actual Express Routers.
// (Express' `.use()` requires a middleware function/router, not a plain object.)
jest.mock('./routes/authRouter.js', () => {
  const express = require('express');
  const router = express.Router();
  router.docs = [{ method: 'POST', path: '/api/auth', description: 'Register' }];
  router.authenticateToken = (req, res, next) => next();
  return {
    authRouter: router,
    setAuthUser: (req, res, next) => next(),
  };
});

jest.mock('./routes/userRouter.js', () => {
  const express = require('express');
  const router = express.Router();
  router.docs = [{ method: 'GET', path: '/api/user/me', description: 'Get user' }];
  return router;
});

jest.mock('./routes/orderRouter.js', () => {
  const express = require('express');
  const router = express.Router();
  router.docs = [{ method: 'GET', path: '/api/order/menu', description: 'Get menu' }];
  return router;
});

jest.mock('./routes/franchiseRouter.js', () => {
  const express = require('express');
  const router = express.Router();
  router.docs = [{ method: 'GET', path: '/api/franchise', description: 'List franchises' }];
  return router;
});

const app = require('./service.js');

describe('service integration', () => {
  describe('GET /', () => {
    test('should return welcome message and version', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'welcome to JWT Pizza');
      expect(res.body).toHaveProperty('version', '20240202.120000');
    });
  });

  describe('GET /api/docs', () => {
    test('should return API documentation', async () => {
      const res = await request(app).get('/api/docs');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('endpoints');
      expect(res.body).toHaveProperty('config');
      expect(Array.isArray(res.body.endpoints)).toBe(true);
    });
  });

  describe('404 handler', () => {
    test('should return 404 for unknown endpoints', async () => {
      const res = await request(app).get('/unknown');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'unknown endpoint');
    });
  });

  describe('CORS headers', () => {
    test('should set CORS headers', async () => {
      const res = await request(app)
        .options('/api/docs')
        .set('Origin', 'http://localhost:3000');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-methods']).toContain('GET');
    });
  });
});
