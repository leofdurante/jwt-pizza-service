const request = require('supertest');

// Mock version.json before requiring service
jest.mock('../version.json', () => ({
  version: '20240202.120000',
}));

// Mock config before requiring service
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

// Mock database - prevent init, provide methods for auth + list users
jest.mock('../database/database.js', () => {
  const Role = { Diner: 'diner', Franchisee: 'franchisee', Admin: 'admin' };
  const loggedInTokens = new Set();
  return {
    Role,
    DB: {
      initialized: Promise.resolve(),
      addUser: jest.fn().mockImplementation(async (user) => {
        const created = { id: 1, name: user.name, email: user.email, roles: user.roles || [{ role: Role.Diner }], password: undefined };
        return created;
      }),
      getUser: jest.fn(),
      loginUser: jest.fn().mockImplementation(async (userId, token) => {
        loggedInTokens.add(token?.slice(-10) || '');
      }),
      logoutUser: jest.fn(),
      isLoggedIn: jest.fn().mockResolvedValue(true),
      getFranchises: jest.fn().mockResolvedValue([[], false]),
      getFranchise: jest.fn(),
      getUserFranchises: jest.fn().mockResolvedValue([]),
      createFranchise: jest.fn(),
      deleteFranchise: jest.fn(),
      createStore: jest.fn(),
      deleteStore: jest.fn(),
      getMenu: jest.fn(),
      addMenuItem: jest.fn(),
      updateUser: jest.fn(),
      getOrders: jest.fn(),
      addDinerOrder: jest.fn(),
      listUsers: jest.fn().mockResolvedValue([[], false]),
    },
  };
});

const app = require('../service.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

describe('userRouter integration - list users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('list users unauthorized', async () => {
    const listUsersRes = await request(app).get('/api/user');
    expect(listUsersRes.status).toBe(401);
  });

  test('list users', async () => {
    const [, userToken] = await registerUser(request(app));
    const listUsersRes = await request(app)
      .get('/api/user')
      .set('Authorization', 'Bearer ' + userToken);
    expect(listUsersRes.status).toBe(200);
  });
});
