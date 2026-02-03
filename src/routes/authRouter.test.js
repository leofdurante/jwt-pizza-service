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
      isLoggedIn: jest.fn(),
      loginUser: jest.fn(),
      logoutUser: jest.fn(),
    },
    Role,
  };
});

const jwt = require('jsonwebtoken');
const authRouterModule = require('./authRouter.js');
const { authRouter, setAuthUser, setAuth } = authRouterModule;
const { DB } = require('../database/database.js');
const config = require('../config.js');

// readAuthToken is not exported, so we'll test it indirectly through setAuthUser

describe('authRouter', () => {
  // Note: readAuthToken is not exported, so we test it indirectly through setAuthUser

  describe('authenticateToken', () => {
    test('should call next if user exists', () => {
      const req = { user: { id: 1 } };
      const res = {};
      const next = jest.fn();

      authRouter.authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).toBeUndefined();
    });

    test('should return 401 if no user', () => {
      const req = { user: null };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
      const next = jest.fn();

      authRouter.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({ message: 'unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('setAuthUser middleware', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should set user if valid token', async () => {
      const user = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }] };
      const token = jwt.sign(user, config.jwtSecret);
      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      };
      const res = {};
      const next = jest.fn();

      DB.isLoggedIn = jest.fn().mockResolvedValue(true);

      await setAuthUser(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(user.id);
      expect(req.user.isRole).toBeDefined();
      expect(req.user.isRole('diner')).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    test('should not set user if token not in database', async () => {
      const user = { id: 1, name: 'Test', email: 'test@test.com', roles: [{ role: 'diner' }] };
      const token = jwt.sign(user, config.jwtSecret);
      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      };
      const res = {};
      const next = jest.fn();

      DB.isLoggedIn = jest.fn().mockResolvedValue(false);

      await setAuthUser(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('should not set user if invalid token', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      };
      const res = {};
      const next = jest.fn();

      DB.isLoggedIn = jest.fn().mockResolvedValue(true);

      await setAuthUser(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
    });

    test('should call next if no token', async () => {
      const req = {
        headers: {},
      };
      const res = {};
      const next = jest.fn();

      await setAuthUser(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('setAuth', () => {
    test('should create token and login user', async () => {
      const user = { id: 1, name: 'Test', email: 'test@test.com' };
      DB.loginUser = jest.fn().mockResolvedValue();

      const token = await setAuth(user);

      expect(token).toBeDefined();
      expect(jwt.verify(token, config.jwtSecret)).toMatchObject(user);
      expect(DB.loginUser).toHaveBeenCalledWith(user.id, token);
    });
  });
});
