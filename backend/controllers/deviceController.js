const pool = require('../config/database');
const AppError = require('../utils/appError');

exports.getUserDevices = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const [devices] = await pool.query(`
            SELECT dc.*, sd.temperature, sd.humidity, sd.state
            FROM user_devices ud
            JOIN device_control dc ON ud.device_id = dc.deviceId
            LEFT JOIN (
                SELECT deviceId, temperature, humidity, state
                FROM sensor_data
                WHERE (deviceId, timestamp) IN (
                    SELECT deviceId, MAX(timestamp)
                    FROM sensor_data
                    GROUP BY deviceId
                )
            ) sd ON dc.deviceId = sd.deviceId
            WHERE ud.user_id = ?
        `, [userId]);
        
        res.status(200).json({
            status: 'success',
            results: devices.length,
            data: devices
        });
    } catch (error) {
        next(error);
    }
};

exports.updateDeviceControl = async (req, res, next) => {
    try {
        const { deviceId, desiredTemp, mode, power } = req.body;
        const userId = req.user.id;
        
        // Verify user owns this device
        const [userDevices] = await pool.query(
            'SELECT * FROM user_devices WHERE user_id = ? AND device_id = ?',
            [userId, deviceId]
        );
        
        if (userDevices.length === 0) {
            return next(new AppError('Device not found or not authorized', 404));
        }
        
        // Update device control
        await pool.query(
            'UPDATE device_control SET desiredTemp = ?, mode = ?, power = ? WHERE deviceId = ?',
            [desiredTemp, mode, power, deviceId]
        );
        
        res.status(200).json({
            status: 'success',
            message: 'Device control updated'
        });
    } catch (error) {
        next(error);
    }
};

exports.getDeviceHistory = async (req, res, next) => {
    try {
        const { deviceId, hours = 24 } = req.query;
        const userId = req.user.id;
        
        // Verify user owns this device
        const [userDevices] = await pool.query(
            'SELECT * FROM user_devices WHERE user_id = ? AND device_id = ?',
            [userId, deviceId]
        );
        
        if (userDevices.length === 0) {
            return next(new AppError('Device not found or not authorized', 404));
        }
        
        // Get historical data
        const [history] = await pool.query(`
            SELECT * FROM sensor_data 
            WHERE deviceId = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            ORDER BY timestamp ASC
        `, [deviceId, hours]);
        
        res.status(200).json({
            status: 'success',
            results: history.length,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

exports.receiveSensorData = async (req, res, next) => {
    try {
        const { deviceId, temperature, humidity, state, desiredTemp } = req.body;
        
        // Update or insert device control
        await pool.query(
            'INSERT INTO device_control (deviceId, desiredTemp, mode, power) VALUES (?, ?, "auto", "on") ' +
            'ON DUPLICATE KEY UPDATE desiredTemp = ?',
            [deviceId, desiredTemp, desiredTemp]
        );
        
        // Insert sensor data
        await pool.query(
            'INSERT INTO sensor_data (deviceId, temperature, humidity, state, desiredTemp) VALUES (?, ?, ?, ?, ?)',
            [deviceId, temperature, humidity, state, desiredTemp]
        );
        
        res.status(201).json({
            status: 'success',
            message: 'Data received'
        });
    } catch (error) {
        next(error);
    }
};