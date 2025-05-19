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

// Import routes
const weatherRoutes = require('./routes/weatherRoutes');
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const publicDataRoutes = require('./routes/publicDataRoutes');
const deviceRoutes = require('./routes/deviceRoutes');


// Import controllers
const { handleESP32Data } = require('./controllers/esp32Controller');

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

// Rate limiting
const limiter = rateLimit({
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
app.use('/api', limiter);

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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/public-data', publicDataRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/weather', weatherRoutes);

// ESP32 data endpoint
app.post('/esp32-data', handleESP32Data);

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

// Log all registered routes
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