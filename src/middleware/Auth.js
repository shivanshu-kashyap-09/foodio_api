/**
 * FOODIO API - Authentication Middleware
 * JWT token verification and user authentication
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const Logger = require('../utils/Logger');
const ResponseFormatter = require('../utils/ResponseFormatter');

const logger = new Logger('AuthMiddleware');

/**
 * Verify JWT token and authenticate user
 */
const authenticateToken = (req, res, next) => {
    try {
        // Get token from Authorization header, or fall back to ?token= query param (needed for SSE EventSource)
        const authHeader = req.headers['authorization'];
        const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

        if (!token) {
            logger.warn('No token provided', { path: req.path, ip: req.ip });
            return ResponseFormatter.error(res, 401, 'Access token required');
        }

        // Verify token
        jwt.verify(token, config.jwt.secret, (err, user) => {
            if (err) {
                logger.warn('Token verification failed', { 
                    error: err.message, 
                    path: req.path, 
                    ip: req.ip 
                });
                return ResponseFormatter.error(res, 403, 'Invalid or expired token');
            }

            // Attach user to request
            req.user = user;
            next();
        });
    } catch (error) {
        logger.error('Authentication middleware error', { error: error.message });
        return ResponseFormatter.error(res, 500, 'Authentication error');
    }
};

/**
 * Verify admin role
 */
const authorizeAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return ResponseFormatter.error(res, 401, 'Authentication required');
        }

        if (req.user.role !== 'admin') {
            logger.warn('Unauthorized admin access attempt', { 
                userId: req.user.id, 
                path: req.path, 
                ip: req.ip 
            });
            return ResponseFormatter.error(res, 403, 'Admin access required');
        }

        next();
    } catch (error) {
        logger.error('Authorization middleware error', { error: error.message });
        return ResponseFormatter.error(res, 500, 'Authorization error');
    }
};

/**
 * Verify user role
 */
const authorizeUser = (req, res, next) => {
    try {
        if (!req.user) {
            return ResponseFormatter.error(res, 401, 'Authentication required');
        }

        // Check if it's the user's own resource or admin
        if (req.user.id !== parseInt(req.params.userId, 10) && req.user.role !== 'admin') {
            logger.warn('Unauthorized user access attempt', { 
                userId: req.user.id, 
                targetUserId: req.params.userId, 
                path: req.path, 
                ip: req.ip 
            });
            return ResponseFormatter.error(res, 403, 'Access denied');
        }

        next();
    } catch (error) {
        logger.error('User authorization middleware error', { error: error.message });
        return ResponseFormatter.error(res, 500, 'Authorization error');
    }
};

/**
 * Optional authentication - doesn't fail if token is missing
 */
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            jwt.verify(token, config.jwt.secret, (err, user) => {
                if (!err) {
                    req.user = user;
                }
            });
        }

        next();
    } catch (error) {
        logger.error('Optional auth middleware error', { error: error.message });
        next(); // Continue without authentication
    }
};

// For backward compatibility
const authMiddleware = authenticateToken;

module.exports = {
    authenticateToken,
    authMiddleware, // Backward compatibility
    authorizeAdmin,
    authorizeUser,
    optionalAuth,
};