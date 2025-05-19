const weatherService = require('../services/weatherService');
const logger = require('../utils/logger');

/**
 * Get weather data for a location
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getWeather = async (req, res) => {
    try {
        const { location } = req.query;

        // Validate location parameter
        if (!location) {
            return res.status(400).json({
                status: 'error',
                message: 'Location parameter is required'
            });
        }

        // Validate location format (city name or coordinates)
        const isCoordinates = /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location);
        const isCityName = /^[a-zA-Z\s,.-]+$/.test(location);

        if (!isCoordinates && !isCityName) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid location format. Use city name or coordinates (lat,lng)'
            });
        }

        logger.info(`Weather request received for location: ${location}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Get weather data from service
        const weatherData = await weatherService.getWeatherData(location);

        // Log successful response
        logger.info(`Weather data successfully retrieved for: ${weatherData.location.name}`);

        // Return weather data
        res.status(200).json({
            status: 'success',
            data: weatherData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Weather controller error:', {
            location: req.query.location,
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });

        // Handle specific error types
        if (error.message.includes('not found')) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message.includes('API error') || error.message.includes('timeout')) {
            return res.status(502).json({
                status: 'error',
                message: 'Weather service temporarily unavailable. Please try again later.'
            });
        }

        if (error.message.includes('TOMORROW_API_KEY')) {
            return res.status(500).json({
                status: 'error',
                message: 'Weather service configuration error'
            });
        }

        // Generic error response
        res.status(500).json({
            status: 'error',
            message: 'Internal server error while fetching weather data'
        });
    }
};

module.exports = {
    getWeather
};