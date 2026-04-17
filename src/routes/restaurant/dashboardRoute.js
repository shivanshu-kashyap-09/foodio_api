const express = require('express');
const route = express.Router();
const { authenticateToken: authMiddleware } = require('../../middleware/Auth');
const { restaurantOnly } = require('../../middleware/RoleAuth');
const dashboardService = require('../../services/RestaurantDashboardService');
const Logger = require('../../utils/Logger');

const logger = new Logger('RestaurantDashboardRoute');

/**
 * GET /api/restaurant/dashboard/summary
 * Get earnings summary
 */
route.get('/summary', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const resId = req.user.restaurant_id || req.user.id;
        const summary = await dashboardService.getEarningsSummary(resId);
        return res.status(200).json({
            success: true,
            data: summary,
            message: 'Summary fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch summary', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch summary'
        });
    }
});

/**
 * GET /api/restaurant/dashboard/analytics
 * Get earnings analytics (7-day trend)
 */
route.get('/analytics', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const resId = req.user.restaurant_id || req.user.id;
        const analytics = await dashboardService.getAnalyticsData(resId);
        return res.status(200).json({
            success: true,
            data: analytics,
            message: 'Analytics fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch analytics', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics'
        });
    }
});

/**
 * GET /api/restaurant/dashboard/trending
 * Get top selling dishes
 */
route.get('/trending', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const resId = req.user.restaurant_id || req.user.id;
        const dishes = await dashboardService.getTrendingDishes(resId);
        return res.status(200).json({
            success: true,
            data: dishes,
            message: 'Trending dishes fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch trending', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch trending dishes'
        });
    }
});

/**
 * GET /api/restaurant/dashboard/trends
 * Get order count trends
 */
route.get('/trends', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const resId = req.user.restaurant_id || req.user.id;
        const trends = await dashboardService.getOrderTrends(resId);
        return res.status(200).json({
            success: true,
            data: trends,
            message: 'Order trends fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch trends', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch order trends'
        });
    }
});

/**
 * GET /api/restaurant/dashboard/orders
 * Get incoming orders
 */
route.get('/orders', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const resId = req.user.restaurant_id || req.user.id;
        const orders = await dashboardService.getIncomingOrders(resId);
        return res.status(200).json({
            success: true,
            data: orders,
            message: 'Orders fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch orders', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});

/**
 * PUT /api/restaurant/dashboard/order-status
 * Update order status
 */
route.put('/order-status', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const { orderId, status, reason } = req.body;
        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: 'Incomplete parameters'
            });
        }
        await dashboardService.updateOrderStatus(orderId, status, req.user.id, reason);
        return res.status(200).json({
            success: true,
            message: 'Order status updated successfully'
        });
    } catch (error) {
        logger.error('Failed to update status', { error: error.message });
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update status'
        });
    }
});

/**
 * GET /api/restaurant/dashboard/dishes/:type
 * Get menu dishes
 */
route.get('/dishes/:type', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const resId = req.user.restaurant_id || req.user.id;
        const dishes = await dashboardService.getDishes(resId, req.params.type);
        return res.status(200).json({
            success: true,
            data: dishes,
            message: 'Dishes fetched successfully'
        });
    } catch (error) {
        logger.error('Failed to fetch dishes', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dishes'
        });
    }
});

/**
 * POST /api/restaurant/dashboard/add-dish
 * Add new dish
 */
route.post('/add-dish', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const resId = req.user.restaurant_id || req.user.id;
        const { type, ...dishData } = req.body;
        await dashboardService.addDish(resId, type, dishData);
        return res.status(201).json({
            success: true,
            message: 'Dish added successfully'
        });
    } catch (error) {
        logger.error('Failed to add dish', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to add dish'
        });
    }
});

/**
 * PUT /api/restaurant/dashboard/update-dish/:id
 * Update existing dish
 */
route.put('/update-dish/:id', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const resId = req.user.restaurant_id || req.user.id;
        const { type, ...dishData } = req.body;
        const dishId = req.params.id;
        await dashboardService.updateDish(resId, type, dishId, dishData);
        return res.status(200).json({
            success: true,
            message: 'Dish updated successfully'
        });
    } catch (error) {
        logger.error('Failed to update dish', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to update dish'
        });
    }
});

/**
 * DELETE /api/restaurant/dashboard/delete-dish/:id
 * Delete a dish
 */
route.delete('/delete-dish/:id', authMiddleware, restaurantOnly, async (req, res) => {
    try {
        const resId = req.user.restaurant_id || req.user.id;
        const { type } = req.body;
        const dishId = req.params.id;
        await dashboardService.deleteDish(resId, type, dishId);
        return res.status(200).json({
            success: true,
            message: 'Dish deleted successfully'
        });
    } catch (error) {
        logger.error('Failed to delete dish', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to delete dish'
        });
    }
});

module.exports = route;
