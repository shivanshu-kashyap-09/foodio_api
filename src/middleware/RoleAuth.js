const jwt = require('jsonwebtoken');
const config = require('../config/config');

const adminOnly = (req, res, next) => {
    // req.user is already populated by the main auth middleware
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Authentication required'
        });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Admin access required'
        });
    }

    next();
};

const restaurantOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Authentication required'
        });
    }

    if (req.user.role !== 'restaurant' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Restaurant access required'
        });
    }

    next();
};

const deliveryOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Authentication required'
        });
    }

    if (req.user.role !== 'delivery' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Delivery partner access required'
        });
    }

    next();
};

module.exports = {
    adminOnly,
    restaurantOnly,
    deliveryOnly
};
