const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config.js');
const { asyncHandler } = require('../endpointHelper.js');
const { DB, Role } = require('../database/database.js');
const metrics = require('../metrics');

const authRouter = express.Router();

// -----------------------------
// SET AUTH USER (middleware)
// -----------------------------
async function setAuthUser(req, res, next) {
  const token = readAuthToken(req);

  if (token) {
    try {
      if (await DB.isLoggedIn(token)) {
        req.user = jwt.verify(token, config.jwtSecret);
        req.user.isRole = (role) => !!req.user.roles.find((r) => r.role === role);
      }
    } catch {
      req.user = null;
    }
  }

  next();
}

// -----------------------------
// AUTH CHECK
// -----------------------------
authRouter.authenticateToken = (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ message: 'unauthorized' });
  }
  next();
};

// -----------------------------
// REGISTER
// -----------------------------
authRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        metrics.trackAuth(false);
        return res.status(400).json({ message: 'name, email, and password are required' });
      }

      const user = await DB.addUser({
        name,
        email,
        password,
        roles: [{ role: Role.Diner }],
      });

      const token = await setAuth(user);

      // ✅ METRICS
      metrics.trackAuth(true);
      metrics.trackUser(user.id);

      res.json({ user, token });
    } catch (err) {
      metrics.trackAuth(false);
      throw err;
    }
  })
);

// -----------------------------
// LOGIN
// -----------------------------
authRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await DB.getUser(email, password);

      if (!user) {
        metrics.trackAuth(false);
        return res.status(401).json({ message: 'invalid credentials' });
      }

      const token = await setAuth(user);

      // ✅ METRICS
      metrics.trackAuth(true);
      metrics.trackUser(user.id);

      res.json({ user, token });
    } catch (err) {
      metrics.trackAuth(false);
      throw err;
    }
  })
);

// -----------------------------
// LOGOUT
// -----------------------------
authRouter.delete(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    await clearAuth(req);

    res.json({ message: 'logout successful' });
  })
);

// -----------------------------
// HELPERS
// -----------------------------
async function setAuth(user) {
  const token = jwt.sign(user, config.jwtSecret);
  await DB.loginUser(user.id, token);
  return token;
}

async function clearAuth(req) {
  const token = readAuthToken(req);
  if (token) {
    await DB.logoutUser(token);
  }
}

function readAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authHeader.split(' ')[1];
  }
  return null;
}

module.exports = { authRouter, setAuthUser, setAuth };