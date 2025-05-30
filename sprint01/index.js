require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(bodyParser.json());
app.use(cors());

// Database connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'sprint01',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// API Endpoints

// POST /device-data - ESP32 sends sensor data
app.post('/device-data', async (req, res) => {
  try {
    const { deviceId, temperature, humidity, state, desiredTemp } = req.body;
    
    // Insert sensor data
    const [result] = await db.query(
      `INSERT INTO sensor_data (deviceId, temperature, humidity, state, desiredTemp) 
       VALUES (?, ?, ?, ?, ?)`,
      [deviceId, temperature, humidity, state, desiredTemp]
    );
    
    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: 'Database operation failed' });
  }
});

// GET /api/devices/control - ESP32 fetches control settings
app.get('/api/devices/control', async (req, res) => {
  try {
    const { deviceId } = req.query;
    
    // Get device control settings
    const [rows] = await db.query(
      `SELECT desiredTemp, mode, power FROM device_control WHERE deviceId = ?`,
      [deviceId]
    );
    
    if (rows.length === 0) {
      // Create default settings if device doesn't exist
      await db.query(
        `INSERT INTO device_control (deviceId, desiredTemp, mode, power) 
         VALUES (?, 25.0, 'auto', 'on')`,
        [deviceId]
      );
      
      return res.json({
        desiredTemp: 25.0,
        mode: 'auto',
        power: 'on'
      });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch control settings' });
  }
});

// PUT /api/devices/control - Update device control settings
app.put('/api/devices/control', async (req, res) => {
  try {
    const { deviceId, desiredTemp, mode, power } = req.body;
    
    // Update or insert device control settings
    const [result] = await db.query(
      `INSERT INTO device_control (deviceId, desiredTemp, mode, power) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
         desiredTemp = VALUES(desiredTemp),
         mode = VALUES(mode),
         power = VALUES(power)`,
      [deviceId, desiredTemp, mode, power]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// GET /api/devices/data - Frontend fetches device data
app.get('/api/devices/data', async (req, res) => {
  try {
    const { deviceId } = req.query;
    
    // Get latest sensor data
    const [sensorData] = await db.query(
      `SELECT temperature, humidity, state, desiredTemp 
       FROM sensor_data 
       WHERE deviceId = ? 
       ORDER BY timestamp DESC LIMIT 1`,
      [deviceId]
    );
    
    // Get control settings
    const [controlSettings] = await db.query(
      `SELECT desiredTemp, mode, power 
       FROM device_control 
       WHERE deviceId = ?`,
      [deviceId]
    );
    
    res.json({
      sensorData: sensorData[0] || null,
      controlSettings: controlSettings[0] || null
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch device data' });
  }
});

// GET /api/devices/history - Frontend fetches historical data
app.get('/api/devices/history', async (req, res) => {
  try {
    const { deviceId, period = 'daily' } = req.query;
    let query;
    
    switch (period) {
      case 'weekly':
        query = `
          SELECT DATE_FORMAT(timestamp, '%Y-%u') AS label,
                 AVG(temperature) AS temperature,
                 AVG(humidity) AS humidity
          FROM sensor_data
          WHERE deviceId = ?
          GROUP BY label
          ORDER BY label DESC LIMIT 10`;
        break;
      case 'monthly':
        query = `
          SELECT DATE_FORMAT(timestamp, '%Y-%m') AS label,
                 AVG(temperature) AS temperature,
                 AVG(humidity) AS humidity
          FROM sensor_data
          WHERE deviceId = ?
          GROUP BY label
          ORDER BY label DESC LIMIT 12`;
        break;
      case 'daily':
      default:
        query = `
          SELECT DATE_FORMAT(timestamp, '%Y-%m-%d %H:00') AS label,
                 AVG(temperature) AS temperature,
                 AVG(humidity) AS humidity
          FROM sensor_data
          WHERE deviceId = ? AND DATE(timestamp) = CURDATE()
          GROUP BY label
          ORDER BY label ASC`;
    }
    
    const [rows] = await db.query(query, [deviceId]);
    res.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// Start server
app.listen(PORT, async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ Connected to MySQL Database successfully');
    connection.release();
    console.log(`✅ Server running on port ${PORT}`);
  } catch (error) {
    console.error('❌ Failed to connect to MySQL Database:', error.message);
  }
});