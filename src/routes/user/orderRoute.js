/**
 * @file orderRoute.js
 * @description Order management routes - create, retrieve, update orders
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeAdmin } = require('../../middleware/Auth');
const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const OrderService = require('../../services/OrderService');
const Logger = require('../../utils/Logger');

const logger = new Logger('OrderRoute');

/**
 * POST /api/user/:userId/orders
 * @description Create a new order
 * @param {string} userId - User ID
 * @body {Object} order - Order details
 * @body {number} order.restaurantId - Restaurant ID
 * @body {string} order.restaurantType - Restaurant type (veg, nonveg, southindian)
 * @body {Array} order.items - Array of {itemId, quantity, price}
 * @body {number} order.totalAmount - Total order amount
 * @body {string} order.deliveryAddress - Delivery address
 * @body {string} order.phone - Contact phone
 * @body {string} order.paymentMethod - Payment method (card, upi, cash)
 * @returns {Object} Created order details
 * @access Private
 * @requires authenticateToken middleware
 */
router.post('/:userId/orders', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { restaurantId, restaurantType, items, totalAmount, deliveryAddress, phone, paymentMethod } = req.body;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized order creation attempt', { userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        errors.push('User ID must be a positive number');
    }
    if (!Validator.isPositiveNumber(restaurantId)) {
        errors.push('Restaurant ID must be a positive number');
    }
    if (!restaurantType || !['veg', 'nonveg', 'southindian'].includes(restaurantType.toLowerCase())) {
        errors.push('Restaurant type must be one of: veg, nonveg, southindian');
    }
    if (!Array.isArray(items) || items.length === 0) {
        errors.push('Items array is required and must not be empty');
    }
    if (!Validator.isPositiveNumber(totalAmount)) {
        errors.push('Total amount must be a positive number');
    }
    if (!deliveryAddress || !Validator.sanitizeString(deliveryAddress)) {
        errors.push('Valid delivery address is required');
    }
    if (!Validator.isValidPhone(phone)) {
        errors.push('Valid phone number is required (10+ digits)');
    }
    if (!paymentMethod || !['card', 'upi', 'cash', 'wallet'].includes(paymentMethod.toLowerCase())) {
        errors.push('Payment method must be one of: card, upi, cash, wallet');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const orderData = {
            restaurantId: parseInt(restaurantId),
            restaurantType: restaurantType.toLowerCase(),
            items,
            totalAmount: parseFloat(totalAmount),
            deliveryAddress: Validator.sanitizeString(deliveryAddress),
            phone,
            paymentMethod: paymentMethod.toLowerCase()
        };

        const order = await OrderService.createOrder(parseInt(userId), orderData);
        logger.info('Order created successfully', { userId, orderId: order.id, totalAmount });

        return ResponseFormatter.success(res, 201, 'Order created successfully', order);
    } catch (error) {
        logger.error('Error creating order', { userId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/user/:userId/orders
 * @description Get user's orders
 * @param {string} userId - User ID
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 * @returns {Array} List of user's orders with pagination
 * @access Private
 * @requires authenticateToken middleware
 */
router.get('/:userId/orders', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized orders list access attempt', { userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        errors.push('User ID must be a positive number');
    }

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        errors.push(...paginationErrors);
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await OrderService.getUserOrders(
            parseInt(userId),
            parseInt(page),
            parseInt(limit)
        );
        logger.info('User orders retrieved', { userId, page, limit, count: result.orders.length });

        return ResponseFormatter.paginated(
            res, 200, 'Orders retrieved successfully',
            result.orders, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving user orders', { userId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/orders/:orderId
 * @description Get order details with restaurant and dish information
 * @param {string} orderId - Order ID
 * @returns {Object} Order details with restaurant and dishes
 * @access Private
 * @requires authenticateToken middleware
 */
router.get('/details/:orderId', authenticateToken, asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    // Validate orderId
    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        return ResponseFormatter.error(res, 400, 'Invalid order ID', ['Order ID must be a positive number']);
    }

    try {
        const order = await OrderService.getOrderDetails(parseInt(orderId));

        if (!order) {
            return ResponseFormatter.error(res, 404, 'Order not found');
        }

        // Authorization check - user can only see their own orders (unless admin)
        if (req.user.id !== order.user_id && req.user.role !== 'admin') {
            logger.warn('Unauthorized order details access', { orderId, userId: req.user.id });
            return ResponseFormatter.error(res, 403, 'Unauthorized access');
        }

        logger.info('Order details retrieved', { orderId, userId: order.user_id });
        return ResponseFormatter.success(res, 200, 'Order retrieved successfully', order);
    } catch (error) {
        logger.error('Error retrieving order details', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/orders/:orderId/status
 * @description Update order status (admin only)
 * @param {string} orderId - Order ID
 * @body {string} status - New status (pending, confirmed, preparing, ready, delivered, cancelled)
 * @returns {Object} Updated order
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.put('/admin/:orderId/status', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        errors.push('Order ID must be a positive number');
    }
    if (!status || !['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'].includes(status.toLowerCase())) {
        errors.push('Status must be one of: pending, confirmed, preparing, ready, delivered, cancelled');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const order = await OrderService.updateOrderStatus(parseInt(orderId), status.toLowerCase());
        logger.info('Order status updated', { orderId, status: status.toLowerCase(), updatedBy: req.user.id });

        return ResponseFormatter.success(res, 200, 'Order status updated successfully', order);
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Order not found');
        }
        if (error.message.includes('cannot transition')) {
            return ResponseFormatter.error(res, 400, error.message);
        }
        logger.error('Error updating order status', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/user/:userId/orders/:orderId/cancel
 * @description Cancel a pending order
 * @param {string} userId - User ID
 * @param {string} orderId - Order ID to cancel
 * @returns {Object} Cancelled order
 * @access Private
 * @requires authenticateToken middleware
 */
router.put('/:userId/orders/:orderId/cancel', authenticateToken, asyncHandler(async (req, res) => {
    const { userId, orderId } = req.params;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized order cancellation attempt', { orderId, userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        errors.push('User ID must be a positive number');
    }
    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        errors.push('Order ID must be a positive number');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const order = await OrderService.cancelOrder(parseInt(orderId), parseInt(userId));
        logger.info('Order cancelled', { orderId, userId });

        return ResponseFormatter.success(res, 200, 'Order cancelled successfully', order);
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Order not found');
        }
        if (error.message.includes('cannot cancel')) {
            return ResponseFormatter.error(res, 400, error.message);
        }
        logger.error('Error cancelling order', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/admin/orders
 * @description Get all orders (admin only)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @query {string} status - Filter by status (optional)
 * @returns {Array} List of all orders with pagination
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.get('/admin/all', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    // Validate inputs
    const errors = [];

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        errors.push(...paginationErrors);
    }

    if (status && !['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'].includes(status.toLowerCase())) {
        errors.push('Invalid status filter');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await OrderService.getAllOrders(
            parseInt(page),
            parseInt(limit),
            status ? status.toLowerCase() : null
        );
        logger.info('All orders retrieved', { page, limit, status, count: result.orders.length });

        return ResponseFormatter.paginated(
            res, 200, 'Orders retrieved successfully',
            result.orders, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving all orders', { error: error.message });
        throw error;
    }
}));

module.exports = router;
