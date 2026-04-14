const express = require('express');
const route = express.Router();
const { authenticateToken: authMiddleware } = require('../../middleware/Auth');
const { deliveryOnly } = require('../../middleware/RoleAuth');
const deliveryService = require('../../services/DeliveryService');
const Logger = require('../../utils/Logger');

const logger = new Logger('DeliveryRoute');

/**
 * GET /api/delivery/pending-orders
 * Get available orders to pick up
 */
route.get('/pending-orders', authMiddleware, deliveryOnly, async (req, res) => {
    try {
        const orders = await deliveryService.getPendingOrders();
        return res.status(200).json({
            success: true,
            data: orders,
            message: 'Pending orders fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch pending orders', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending orders'
        });
    }
});

/**
 * GET /api/delivery/stats
 * Get delivery partner stats
 */
route.get('/stats', authMiddleware, deliveryOnly, async (req, res) => {
    try {
        const partnerId = req.user.partner_id || req.user.id;
        const stats = await deliveryService.getPartnerStats(partnerId);
        return res.status(200).json({
            success: true,
            data: stats,
            message: 'Stats fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch partner stats', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch partner stats'
        });
    }
});

/**
 * POST /api/delivery/accept-order
 * Accept a delivery task
 */
route.post('/accept-order', authMiddleware, deliveryOnly, async (req, res) => {
    try {
        const { orderId } = req.body;
        const partnerId = req.user.partner_id || req.user.id;
        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order id is required'
            });
        }
        await deliveryService.acceptOrder(orderId, partnerId);
        return res.status(200).json({
            success: true,
            message: 'Order accepted successfully'
        });
    } catch (error) {
        logger.error('Failed to accept order', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to accept order'
        });
    }
});

/**
 * GET /api/delivery/assigned-orders
 * Get orders assigned to the partner
 */
route.get('/assigned-orders', authMiddleware, deliveryOnly, async (req, res) => {
    try {
        const partnerId = req.user.partner_id || req.user.id;
        const orders = await deliveryService.getAssignedOrders(partnerId);
        return res.status(200).json({
            success: true,
            data: orders,
            message: 'Assigned orders fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch assigned orders', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch assigned orders'
        });
    }
});

/**
 * PUT /api/delivery/order-status
 * Update order delivery status
 */
route.put('/order-status', authMiddleware, deliveryOnly, async (req, res) => {
    try {
        const { orderId, status } = req.body;
        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: 'Incomplete parameters'
            });
        }
        await deliveryService.updateStatus(orderId, status);
        return res.status(200).json({
            success: true,
            message: 'Order status updated successfully'
        });
    } catch (error) {
        logger.error('Failed to update status', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to update status'
        });
    }
});

/**
 * PUT /api/delivery/location
 * Update current location
 */
route.put('/location', authMiddleware, deliveryOnly, async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const partnerId = req.user.partner_id || req.user.id;
        if (lat === undefined || lng === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Incomplete location parameters'
            });
        }
        await deliveryService.updateLocation(partnerId, lat, lng);
        return res.status(200).json({
            success: true,
            message: 'Location updated successfully'
        });
    } catch (error) {
        logger.error('Failed to update location', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to update location'
        });
    }
});

/**
 * PUT /api/delivery/toggle-status
 * Toggle online/offline status
 */
route.put('/toggle-status', authMiddleware, deliveryOnly, async (req, res) => {
    try {
        const { status } = req.body;
        const partnerId = req.user.partner_id || req.user.id;
        
        if (!['available', 'offline'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Use available (online) or offline.'
            });
        }

        await deliveryService.toggleStatus(partnerId, status);
        return res.status(200).json({
            success: true,
            message: `Status updated to ${status === 'available' ? 'Online' : 'Offline'}`
        });
    } catch (error) {
        logger.error('Failed to toggle status', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to update status'
        });
    }
});

module.exports = route;
