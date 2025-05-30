const express = require('express');
const deviceController = require('../controllers/deviceController');
const deviceControlController = require('../controllers/deviceControlController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Protect all routes
router.use(authMiddleware.protect);

// Device control endpoints (now properly nested under /api/devices)
router.get('/control', deviceControlController.getDeviceControl);  // GET /api/devices/control
router.put('/control', deviceController.updateDeviceControl);     // PUT /api/devices/control

// User devices endpoints
router.get('/', deviceController.getUserDevices);                 // GET /api/devices
router.get('/:deviceId/history', deviceController.getDeviceHistory); // GET /api/devices/{deviceId}/history

module.exports = router;