const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

// Custom format with colors and stack traces
const logFormat = printf(({ level, message, timestamp, stack }) => {
    const logMessage = `[${timestamp}] ${level}: ${message}`;
    return stack ? `${logMessage}\n${stack}` : logMessage;
});

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }), // Captures stack traces
        colorize(), // Adds colors to console output
        logFormat
    ),
    transports: [
        new transports.Console(),
        // Add file transport in production
        ...(process.env.NODE_ENV === 'production' ? [
            new transports.File({ 
                filename: 'logs/combined.log',
                format: combine(
                    timestamp(),
                    format.json() // JSON format for files
                )
            }),
            new transports.File({
                filename: 'logs/errors.log',
                level: 'error'
            })
        ] : [])
    ],
    exceptionHandlers: [
        new transports.File({ filename: 'logs/exceptions.log' })
    ]
});

// Handle uncaught exceptions
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
});

module.exports = logger;