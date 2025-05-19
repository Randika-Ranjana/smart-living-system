const pool = require('../config/database');
const logger = require('../utils/logger');

async function handleESP32Data(req, res) {
    const startTime = Date.now();
    let connection;
    
    try {
        logger.info('ESP32 Data Received', { body: req.body });
        
        const { deviceId, temperature, humidity, state, desiredTemp } = req.body;

        // Validation
        if (!deviceId?.trim()) {
            return res.status(400).json({
                status: 'error',
                error: 'Valid deviceId is required'
            });
        }

        if (typeof temperature !== 'number' || isNaN(temperature)) {
            return res.status(400).json({
                status: 'error',
                error: 'Temperature must be a valid number'
            });
        }

        if (typeof humidity !== 'number' || isNaN(humidity)) {
            return res.status(400).json({
                status: 'error', 
                error: 'Humidity must be a valid number'
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Update device control
        const [controlResult] = await connection.query(
            `INSERT INTO device_control 
            (deviceId, desiredTemp, mode, power) 
            VALUES (?, ?, "auto", "on")
            ON DUPLICATE KEY UPDATE 
            desiredTemp = VALUES(desiredTemp),
            updatedAt = CURRENT_TIMESTAMP`,
            [deviceId, desiredTemp || 22]
        );

        // Insert sensor data
        const [sensorResult] = await connection.query(
            `INSERT INTO sensor_data 
            (deviceId, temperature, humidity, state, desiredTemp) 
            VALUES (?, ?, ?, ?, ?)`,
            [deviceId, temperature, humidity, state || 'unknown', desiredTemp]
        );

        await connection.commit();
        
        res.status(201).json({
            status: 'success',
            deviceId,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        
        logger.error('ESP32 Processing Error', {
            error: err.message,
            stack: err.stack
        });

        res.status(500).json({
            status: 'error',
            error: 'Failed to process device data'
        });
    } finally {
        if (connection) connection.release();
    }
}

// Single consistent export method
module.exports = { handleESP32Data };