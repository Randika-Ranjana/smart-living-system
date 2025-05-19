class AppError extends Error {
    constructor(message, statusCode, details = null) {
        super(message);
        
        // Required properties
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        
        // Additional debugging information
        this.details = details;
        this.timestamp = new Date().toISOString();
        
        // Capture stack trace (excluding constructor call)
        Error.captureStackTrace(this, this.constructor);
        
        // Log the error immediately (optional)
        if (process.env.NODE_ENV === 'development') {
            console.error(`[AppError] ${this.timestamp}:`, {
                message,
                statusCode,
                details,
                stack: this.stack
            });
        }
    }
    
    // Optional: Add serialization method for API responses
    toJSON() {
        return {
            status: this.status,
            statusCode: this.statusCode,
            message: this.message,
            ...(this.details && { details: this.details }),
            ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
        };
    }
}

module.exports = AppError;