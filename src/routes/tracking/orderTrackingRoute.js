/**
 * @file orderTrackingRoute.js
 * @description Advanced order tracking routes with real-time updates
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../../middleware/Auth');
const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const OrderTrackingService = require('../../services/OrderTrackingService');
const OrderNotificationService = require('../../services/OrderNotificationService');
const OrderAnalyticsService = require('../../services/OrderAnalyticsService');
const Logger = require('../../utils/Logger');

const logger = new Logger('OrderTrackingRoute');

/**
 * GET /api/orders/:orderId/tracking
 * @description Get real-time order tracking status
 * @access Private
 */
router.get('/:orderId/tracking', authenticateToken, asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        return ResponseFormatter.error(res, 400, 'Invalid order ID');
    }

    try {
        const trackingData = await OrderTrackingService.getOrderTrackingStatus(
            parseInt(orderId),
            req.user.id
        );

        if (!trackingData) {
            return ResponseFormatter.error(res, 404, 'Order not found');
        }

        logger.info('Order tracking retrieved', { orderId, userId: req.user.id });
        return ResponseFormatter.success(res, 200, 'Tracking data retrieved', trackingData);
    } catch (error) {
        if (error.message.includes('Unauthorized')) {
            return ResponseFormatter.error(res, 403, 'Unauthorized access');
        }
        logger.error('Error retrieving tracking', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/orders/:orderId/tracking/history
 * @description Get order status history
 * @access Private
 */
router.get('/:orderId/tracking/history', authenticateToken, asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        return ResponseFormatter.error(res, 400, 'Invalid order ID');
    }

    try {
        const history = await OrderTrackingService._getOrderStatusHistory(
            parseInt(orderId),
            req.user.id
        );

        if (!history) {
            return ResponseFormatter.error(res, 404, 'Order not found');
        }

        logger.info('Status history retrieved', { orderId });
        return ResponseFormatter.success(res, 200, 'Status history retrieved', history);
    } catch (error) {
        logger.error('Error retrieving status history', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/orders/:orderId/tracking/delivery
 * @description Get delivery tracking with real-time location
 * @access Private
 */
router.get('/:orderId/tracking/delivery', authenticateToken, asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        return ResponseFormatter.error(res, 400, 'Invalid order ID');
    }

    try {
        const deliveryHistory = await OrderTrackingService.getDeliveryTrackingHistory(
            parseInt(orderId)
        );

        logger.info('Delivery tracking retrieved', { orderId });

        return ResponseFormatter.success(
            res, 200,
            'Delivery tracking retrieved',
            { locations: deliveryHistory }
        );
    } catch (error) {
        logger.error('Error retrieving delivery tracking', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/orders/:orderId/tracking/status
 * @description Update order status with tracking (Admin/System)
 * @access Private (Admin)
 */
router.put('/:orderId/tracking/status', authenticateToken, asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status, reason = '' } = req.body;

    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        return ResponseFormatter.error(res, 400, 'Invalid order ID');
    }

    if (!status || !['pending', 'confirmed', 'preparing', 'ready', 'picked', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'].includes(status)) {
        return ResponseFormatter.error(res, 400, 'Invalid status');
    }

    try {
        const result = await OrderTrackingService.updateOrderStatusWithTracking(
            parseInt(orderId),
            status,
            {
                userId: req.user.id,
                changeType: req.user.role === 'admin' ? 'admin' : 'user',
                reason,
            }
        );

        // Send notifications
        const order = await require('../../services/OrderService').getOrderDetails(parseInt(orderId));
        if (order) {
            await OrderNotificationService.notifyStatusChange(
                parseInt(orderId),
                order.user_id,
                status,
                { metadata: { reason } }
            );
        }

        logger.info('Order status updated via tracking', { orderId, status });
        return ResponseFormatter.success(res, 200, 'Order status updated', result);
    } catch (error) {
        if (error.message.includes('Cannot transition')) {
            return ResponseFormatter.error(res, 400, error.message);
        }
        logger.error('Error updating order status', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/orders/:orderId/tracking/delivery-location
 * @description Update delivery partner location (Delivery Partner only)
 * @access Private
 */
router.post('/:orderId/tracking/delivery-location', authenticateToken, asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { latitude, longitude, accuracy, speed, heading } = req.body;

    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        return ResponseFormatter.error(res, 400, 'Invalid order ID');
    }

    const errors = [];
    if (!latitude || !longitude) {
        errors.push('Latitude and longitude are required');
    }
    if (isNaN(latitude) || isNaN(longitude)) {
        errors.push('Coordinates must be valid numbers');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await OrderTrackingService.updateDeliveryLocation(
            parseInt(orderId),
            req.user.id,
            { latitude, longitude, accuracy, speed, heading }
        );

        logger.info('Delivery location updated', { orderId });
        return ResponseFormatter.success(res, 200, 'Location updated', result);
    } catch (error) {
        logger.error('Error updating delivery location', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/orders/:orderId/notifications
 * @description Get order-related notifications
 * @access Private
 */
router.get('/:orderId/notifications', authenticateToken, asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        return ResponseFormatter.error(res, 400, 'Invalid order ID');
    }

    try {
        const result = await OrderNotificationService.getUserNotifications(
            req.user.id,
            { page, limit, unreadOnly }
        );

        logger.info('Notifications retrieved', { orderId, userId: req.user.id });
        return ResponseFormatter.paginated(
            res, 200, 'Notifications retrieved',
            result.notifications, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving notifications', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/orders/notifications/:notificationId/read
 * @description Mark notification as read
 * @access Private
 */
router.put('/notifications/:notificationId/read', authenticateToken, asyncHandler(async (req, res) => {
    const { notificationId } = req.params;

    if (!Validator.isPositiveNumber(parseInt(notificationId))) {
        return ResponseFormatter.error(res, 400, 'Invalid notification ID');
    }

    try {
        await OrderNotificationService.markNotificationAsRead(parseInt(notificationId));
        logger.info('Notification marked as read', { notificationId });
        return ResponseFormatter.success(res, 200, 'Notification marked as read');
    } catch (error) {
        logger.error('Error marking notification as read', { notificationId, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/user/:userId/notifications/read-all
 * @description Mark all notifications as read
 * @access Private
 */
router.put('/:userId/notifications/read-all', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (req.user.id !== parseInt(userId)) {
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    try {
        const result = await OrderNotificationService.markAllAsRead(parseInt(userId));
        logger.info('All notifications marked as read', { userId });
        return ResponseFormatter.success(res, 200, 'All notifications marked as read', result);
    } catch (error) {
        logger.error('Error marking all as read', { userId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/user/:userId/orders/analytics
 * @description Get user order analytics
 * @access Private
 */
router.get('/:userId/orders/analytics', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    try {
        const analytics = await OrderAnalyticsService.getUserOrderAnalytics(parseInt(userId));
        logger.info('User analytics retrieved', { userId });
        return ResponseFormatter.success(res, 200, 'Analytics retrieved', analytics);
    } catch (error) {
        logger.error('Error retrieving analytics', { userId, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/orders/:orderId/rating
 * @description Submit order rating and review
 * @access Private
 */
router.post('/:orderId/rating', authenticateToken, asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { rating, review = '' } = req.body;

    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(orderId))) {
        errors.push('Invalid order ID');
    }
    if (!rating || rating < 1 || rating > 5) {
        errors.push('Rating must be between 1 and 5');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        await OrderAnalyticsService.recordReview(parseInt(orderId), {
            rating: parseInt(rating),
            review,
            userId: req.user.id,
        });

        logger.info('Order review submitted', { orderId, rating });
        return ResponseFormatter.success(res, 200, 'Review submitted successfully');
    } catch (error) {
        logger.error('Error submitting review', { orderId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/admin/analytics/dashboard
 * @description Get analytics dashboard (Admin only)
 * @access Private (Admin)
 */
router.get('/admin/analytics/dashboard', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        return ResponseFormatter.error(res, 403, 'Admin access required');
    }

    try {
        const analytics = await OrderAnalyticsService.getDashboardAnalytics();
        logger.info('Dashboard analytics retrieved');
        return ResponseFormatter.success(res, 200, 'Dashboard analytics', analytics);
    } catch (error) {
        logger.error('Error retrieving dashboard analytics', { error: error.message });
        throw error;
    }
}));

module.exports = router;
