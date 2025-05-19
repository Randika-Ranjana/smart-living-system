const pool = require('../config/database');
const logger = require('../utils/logger');

exports.getDeviceControl = async (req, res) => {
    try {
        const { deviceId } = req.query;

        // Validate input
        if (!deviceId) {
            logger.warn('Missing deviceId in query parameters');
            return res.status(400).json({
                status: 'error',
                message: 'deviceId query parameter is required',
                example: '/api/devices/control?deviceId=Room-01'
            });
        }

        // Database query
        const [rows] = await pool.query(
            'SELECT * FROM device_control WHERE deviceId = ?',
            [deviceId]
        );

        // Handle no results
        if (rows.length === 0) {
            logger.warn(`Device not found: ${deviceId}`);
            return res.status(404).json({
                status: 'error',
                message: 'Device not found',
                deviceId
            });
        }

        // Successful response
        logger.info(`Retrieved control settings for device: ${deviceId}`);
        res.status(200).json({
            status: 'success',
            data: rows[0]
        });

    } catch (err) {
        logger.error('Device Control Error:', {
            error: err.message,
            stack: err.stack
        });
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch device control',
            systemError: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};