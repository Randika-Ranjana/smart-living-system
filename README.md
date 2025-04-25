# 🔥 Smart Heating System

This is a home central heating control system using:
- 🌐 A React web app (frontend)
- 🧠 A Node.js + Express backend
- 📡 ESP32 + Arduino (sends room temperature)
- ☁️ Firebase Firestore for storage

---

## 📂 Project Structure

- `/frontend`: React app that displays current temperature, allows users to set a desired temp, and shows historic graphs.
- `/backend`: Express API that communicates with Firebase and serves data to frontend and ESP32.
- `/arduino`: Arduino sketch for ESP32 that reads DHT22 sensor data and controls LED based on temperature.

---

## 🚀 How to Run Locally

### 1. Backend
```bash
cd backend
npm install
node index.js
