import { getDatabaseInstance } from "../database.js";

const lastSubmissionTimes = new Map();
const deviceSettingsCache = new Map();

export function handleDataRoutes(app) {
  const db = getDatabaseInstance();

  // POST /esp32-data - For ESP32 to submit sensor data
  app.post("/esp32-data", async (req, res) => {
    const { deviceId, temperature, humidity, state, desiredTemp } = req.body;
    const now = Date.now();

    if (!deviceId || typeof temperature !== "number" || typeof humidity !== "number") {
      return res.status(400).json({ error: "Invalid sensor data" });
    }

    const lastTime = lastSubmissionTimes.get(deviceId) || 0;
    if (now - lastTime < 30000) {
      return res.status(429).json({
        error: "Too frequent",
        message: "Data can only be submitted every 30 seconds"
      });
    }

    try {
      const [result] = await db.query(
        `INSERT INTO esp32_readings 
        (deviceId, temperature, humidity, state, desiredTemp, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          parseFloat(temperature.toFixed(2)),
          parseFloat(humidity.toFixed(2)),
          state || 0,
          desiredTemp || 25.0,
          new Date(now)
        ]
      );

      lastSubmissionTimes.set(deviceId, now);

      res.status(201).json({
        success: true,
        documentId: result.insertId,
        nextSubmission: new Date(now + 30000).toISOString()
      });
    } catch (err) {
      console.error("ESP32 data submission error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // GET /esp32-data - For frontend to get historical data
  app.get("/esp32-data", async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT 
          id, 
          deviceId, 
          temperature, 
          humidity, 
          state, 
          desiredTemp, 
          UNIX_TIMESTAMP(timestamp) * 1000 as timestamp 
        FROM esp32_readings 
        ORDER BY timestamp DESC 
        LIMIT 100`
      );

      res.status(200).json(rows);
    } catch (err) {
      console.error("Error fetching ESP32 data:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // POST /device-control - For frontend to control devices
  app.post("/device-control", async (req, res) => {
    const { deviceId, mode, desiredTemp, power } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID is required" });
    }

    // Validate inputs
    if (mode && !["auto", "manual"].includes(mode)) {
      return res.status(400).json({ error: "Invalid mode" });
    }
    if (power && !["on", "off"].includes(power)) {
      return res.status(400).json({ error: "Invalid power value" });
    }
    if (desiredTemp && (isNaN(desiredTemp) || desiredTemp < 10 || desiredTemp > 35)) {
      return res.status(400).json({ error: "Invalid temperature range (10-35)" });
    }

    try {
      const settings = {
        mode: mode || "auto",
        desiredTemp: desiredTemp !== undefined ? parseFloat(desiredTemp) : 25.0,
        power: power || "on",
        lastUpdated: new Date()
      };

      // Update cache
      deviceSettingsCache.set(deviceId, settings);

      // Update MySQL
      await db.query(
        `INSERT INTO device_settings 
        (deviceId, mode, desiredTemp, power, lastUpdated) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          mode = VALUES(mode),
          desiredTemp = VALUES(desiredTemp),
          power = VALUES(power),
          lastUpdated = VALUES(lastUpdated)`,
        [
          deviceId,
          settings.mode,
          settings.desiredTemp,
          settings.power,
          settings.lastUpdated
        ]
      );

      res.status(200).json({
        success: true,
        message: "Device control updated",
        settings
      });
    } catch (err) {
      console.error("Device control error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // GET /device-control - For ESP32 to check its settings
  app.get("/device-control", async (req, res) => {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID is required" });
    }

    try {
      // Check cache first
      if (deviceSettingsCache.has(deviceId)) {
        return res.status(200).json(deviceSettingsCache.get(deviceId));
      }

      // Fallback to MySQL
      const [rows] = await db.query(
        `SELECT 
          mode, 
          desiredTemp, 
          power, 
          lastUpdated 
        FROM device_settings 
        WHERE deviceId = ?`,
        [deviceId]
      );

      if (rows.length > 0) {
        const data = rows[0];
        deviceSettingsCache.set(deviceId, data); // Cache it
        return res.status(200).json(data);
      }

      // Return default settings if none exist
      const defaultSettings = {
        mode: "auto",
        desiredTemp: 25.0,
        power: "on"
      };
      deviceSettingsCache.set(deviceId, defaultSettings);
      res.status(200).json(defaultSettings);
    } catch (err) {
      console.error("Device control fetch error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // GET /device-status - For frontend to get current device status
  app.get("/device-status", async (req, res) => {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID is required" });
    }

    try {
      // Get latest reading
      const [readings] = await db.query(
        `SELECT 
          temperature, 
          humidity, 
          UNIX_TIMESTAMP(timestamp) * 1000 as timestamp 
        FROM esp32_readings 
        WHERE deviceId = ? 
        ORDER BY timestamp DESC 
        LIMIT 1`,
        [deviceId]
      );

      if (readings.length === 0) {
        return res.status(404).json({ error: "No device data found" });
      }

      const latestData = readings[0];
      
      // Get current settings
      let settings;
      if (deviceSettingsCache.has(deviceId)) {
        settings = deviceSettingsCache.get(deviceId);
      } else {
        const [settingsRows] = await db.query(
          `SELECT 
            mode, 
            desiredTemp, 
            power 
          FROM device_settings 
          WHERE deviceId = ?`,
          [deviceId]
        );
        settings = settingsRows.length > 0 ? settingsRows[0] : {
          mode: "auto",
          desiredTemp: 25.0,
          power: "on"
        };
      }

      res.status(200).json({
        deviceId,
        currentTemp: latestData.temperature,
        currentHumidity: latestData.humidity,
        lastUpdate: latestData.timestamp,
        ...settings
      });
    } catch (err) {
      console.error("Device status error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });
}