const express = require('express');
const { getWeather } = require('../controllers/weatherController');
const router = express.Router();

// Weather endpoint - GET /api/weather?location=cityname or lat,lng
router.get('/', getWeather);

module.exports = router;