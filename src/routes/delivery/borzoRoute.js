const express = require('express');
const router = express.Router();
const borzoService = require('../../services/BorzoService');
const { authenticateToken, authorizeAdmin } = require('../../middleware/Auth');
const ResponseFormatter = require('../../utils/ResponseFormatter');

/**
 * POST /api/delivery/borzo/calculate
 * Calculate delivery price
 */
router.post('/calculate', authenticateToken, async (req, res) => {
    try {
        const { points } = req.body;
        if (!points || points.length < 2) {
            return ResponseFormatter.error(res, 400, 'At least 2 points (pickup and delivery) are required');
        }

        const result = await borzoService.calculatePrice(points);
        return ResponseFormatter.success(res, 200, 'Price calculated successfully', result);
    } catch (error) {
        return ResponseFormatter.error(res, 500, error.message);
    }
});

/**
 * POST /api/delivery/borzo/create
 * Create a delivery order
 */
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { orderData, localOrderId } = req.body;
        if (!orderData || !orderData.points || orderData.points.length < 2) {
            return ResponseFormatter.error(res, 400, 'Invalid order data');
        }

        const result = await borzoService.createOrder(orderData);
        
        // Connect Borzo reference to local Foodio order if provided
        if (localOrderId && result?.order?.order_id) {
            const Database = require('../../utils/Database');
            const trackingUrl = result.order.points[0]?.tracking_url || result.order.points[1]?.tracking_url || null;
            await Database.query(
                'UPDATE orders SET borzo_order_id = ?, borzo_tracking_url = ? WHERE order_id = ?',
                [result.order.order_id, trackingUrl, localOrderId]
            );
        }

        return ResponseFormatter.success(res, 201, 'Delivery order created successfully', result);
    } catch (error) {
        return ResponseFormatter.error(res, 500, error.message);
    }
});

/**
 * GET /api/delivery/borzo/status/:orderId
 * Get delivery status
 */
router.get('/status/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await borzoService.getOrderStatus(orderId);
        return ResponseFormatter.success(res, 200, 'Order status retrieved successfully', result);
    } catch (error) {
        return ResponseFormatter.error(res, 500, error.message);
    }
});

/**
 * POST /api/delivery/borzo/cancel
 * Cancel a delivery order
 */
router.post('/cancel', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return ResponseFormatter.error(res, 400, 'Order ID is required');
        }

        const result = await borzoService.cancelOrder(orderId);
        return ResponseFormatter.success(res, 200, 'Order cancelled successfully', result);
    } catch (error) {
        return ResponseFormatter.error(res, 500, error.message);
    }
});

module.exports = router;
