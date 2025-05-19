const pool = require('../config/database');
const logger = require('../utils/logger');

exports.submitContactForm = async (req, res, next) => {
    try {
        const { name, email, message } = req.body;

        // Validation
        if (!name || !email || !message) {
            return res.status(400).json({ 
                success: false, 
                error: "All fields are required" 
            });
        }

        // Email validation
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: "Please enter a valid email address"
            });
        }

        // Save to database
        await pool.query(
            'INSERT INTO contactus (name, email, message) VALUES (?, ?, ?)',
            [name, email, message]
        );

        logger.info(`New contact form submission from ${name} <${email}>`);

        res.status(200).json({
            success: true,
            message: "Thank you for your message! We'll be in touch soon."
        });

    } catch (err) {
        logger.error('Contact form error:', { error: err.message, stack: err.stack });
        next(err);
    }
};