const express = require('express');
const route = express.Router();
const { authenticateToken: authMiddleware } = require('../../middleware/Auth');
const { adminOnly } = require('../../middleware/RoleAuth');
const adminService = require('../../services/AdminService');
const Logger = require('../../utils/Logger');
const LogEventBus = require('../../utils/LogEventBus');

const logger = new Logger('AdminRoute');

/**
 * GET /api/admin/stats
 * Get admin stats for dashboard
 */
route.get('/stats', authMiddleware, adminOnly, async (req, res) => {
    try {
        const stats = await adminService.getDashboardStats();
        return res.status(200).json({
            success: true,
            data: stats,
            message: 'Stats fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch admin stats', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch admin stats'
        });
    }
});

/**
 * GET /api/admin/revenue
 * Get revenue analytics for chart
 */
route.get('/revenue', authMiddleware, adminOnly, async (req, res) => {
    try {
        const revenue = await adminService.getRevenueAnalytics();
        return res.status(200).json({
            success: true,
            data: revenue,
            message: 'Revenue fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch revenue stats', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue analytics'
        });
    }
});

/**
 * GET /api/admin/pending-restaurants
 * Get restaurants pending for approval
 */
route.get('/pending-restaurants', authMiddleware, adminOnly, async (req, res) => {
    try {
        const restaurants = await adminService.getRestaurantsForApproval();
        return res.status(200).json({
            success: true,
            data: restaurants,
            message: 'Pending restaurants fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch pending restaurants', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending restaurants'
        });
    }
});

/**
 * POST /api/admin/approve-restaurant
 * Approve/reject a restaurant
 */
route.post('/approve-restaurant', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { type, id, status } = req.body;
        if (!type || !id) {
            return res.status(400).json({
                success: false,
                message: 'Incomplete parameters'
            });
        }

        await adminService.approveRestaurant(type, id, status);
        return res.status(200).json({
            success: true,
            message: `Restaurant ${status ? 'approved' : 'rejected'} successfully`
        });
    } catch (error) {
        logger.error('Failed to approve/reject restaurant', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to approve/reject restaurant'
        });
    }
});

/**
 * GET /api/admin/users
 * Get all users
 */
route.get('/users', authMiddleware, adminOnly, async (req, res) => {
    try {
        const users = await adminService.getAllUsers();
        return res.status(200).json({
            success: true,
            data: users,
            message: 'Users fetched successfully'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

/**
 * POST /api/admin/users/status
 * Block/Unblock user
 */
route.post('/users/status', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id, status } = req.body;
        await adminService.blockUser(id, status);
        return res.status(200).json({
            success: true,
            message: `User ${status ? 'unblocked' : 'blocked'} successfully`
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to update user status' });
    }
});

/**
 * GET /api/admin/delivery
 * Get all delivery agents
 */
route.get('/delivery', authMiddleware, adminOnly, async (req, res) => {
    try {
        const agents = await adminService.getAllDeliveryAgents();
        return res.status(200).json({
            success: true,
            data: agents,
            message: 'Delivery agents fetched successfully'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch delivery agents' });
    }
});

/**
 * POST /api/admin/delivery/status
 * Approve/Reject/Status change for delivery agent
 */
route.post('/delivery/status', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id, status } = req.body;
        await adminService.approveAgent(id, status);
        return res.status(200).json({
            success: true,
            message: `Delivery agent status updated to ${status}`
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to update agent status' });
    }
});

/**
 * GET /api/admin/restaurants/all
 * Get all restaurants (approved and unapproved)
 */
route.get('/restaurants/all', authMiddleware, adminOnly, async (req, res) => {
    try {
        const restaurants = await adminService.getAllRestaurants();
        return res.status(200).json({
            success: true,
            data: restaurants,
            message: 'All restaurants fetched successfully'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch restaurants' });
    }
});

/**
 * GET /api/admin/orders
 * Get all orders
 */
route.get('/orders', authMiddleware, adminOnly, async (req, res) => {
    try {
        const orders = await adminService.getAllOrders();
        return res.status(200).json({
            success: true,
            data: orders,
            message: 'All orders fetched successfully'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch orders' });
    }
});

/**
 * GET /api/admin/logs
 * Return the last N buffered log entries (JSON)
 */
route.get('/logs', authMiddleware, adminOnly, (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
        const level  = (req.query.level || '').toUpperCase(); // optional filter: INFO, WARN, ERROR
        let entries = LogEventBus.recent(limit);
        if (level && ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].includes(level)) {
            entries = entries.filter(e => e.level === level);
        }
        return res.status(200).json({ success: true, data: entries });
    } catch (error) {
        logger.error('Failed to fetch logs', { error: error.message });
        return res.status(500).json({ success: false, message: 'Failed to fetch logs' });
    }
});

/**
 * GET /api/admin/logs/stream
 * Server-Sent Events (SSE) endpoint — streams live log entries to admin dashboard.
 * Auth token must be passed as ?token=<jwt> query param (EventSource does not support headers).
 */
route.get('/logs/stream', authMiddleware, adminOnly, (req, res) => {
    // SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send the last 100 buffered entries immediately on connect
    const boot = LogEventBus.recent(100);
    boot.forEach(entry => {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    // Send a heartbeat comment every 15 s to keep the connection alive
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

    // Stream new log entries as they arrive
    const onLog = (entry) => {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    LogEventBus.on('log', onLog);

    // Cleanup on client disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        LogEventBus.off('log', onLog);
    });
});

module.exports = route;
