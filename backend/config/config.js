// config.js
module.exports = {
    PORT: process.env.PORT || 4000,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
    TOMORROW_API_KEY: process.env.TOMORROW_API_KEY,
    FRONTEND_URL: process.env.FRONTEND_URL 
        ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
        : ['http://localhost:5500', 'http://127.0.0.1:5500']
};