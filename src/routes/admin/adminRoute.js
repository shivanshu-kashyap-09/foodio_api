const express = require('express');
const route = express.Router();
const { authenticateToken: authMiddleware } = require('../../middleware/Auth');
const { adminOnly } = require('../../middleware/RoleAuth');
const adminService = require('../../services/AdminService');
const Logger = require('../../utils/Logger');

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

module.exports = route;
