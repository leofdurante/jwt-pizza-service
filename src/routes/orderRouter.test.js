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
      getMenu: jest.fn(),
      addMenuItem: jest.fn(),
      getOrders: jest.fn(),
      addDinerOrder: jest.fn(),
    },
    Role,
  };
});

const request = require('supertest');
const express = require('express');
const orderRouter = require('./orderRouter.js');
const { DB } = require('../database/database.js');
const { authRouter } = require('./authRouter.js');
const config = require('../config.js');

// Mock fetch globally
global.fetch = jest.fn();

describe('orderRouter', () => {
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
    app.use('/api/order', orderRouter);
    return app;
  };

  describe('GET /api/order/menu', () => {
    test('should return menu items', async () => {
      const mockMenu = [
        { id: 1, title: 'Veggie', description: 'A garden', image: 'pizza1.png', price: 0.0038 },
      ];
      DB.getMenu = jest.fn().mockResolvedValue(mockMenu);

      const app = createAppWithUser(null);
      const res = await request(app).get('/api/order/menu');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockMenu);
      expect(DB.getMenu).toHaveBeenCalled();
    });
  });

  describe('PUT /api/order/menu', () => {
    test('should add menu item if user is admin', async () => {
      const mockUser = { id: 1, name: 'Admin', email: 'admin@test.com', roles: [{ role: 'admin' }], isRole: jest.fn((role) => role === 'admin') };
      const newItem = { title: 'New Pizza', description: 'Test', image: 'pizza.png', price: 0.01 };
      const mockMenu = [newItem];

      DB.addMenuItem = jest.fn().mockResolvedValue({ ...newItem, id: 1 });
      DB.getMenu = jest.fn().mockResolvedValue(mockMenu);

      const app = createAppWithUser(mockUser);

      const res = await request(app)
        .put('/api/order/menu')
        .send(newItem);

      expect(res.status).toBe(200);
      expect(DB.addMenuItem).toHaveBeenCalledWith(newItem);
      expect(DB.getMenu).toHaveBeenCalled();
    });

    test('should return 403 if user is not admin', async () => {
      const mockUser = { id: 1, name: 'User', email: 'user@test.com', roles: [{ role: 'diner' }], isRole: jest.fn(() => false) };

      const app = createAppWithUser(mockUser);

      const res = await request(app)
        .put('/api/order/menu')
        .send({ title: 'New Pizza' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/order', () => {
    test('should return orders for authenticated user', async () => {
      const mockUser = { id: 1, name: 'User', email: 'user@test.com', roles: [{ role: 'diner' }] };
      const mockOrders = {
        dinerId: 1,
        orders: [{ id: 1, franchiseId: 1, storeId: 1, date: '2024-01-01' }],
        page: 1,
      };

      DB.getOrders = jest.fn().mockResolvedValue(mockOrders);

      const app = createAppWithUser(mockUser);

      const res = await request(app).get('/api/order');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockOrders);
      expect(DB.getOrders).toHaveBeenCalledWith(mockUser, undefined);
    });
  });

  describe('POST /api/order', () => {
    test('should create order and forward to factory', async () => {
      const mockUser = { id: 1, name: 'User', email: 'user@test.com', roles: [{ role: 'diner' }] };
      const orderReq = {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
      };
      const mockOrder = { id: 1, ...orderReq };
      const factoryResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ reportUrl: 'http://factory.com/report', jwt: 'factory-jwt' }),
      };

      DB.addDinerOrder = jest.fn().mockResolvedValue(mockOrder);
      global.fetch.mockResolvedValue(factoryResponse);

      const app = createAppWithUser(mockUser);

      const res = await request(app)
        .post('/api/order')
        .send(orderReq);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('order');
      expect(res.body).toHaveProperty('followLinkToEndChaos');
      expect(res.body).toHaveProperty('jwt');
      expect(global.fetch).toHaveBeenCalledWith(
        `${config.factory.url}/api/order`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            authorization: `Bearer ${config.factory.apiKey}`,
          }),
        })
      );
    });

    test('should return 500 if factory request fails', async () => {
      const mockUser = { id: 1, name: 'User', email: 'user@test.com', roles: [{ role: 'diner' }] };
      const orderReq = { franchiseId: 1, storeId: 1, items: [] };
      const mockOrder = { id: 1, ...orderReq };
      const factoryResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ reportUrl: 'http://factory.com/error' }),
      };

      DB.addDinerOrder = jest.fn().mockResolvedValue(mockOrder);
      global.fetch.mockResolvedValue(factoryResponse);

      const app = createAppWithUser(mockUser);

      const res = await request(app)
        .post('/api/order')
        .send(orderReq);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('message', 'Failed to fulfill order at factory');
    });
  });
});
