import { getFirestoreInstance } from "../firebase.js";

const lastSubmissionTimes = new Map();

export function handleDataRoutes(app) {
  const db = getFirestoreInstance();

  // POST /esp32-data
  app.post("/esp32-data", async (req, res) => {
    const { deviceId, temperature, humidity } = req.body;
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
      const docRef = await db.collection("esp32_readings").add({
        deviceId,
        temperature: parseFloat(temperature.toFixed(2)),
        humidity: parseFloat(humidity.toFixed(2)),
        timestamp: new Date(now)
      });

      lastSubmissionTimes.set(deviceId, now);

      res.status(201).json({
        success: true,
        documentId: docRef.id,
        nextSubmission: new Date(now + 30000).toISOString()
      });
    } catch (err) {
      console.error("ESP32 data submission error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // GET /esp32-data
  app.get("/esp32-data", async (req, res) => {
    try {
      const snapshot = await db.collection("esp32_readings")
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();

      const readings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate().getTime()
      }));

      res.status(200).json(readings);
    } catch (err) {
      console.error("Error fetching ESP32 data:", err);
      res.status(500).json({ error: "Database error" });
    }
  });
}
