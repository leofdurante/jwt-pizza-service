// Mock config BEFORE importing anything that uses it
jest.mock('../config.js', () => ({
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

// Mock database to prevent initialization
jest.mock('../database/database.js', () => {
  const Role = { Diner: 'diner', Franchisee: 'franchisee', Admin: 'admin' };
  return {
    DB: {
      getFranchises: jest.fn(),
      getUserFranchises: jest.fn(),
      createFranchise: jest.fn(),
      deleteFranchise: jest.fn(),
      getFranchise: jest.fn(),
      createStore: jest.fn(),
      deleteStore: jest.fn(),
    },
    Role,
  };
});

const request = require('supertest');
const express = require('express');
const franchiseRouter = require('./franchiseRouter.js');
const { DB } = require('../database/database.js');
const { authRouter } = require('./authRouter.js');

describe('franchiseRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authRouter.authenticateToken = jest.fn((req, res, next) => {
      if (!req.user) {
        return res.status(401).send({ message: 'unauthorized' });
      }
      next();
    });
  });

  const createAppWithUser = (user) => {
    const app = express();
    app.use(express.json());
    if (user) {
      app.use((req, res, next) => {
        req.user = user;
        next();
      });
    }
    app.use('/api/franchise', franchiseRouter);
    return app;
  };

  describe('GET /api/franchise', () => {
    test('should return franchises', async () => {
      const mockFranchises = [{ id: 1, name: 'Pizza Place' }];
      const mockMore = false;

      DB.getFranchises = jest.fn().mockResolvedValue([mockFranchises, mockMore]);

      const app = createAppWithUser(null);

      const res = await request(app).get('/api/franchise');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('franchises');
      expect(res.body).toHaveProperty('more', mockMore);
    });
  });

  describe('GET /api/franchise/:userId', () => {
    test('should return user franchises if user matches', async () => {
      const mockUser = { id: 1, name: 'User', email: 'user@test.com', roles: [{ role: 'diner' }], isRole: jest.fn(() => false) };
      const mockFranchises = [{ id: 1, name: 'Pizza Place' }];

      DB.getUserFranchises = jest.fn().mockResolvedValue(mockFranchises);

      const app = createAppWithUser(mockUser);

      const res = await request(app).get('/api/franchise/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockFranchises);
      expect(DB.getUserFranchises).toHaveBeenCalledWith(1);
    });

    test('should return empty array if user does not match and not admin', async () => {
      const mockUser = { id: 1, name: 'User', email: 'user@test.com', roles: [{ role: 'diner' }], isRole: jest.fn(() => false) };

      const app = createAppWithUser(mockUser);

      const res = await request(app).get('/api/franchise/2');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should allow admin to view any user franchises', async () => {
      const mockAdmin = { id: 2, name: 'Admin', email: 'admin@test.com', roles: [{ role: 'admin' }], isRole: jest.fn((role) => role === 'admin') };
      const mockFranchises = [{ id: 1, name: 'Pizza Place' }];

      DB.getUserFranchises = jest.fn().mockResolvedValue(mockFranchises);

      const app = createAppWithUser(mockAdmin);

      const res = await request(app).get('/api/franchise/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockFranchises);
    });
  });

  describe('POST /api/franchise', () => {
    test('should create franchise if user is admin', async () => {
      const mockAdmin = { id: 1, name: 'Admin', email: 'admin@test.com', roles: [{ role: 'admin' }], isRole: jest.fn((role) => role === 'admin') };
      const franchiseData = { name: 'New Franchise', admins: [{ email: 'admin@test.com' }] };
      const createdFranchise = { id: 1, ...franchiseData };

      DB.createFranchise = jest.fn().mockResolvedValue(createdFranchise);

      const app = createAppWithUser(mockAdmin);

      const res = await request(app)
        .post('/api/franchise')
        .send(franchiseData);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(createdFranchise);
      expect(DB.createFranchise).toHaveBeenCalledWith(franchiseData);
    });

    test('should return 403 if user is not admin', async () => {
      const mockUser = { id: 1, name: 'User', email: 'user@test.com', roles: [{ role: 'diner' }], isRole: jest.fn(() => false) };

      const app = createAppWithUser(mockUser);

      const res = await request(app)
        .post('/api/franchise')
        .send({ name: 'New Franchise' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/franchise/:franchiseId', () => {
    test('should delete franchise', async () => {
      DB.deleteFranchise = jest.fn().mockResolvedValue();

      const app = createAppWithUser(null);

      const res = await request(app).delete('/api/franchise/1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'franchise deleted');
      expect(DB.deleteFranchise).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /api/franchise/:franchiseId/store', () => {
    test('should create store if user is admin', async () => {
      const mockAdmin = { id: 1, name: 'Admin', email: 'admin@test.com', roles: [{ role: 'admin' }], isRole: jest.fn((role) => role === 'admin') };
      const mockFranchise = { id: 1, name: 'Franchise', admins: [] };
      const storeData = { name: 'New Store' };
      const createdStore = { id: 1, ...storeData, totalRevenue: 0 };

      DB.getFranchise = jest.fn().mockResolvedValue(mockFranchise);
      DB.createStore = jest.fn().mockResolvedValue(createdStore);

      const app = createAppWithUser(mockAdmin);

      const res = await request(app)
        .post('/api/franchise/1/store')
        .send(storeData);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(createdStore);
    });

    test('should return 403 if user is not admin or franchise admin', async () => {
      const mockUser = { id: 2, name: 'User', email: 'user@test.com', roles: [{ role: 'diner' }], isRole: jest.fn(() => false) };
      const mockFranchise = { id: 1, name: 'Franchise', admins: [{ id: 1 }] };

      DB.getFranchise = jest.fn().mockResolvedValue(mockFranchise);

      const app = createAppWithUser(mockUser);

      const res = await request(app)
        .post('/api/franchise/1/store')
        .send({ name: 'New Store' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/franchise/:franchiseId/store/:storeId', () => {
    test('should delete store if user is admin', async () => {
      const mockAdmin = { id: 1, name: 'Admin', email: 'admin@test.com', roles: [{ role: 'admin' }], isRole: jest.fn((role) => role === 'admin') };
      const mockFranchise = { id: 1, name: 'Franchise', admins: [] };

      DB.getFranchise = jest.fn().mockResolvedValue(mockFranchise);
      DB.deleteStore = jest.fn().mockResolvedValue();

      const app = createAppWithUser(mockAdmin);

      const res = await request(app).delete('/api/franchise/1/store/1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'store deleted');
      expect(DB.deleteStore).toHaveBeenCalledWith(1, 1);
    });
  });
});
