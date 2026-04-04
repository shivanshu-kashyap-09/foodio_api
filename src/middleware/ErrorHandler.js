/**
 * FOODIO API - Error Handler Middleware
 * Centralized error handling for all routes
 */

const Logger = require('../utils/Logger');
const ResponseFormatter = require('../utils/ResponseFormatter');

const logger = new Logger('ErrorHandler');

/**
 * Error handler middleware
 * Must be placed last in middleware stack
 */
const errorHandler = (err, req, res, next) => {
    // Default error properties
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || null;

    // Log the error
    logger.error(`${req.method} ${req.path}`, {
        statusCode,
        message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
        errors = Object.values(err.errors).map(e => e.message);
    } else if (err.name === 'MulterError') {
        if (err.code === 'FILE_TOO_LARGE') {
            statusCode = 413;
            message = 'File too large';
        } else {
            statusCode = 400;
            message = 'File upload error';
        }
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    } else if (err.code === 'ECONNREFUSED') {
        statusCode = 503;
        message = 'Service temporarily unavailable';
    } else if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 409;
        message = 'Record already exists';
    }

    // Send error response
    return ResponseFormatter.error(res, statusCode, message, errors);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not Found handler middleware
 */
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Route not found: ${req.method} ${req.path}`);
    error.statusCode = 404;
    next(error);
};

module.exports = {
    errorHandler,
    asyncHandler,
    notFoundHandler,
};
