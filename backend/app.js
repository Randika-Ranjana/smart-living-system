require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./config/config');
const logger = require('./utils/logger');
const pool = require('./config/database');

// Import routes
const weatherRoutes = require('./routes/weatherRoutes');
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const publicDataRoutes = require('./routes/publicDataRoutes');
const deviceRoutes = require('./routes/deviceRoutes');

// Import middleware
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

// ========== MIDDLEWARE ========== //
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Development environment exception
    if (process.env.NODE_ENV === 'development' && !origin) {
      logger.debug('Allowing request without origin in development');
      return callback(null, true);
    }

    // Allow requests with no origin (mobile apps, server-to-server)
    if (!origin) {
      logger.warn('Allowing request with no origin');
      return callback(null, true);
    }

    // Normalize origin for comparison
    const normalizedOrigin = origin.endsWith('/') 
      ? origin.slice(0, -1) 
      : origin;

    // Check against allowed origins
    const allowedOrigin = config.FRONTEND_URL.some(allowedUrl => {
      const normalizedAllowed = allowedUrl.endsWith('/')
        ? allowedUrl.slice(0, -1)
        : allowedUrl;
      return normalizedOrigin === normalizedAllowed;
    });

    if (allowedOrigin) {
      logger.debug(`Allowed origin: ${origin}`);
      return callback(null, true);
    }

    logger.warn(`Blocked origin: ${origin}`);
    callback(new Error(`Origin '${origin}' not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Forwarded-For',
    'X-Access-Token'
  ],
  exposedHeaders: [
    'Content-Length',
    'X-Request-ID'
  ],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Custom CORS error handler
app.use((err, req, res, next) => {
  if (err.message.includes('CORS')) {
    logger.warn(`CORS error: ${err.message}`);
    return res.status(403).json({
      status: 'error',
      message: err.message,
      allowedOrigins: config.FRONTEND_URL
    });
  }
  next(err);
});

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      status: 'error',
      message: 'Too many requests from this IP, please try again later'
    });
  }
});

// Device data specific rate limiting
const deviceDataLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each device to 10 requests per minute
  keyGenerator: (req) => req.body.deviceId || req.ip,
  handler: (req, res) => {
    logger.warn(`Device data rate limit exceeded for: ${req.body.deviceId || req.ip}`);
    res.status(429).json({ error: 'Too many requests' });
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Logging
app.use((req, res, next) => {
  logger.http(`Incoming ${req.method} ${req.originalUrl}`);
  next();
});

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ========== ROUTES ========== //

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// Unauthenticated device data endpoint
app.post('/device-data', express.json(), deviceDataLimiter, async (req, res) => {
  try {
    const { deviceId, temperature, humidity, state, desiredTemp } = req.body;

    // Basic validation
    if (!deviceId) {
      logger.warn('Device data missing deviceId', { ip: req.ip });
      return res.status(400).json({ error: 'Device ID is required' });
    }

    logger.info(`Device data received from ${deviceId}`, {
      temperature,
      humidity,
      state,
      desiredTemp,
      ip: req.ip
    });

    // Insert or update device control
    await pool.query(
      `INSERT INTO device_control 
      (deviceId, desiredTemp, mode, power) 
      VALUES (?, ?, 'auto', 'on')
      ON DUPLICATE KEY UPDATE 
      desiredTemp = VALUES(desiredTemp),
      updatedAt = CURRENT_TIMESTAMP`,
      [deviceId, desiredTemp || 25.0] // Default temp if not provided
    );

    res.status(201).json({ 
      status: 'success',
      deviceId,
      timestamp: new Date().toISOString() 
    });

  } catch (err) {
    logger.error('Device data processing error:', {
      error: err.message,
      stack: err.stack,
      deviceId: req.body.deviceId
    });
    res.status(500).json({ error: 'Failed to process device data' });
  }
});

// API routes (protected)
app.use('/api/auth', authRoutes);
app.use('/api/contact', apiLimiter, contactRoutes);
app.use('/api/public-data', publicDataRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/weather', weatherRoutes);

// ========== ERROR HANDLING ========== //

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 Not Found: ${req.originalUrl}`);
  res.status(404).json({
    status: 'fail',
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Central error handler
app.use(errorHandler);

// Log all registered routes in development
if (process.env.NODE_ENV === 'development') {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: middleware.regexp.source.replace('^\\', '').replace('\\/?(?=\\/|$)', '') + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  logger.debug('Registered routes:', { routes });
}

module.exports = app;