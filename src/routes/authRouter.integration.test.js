const request = require('supertest');
const express = require('express');
const { authRouter } = require('./authRouter.js');
const { DB } = require('../database/database.js');

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
      addUser: jest.fn(),
      getUser: jest.fn(),
      loginUser: jest.fn(),
      logoutUser: jest.fn(),
      isLoggedIn: jest.fn(),
    },
    Role,
  };
});

// Don't mock authRouter itself, just mock setAuth function
// We'll mock it after import

describe('authRouter routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  describe('POST /api/auth', () => {
    test('should register a new user', async () => {
      const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', roles: [{ role: 'diner' }] };

      DB.addUser = jest.fn().mockResolvedValue(mockUser);
      DB.loginUser = jest.fn().mockResolvedValue();

      const res = await request(app)
        .post('/api/auth')
        .send({ name: 'Test User', email: 'test@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(DB.addUser).toHaveBeenCalled();
      expect(DB.loginUser).toHaveBeenCalled();
    });

    test('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/auth')
        .send({ email: 'test@test.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'name, email, and password are required');
    });

    test('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth')
        .send({ name: 'Test User', password: 'password123' });

      expect(res.status).toBe(400);
    });

    test('should return 400 if password is missing', async () => {
      const res = await request(app)
        .post('/api/auth')
        .send({ name: 'Test User', email: 'test@test.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/auth', () => {
    test('should login existing user', async () => {
      const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', roles: [{ role: 'diner' }] };

      DB.getUser = jest.fn().mockResolvedValue(mockUser);
      DB.loginUser = jest.fn().mockResolvedValue();

      const res = await request(app)
        .put('/api/auth')
        .send({ email: 'test@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(DB.getUser).toHaveBeenCalledWith('test@test.com', 'password123');
      expect(DB.loginUser).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/auth', () => {
    test('should logout user', async () => {
      const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', roles: [{ role: 'diner' }] };
      const mockToken = 'test-token';

      DB.logoutUser = jest.fn().mockResolvedValue();

      // Create an app where req.user is set BEFORE the router runs
      const localApp = express();
      localApp.use(express.json());
      localApp.use((req, res, next) => {
        req.user = mockUser;
        next();
      });
      localApp.use('/api/auth', authRouter);

      const res = await request(localApp)
        .delete('/api/auth')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'logout successful');
    });
  });
});
