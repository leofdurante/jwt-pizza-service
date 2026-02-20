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
      updateUser: jest.fn(),
      listUsers: jest.fn().mockResolvedValue([[], false]),
    },
    Role,
  };
});

const request = require('supertest');
const express = require('express');
const userRouter = require('./userRouter.js');
const { DB } = require('../database/database.js');
const { setAuth } = require('./authRouter.js');
jest.mock('./authRouter.js', () => {
  const actual = jest.requireActual('./authRouter.js');
  return {
    ...actual,
    setAuth: jest.fn(),
  };
});

describe('userRouter', () => {
  let app;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authenticateToken
    const { authRouter } = require('./authRouter.js');
    authRouter.authenticateToken = jest.fn((req, res, next) => {
      if (!req.user) {
        return res.status(401).send({ message: 'unauthorized' });
      }
      next();
    });
  });

  const createAppWithUser = (user) => {
    app = express();
    app.use(express.json());
    // Set user BEFORE registering routes
    app.use((req, res, next) => {
      req.user = user;
      next();
    });
    app.use('/api/user', userRouter);
    return app;
  };

  describe('GET /api/user/me', () => {
    test('should return authenticated user', async () => {
      mockUser = { id: 1, name: 'Test User', email: 'test@test.com', roles: [{ role: 'diner' }] };
      const testApp = createAppWithUser(mockUser);

      const res = await request(testApp).get('/api/user/me');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(mockUser);
    });

    test('should return 401 if not authenticated', async () => {
      app = express();
      app.use(express.json());
      app.use('/api/user', userRouter);

      const res = await request(app).get('/api/user/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/user/:userId', () => {
    test('should update user if user is updating themselves', async () => {
      mockUser = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }], isRole: jest.fn(() => false) };
      const updatedUser = { id: 1, name: 'Updated', email: 'test@test.com', roles: [{ role: 'diner' }] };
      const mockToken = 'new-token';

      DB.updateUser = jest.fn().mockResolvedValue(updatedUser);
      setAuth.mockResolvedValue(mockToken);

      const testApp = createAppWithUser(mockUser);

      const res = await request(testApp)
        .put('/api/user/1')
        .send({ name: 'Updated', email: 'test@test.com' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token', mockToken);
    });

    test('should allow admin to update any user', async () => {
      mockUser = { id: 2, name: 'Admin', email: 'admin@test.com', roles: [{ role: 'admin' }], isRole: jest.fn((role) => role === 'admin') };
      const updatedUser = { id: 1, name: 'Updated', email: 'test@test.com', roles: [{ role: 'diner' }] };
      const mockToken = 'new-token';

      DB.updateUser = jest.fn().mockResolvedValue(updatedUser);
      setAuth.mockResolvedValue(mockToken);

      const testApp = createAppWithUser(mockUser);

      const res = await request(testApp)
        .put('/api/user/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
    });

    test('should return 403 if user tries to update another user', async () => {
      mockUser = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }], isRole: jest.fn(() => false) };

      const testApp = createAppWithUser(mockUser);

      const res = await request(testApp)
        .put('/api/user/2')
        .send({ name: 'Updated' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'unauthorized');
    });
  });

  describe('DELETE /api/user/:userId', () => {
    test('should return not implemented', async () => {
      mockUser = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }] };

      const testApp = createAppWithUser(mockUser);

      const res = await request(testApp).delete('/api/user/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'not implemented');
    });
  });

  describe('GET /api/user', () => {
    test('should return users list', async () => {
      mockUser = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }] };
      const mockUsers = [{ id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] }];

      DB.listUsers = jest.fn().mockResolvedValue([mockUsers, false]);

      const testApp = createAppWithUser(mockUser);

      const res = await request(testApp).get('/api/user');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body.users).toEqual(mockUsers);
      expect(res.body).toHaveProperty('more', false);
    });

    test('should pass page and limit to listUsers', async () => {
      mockUser = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }] };
      DB.listUsers = jest.fn().mockResolvedValue([[], false]);

      const testApp = createAppWithUser(mockUser);

      await request(testApp).get('/api/user?page=2&limit=5');
      expect(DB.listUsers).toHaveBeenCalledWith(2, 5, '*');
    });

    test('should pass name filter to listUsers', async () => {
      mockUser = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }] };
      DB.listUsers = jest.fn().mockResolvedValue([[], false]);

      const testApp = createAppWithUser(mockUser);

      await request(testApp).get('/api/user?name=pizza');
      expect(DB.listUsers).toHaveBeenCalledWith(1, 10, 'pizza');
    });

    test('should return more when there are additional pages', async () => {
      mockUser = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }] };
      const mockUsers = [{ id: 1, name: 'User1', email: 'u1@test.com', roles: [{ role: 'diner' }] }];

      DB.listUsers = jest.fn().mockResolvedValue([mockUsers, true]);

      const testApp = createAppWithUser(mockUser);

      const res = await request(testApp).get('/api/user?page=1&limit=1');
      expect(res.status).toBe(200);
      expect(res.body.users).toEqual(mockUsers);
      expect(res.body.more).toBe(true);
    });
  });
});
