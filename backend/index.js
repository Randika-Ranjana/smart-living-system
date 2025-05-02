import express from "express";
import bodyParser from "body-parser";
import { initializeFirebase } from "./firebase.js";
import { handleDataRoutes } from "./routes/dataRoutes.js";

const app = express();
const PORT = 4000;

app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Smart Heating System API",
    endpoints: {
      storeData: "POST /temp-data",
      getReadings: "GET /readings",
      desiredTemp: {
        get: "GET /desired-temp",
        set: "POST /desired-temp"
      },
      esp32: {
        submit: "POST /esp32-data",
        getReadings: "GET /esp32-data"
      }
    },
    status: "operational"
  });
});

// 🚀 Initialize Firebase and start server after successful init
initializeFirebase()
  .then(() => {
    handleDataRoutes(app);

    // 404 Handler
    app.use((req, res) => {
      res.status(404).json({ 
        error: "Endpoint not found",
        availableEndpoints: [
          "GET /",
          "POST /temp-data",
          "GET /readings",
          "GET /desired-temp",
          "POST /desired-temp",
          "POST /esp32-data",
          "GET /esp32-data"
        ]
      });
    });

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("🔥 Firebase initialization failed:", err);
    process.exit(1);
  });
