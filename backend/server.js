const app = require('./app');
const config = require('./config/config');
const pool = require('./config/database');
const logger = require('./utils/logger');

async function startServer() {
    try {
        // Verify database connection
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        logger.info('✅ Database connection established');

        // Start server
        const server = app.listen(config.PORT, () => {
            logger.info(`🚀 Server running on port ${config.PORT}`);
            logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🛡️ CORS allowed origins: ${config.FRONTEND_URL.join(', ')}`);
        });

        // Handle shutdown gracefully
        const shutdown = async (signal) => {
            logger.warn(`Received ${signal}, shutting down gracefully...`);
            server.close(async () => {
                await pool.end();
                logger.info('Database connection pool closed');
                process.exit(0);
            });
        };

        // Process event handlers
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Error handlers
        process.on('unhandledRejection', (err) => {
            logger.error('Unhandled Rejection:', { 
                error: err.message,
                stack: err.stack 
            });
            server.close(() => process.exit(1));
        });

        process.on('uncaughtException', (err) => {
            logger.error('Uncaught Exception:', {
                error: err.message,
                stack: err.stack
            });
            server.close(() => process.exit(1));
        });

    } catch (err) {
        logger.error('❌ Server startup failed:', {
            error: err.message,
            stack: err.stack
        });
        process.exit(1);
    }
}

// Start the server
startServer();