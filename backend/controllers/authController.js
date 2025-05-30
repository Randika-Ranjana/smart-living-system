const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const config = require('../config/config');
const AppError = require('../utils/appError');

exports.register = async (req, res, next) => {
    try {
        const { fullname, email, password, address, deviceIds } = req.body;
        
        if (!fullname || !email || !password) {
            return next(new AppError('Please provide fullname, email and password', 400));
        }

        const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return next(new AppError('Email already in use', 400));
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await pool.query(
            'INSERT INTO users (fullname, email, password, street, city, postal_code, state, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [fullname, email, hashedPassword, address?.street, address?.city, address?.postalCode, address?.state, address?.country]
        );
        
        const userId = result.insertId;
        
        if (deviceIds && deviceIds.length > 0) {
            for (const deviceId of deviceIds) {
                await pool.query(
                    `INSERT INTO device_control 
                    (deviceId, desiredTemp, mode, power, updatedAt) 
                    VALUES (?, 25.0, "auto", "on", CURRENT_TIMESTAMP) 
                    ON DUPLICATE KEY UPDATE 
                    deviceId = VALUES(deviceId)`,
                    [deviceId]
                );
                
                await pool.query(
                    'INSERT INTO user_devices (user_id, device_id) VALUES (?, ?)',
                    [userId, deviceId]
                );
            }
        }
        
        const token = jwt.sign({ id: userId, email }, config.JWT_SECRET, {
            expiresIn: config.JWT_EXPIRES_IN
        });
        
        res.status(201).json({
            status: 'success',
            token,
            data: {
                userId,
                email
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return next(new AppError('Please provide email and password', 400));
        }
        
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return next(new AppError('Invalid email or password', 401));
        }
        
        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return next(new AppError('Invalid email or password', 401));
        }
        
        const token = jwt.sign({ id: user.id, email: user.email }, config.JWT_SECRET, {
            expiresIn: config.JWT_EXPIRES_IN
        });
        
        res.status(200).json({
            status: 'success',
            token,
            data: {
                userId: user.id,
                email: user.email
            }
        });
    } catch (error) {
        next(error);
    }
};