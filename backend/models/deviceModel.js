const pool = require('../config/database');

class Device {
    static async getDeviceById(deviceId) {
        const [rows] = await pool.query('SELECT * FROM device_control WHERE deviceId = ?', [deviceId]);
        return rows[0];
    }

    static async updateDeviceControl(deviceId, updateData) {
        const { desiredTemp, mode, power } = updateData;
        await pool.query(
            'UPDATE device_control SET desiredTemp = ?, mode = ?, power = ? WHERE deviceId = ?',
            [desiredTemp, mode, power, deviceId]
        );
    }

    static async getDeviceHistory(deviceId, hours) {
        const [rows] = await pool.query(`
            SELECT * FROM sensor_data 
            WHERE deviceId = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            ORDER BY timestamp ASC
        `, [deviceId, hours]);
        return rows;
    }

    static async saveSensorData(data) {
        const { deviceId, temperature, humidity, state, desiredTemp } = data;
        await pool.query(
            'INSERT INTO sensor_data (deviceId, temperature, humidity, state, desiredTemp) VALUES (?, ?, ?, ?, ?)',
            [deviceId, temperature, humidity, state, desiredTemp]
        );
    }
}

module.exports = Device;