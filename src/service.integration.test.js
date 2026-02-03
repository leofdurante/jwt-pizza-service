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

// Mock routers to have docs property
jest.mock('./routes/authRouter.js', () => {
  const mockRouter = {
    docs: [{ method: 'POST', path: '/api/auth', description: 'Register' }],
    authenticateToken: jest.fn((req, res, next) => next()),
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  return {
    authRouter: mockRouter,
    setAuthUser: jest.fn((req, res, next) => next()),
  };
});

jest.mock('./routes/userRouter.js', () => ({
  docs: [{ method: 'GET', path: '/api/user/me', description: 'Get user' }],
  use: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('./routes/orderRouter.js', () => ({
  docs: [{ method: 'GET', path: '/api/order/menu', description: 'Get menu' }],
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

jest.mock('./routes/franchiseRouter.js', () => ({
  docs: [{ method: 'GET', path: '/api/franchise', description: 'List franchises' }],
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));

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

  describe('Error handler', () => {
    test('should handle errors with statusCode', async () => {
      // Create a route that throws an error for testing
      const testRouter = express.Router();
      testRouter.get('/test-error', () => {
        const error = new Error('Test error');
        error.statusCode = 400;
        throw error;
      });
      app.use('/test', testRouter);

      const res = await request(app).get('/test/test-error');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Test error');
    });

    test('should handle errors without statusCode (defaults to 500)', async () => {
      const testRouter = express.Router();
      testRouter.get('/test-error-500', () => {
        throw new Error('Internal error');
      });
      app.use('/test', testRouter);

      const res = await request(app).get('/test/test-error-500');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('message', 'Internal error');
    });
  });
});
