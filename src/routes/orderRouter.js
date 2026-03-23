const express = require('express');
const config = require('../config.js');
const { Role, DB } = require('../database/database.js');
const { authRouter } = require('./authRouter.js');
const { asyncHandler, StatusCodeError } = require('../endpointHelper.js');
const metrics = require('../metrics');
const logger = require('../logger');

const orderRouter = express.Router();

// -----------------------------
// CREATE ORDER (WITH METRICS)
// -----------------------------
orderRouter.post(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const start = Date.now(); // ⏱ start timer

    try {
      const orderReq = req.body;

      // 🧮 calculate revenue
      const revenue = orderReq.items.reduce((sum, item) => sum + item.price, 0);
      const quantity = orderReq.items.length;

      const order = await DB.addDinerOrder(req.user, orderReq);
      const factoryPayload = {
        diner: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
        },
        order,
      };
      logger.log('info', 'factory-req', { requestBody: factoryPayload });

      const r = await fetch(`${config.factory.url}/api/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${config.factory.apiKey}`,
        },
        body: JSON.stringify(factoryPayload),
      });

      const j = await r.json();
      logger.log(r.ok ? 'info' : 'warn', 'factory-res', {
        statusCode: r.status,
        responseBody: j,
      });
      const latency = Date.now() - start; // ⏱ end timer

      if (r.ok) {
        // ✅ SUCCESS METRICS
        metrics.pizzaPurchase(true, latency, revenue, quantity);

        res.send({
          order,
          followLinkToEndChaos: j.reportUrl,
          jwt: j.jwt,
        });
      } else {
        // ❌ FAILURE METRICS
        metrics.pizzaPurchase(false, latency, 0, quantity);

        res.status(500).send({
          message: 'Failed to fulfill order at factory',
          followLinkToEndChaos: j.reportUrl,
        });
      }
    } catch (err) {
      const latency = Date.now() - start;
      logger.log('error', 'factory-res', {
        message: err.message,
      });

      // ❌ FAILURE METRICS
      metrics.pizzaPurchase(false, latency, 0, req.body?.items?.length ?? 1);

      throw err;
    }
  })
);

// -----------------------------
// GET MENU
// -----------------------------
orderRouter.get(
  '/menu',
  asyncHandler(async (req, res) => {
    res.send(await DB.getMenu());
  })
);

// -----------------------------
// ADD MENU ITEM (ADMIN ONLY)
// -----------------------------
orderRouter.put(
  '/menu',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!req.user.isRole(Role.Admin)) {
      throw new StatusCodeError('unable to add menu item', 403);
    }

    const addMenuItemReq = req.body;
    await DB.addMenuItem(addMenuItemReq);
    res.send(await DB.getMenu());
  })
);

// -----------------------------
// GET ORDERS
// -----------------------------
orderRouter.get(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    res.json(await DB.getOrders(req.user, req.query.page));
  })
);

module.exports = orderRouter;