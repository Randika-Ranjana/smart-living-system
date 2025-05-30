const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const config = require('../config/config');
const pool = require('../config/database');

exports.protect = async (req, res, next) => {
    try {
        let token;
        
        // Get token from headers
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        
        if (!token) {
            return next(new AppError('You are not logged in! Please log in to get access.', 401));
        }
        
        // Verify token
        const decoded = jwt.verify(token, config.JWT_SECRET);
        
        // Check if user still exists
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0) {
            return next(new AppError('The user belonging to this token no longer exists.', 401));
        }
        
        req.user = users[0];
        next();
    } catch (error) {
        next(error);
    }
};