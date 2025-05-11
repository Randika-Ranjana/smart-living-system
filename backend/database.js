import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool;

export async function initializeDatabase() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    // Initialize tables if they don't exist
    await initializeTables();
    
    console.log('MySQL database initialized successfully');
    return pool;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

async function initializeTables() {
  const createTables = [
    `CREATE TABLE IF NOT EXISTS esp32_readings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deviceId VARCHAR(255) NOT NULL,
      temperature DECIMAL(5,2) NOT NULL,
      humidity DECIMAL(5,2) NOT NULL,
      state TINYINT DEFAULT 0,
      desiredTemp DECIMAL(5,2) DEFAULT 25.0,
      timestamp DATETIME NOT NULL,
      INDEX (deviceId),
      INDEX (timestamp)
    )`,
    `CREATE TABLE IF NOT EXISTS device_settings (
      deviceId VARCHAR(255) PRIMARY KEY,
      mode ENUM('auto', 'manual') NOT NULL DEFAULT 'auto',
      desiredTemp DECIMAL(5,2) NOT NULL DEFAULT 25.0,
      power ENUM('on', 'off') NOT NULL DEFAULT 'on',
      lastUpdated DATETIME NOT NULL
    )`
  ];

  const connection = await pool.getConnection();
  try {
    for (const query of createTables) {
      await connection.query(query);
    }
  } finally {
    connection.release();
  }
}

export function getDatabaseInstance() {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}