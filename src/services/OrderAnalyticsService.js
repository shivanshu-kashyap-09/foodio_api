/**
 * FOODIO API - Order Analytics Service
 * Analytics and metrics for orders
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');

const logger = new Logger('OrderAnalyticsService');

class OrderAnalyticsService {
    /**
     * Record order metrics
     * @param {number} orderId - Order ID
     * @param {Object} metricsData - Metrics to record
     */
    static async recordOrderMetrics(orderId, metricsData = {}) {
        try {
            const {
                userId,
                restaurantId,
                totalTimeMinutes,
                preparationTimeMinutes,
                deliveryTimeMinutes,
                distanceKm,
            } = metricsData;

            const query = `
                INSERT INTO order_metrics (
                    order_id, user_id, restaurant_id,
                    total_time_minutes, preparation_time_minutes, delivery_time_minutes,
                    distance_km, metrics_data, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            await Database.query(query, [
                orderId,
                userId,
                restaurantId,
                totalTimeMinutes,
                preparationTimeMinutes,
                deliveryTimeMinutes,
                distanceKm,
                JSON.stringify(metricsData),
            ]);

            logger.info('Order metrics recorded', { orderId });

            return { success: true };
        } catch (error) {
            logger.error('recordOrderMetrics error', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Get order metrics
     * @param {number} orderId - Order ID
     */
    static async getOrderMetrics(orderId) {
        try {
            const query = `
                SELECT
                    total_time_minutes,
                    preparation_time_minutes,
                    delivery_time_minutes,
                    distance_km,
                    rating,
                    review,
                    rating_created_at,
                    metrics_data,
                    created_at
                FROM order_metrics
                WHERE order_id = ?
            `;

            return await Database.queryOne(query, [orderId]);
        } catch (error) {
            logger.error('getOrderMetrics error', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Get analytics dashboard data
     * @param {Object} options - Query options (dateRange, restaurantId, etc.)
     */
    static async getDashboardAnalytics(options = {}) {
        try {
            const cacheKey = 'analytics:dashboard';
            const cached = await Cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const {
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                endDate = new Date(),
                restaurantId = null,
            } = options;

            const params = [startDate, endDate];

            // Total orders
            let totalOrdersQuery = `
                SELECT COUNT(*) as total
                FROM orders
                WHERE created_at BETWEEN ? AND ?
            `;
            if (restaurantId) {
                totalOrdersQuery += ` AND restaurant_id = ?`;
                params.push(restaurantId);
            }

            // Revenue
            let revenueQuery = `
                SELECT SUM(total_amount) as revenue
                FROM orders
                WHERE created_at BETWEEN ? AND ? AND status IN ('delivered', 'refunded')
            `;

            // Average delivery time
            let avgDeliveryQuery = `
                SELECT AVG(delivery_time_minutes) as avg_delivery_time
                FROM order_metrics
                WHERE created_at BETWEEN ? AND ?
            `;

            // Orders by status
            let statusQuery = `
                SELECT status, COUNT(*) as count
                FROM orders
                WHERE created_at BETWEEN ? AND ?
                GROUP BY status
            `;

            // Average rating
            let ratingQuery = `
                SELECT AVG(rating) as avg_rating, COUNT(rating) as rated_orders
                FROM order_metrics
                WHERE rating IS NOT NULL AND created_at BETWEEN ? AND ?
            `;

            // Top restaurants
            let topRestaurantsQuery = `
                SELECT restaurant_id, COUNT(*) as order_count, SUM(total_amount) as revenue
                FROM orders
                WHERE created_at BETWEEN ? AND ? AND status IN ('delivered', 'refunded')
                GROUP BY restaurant_id
                ORDER BY order_count DESC
                LIMIT 10
            `;

            const [
                totalOrdersResult,
                revenueResult,
                avgDeliveryResult,
                statusResult,
                ratingResult,
                topRestaurantsResult,
            ] = await Promise.all([
                Database.query(totalOrdersQuery, params),
                Database.query(revenueQuery, [startDate, endDate]),
                Database.query(avgDeliveryQuery, [startDate, endDate]),
                Database.query(statusQuery, [startDate, endDate]),
                Database.query(ratingQuery, [startDate, endDate]),
                Database.query(topRestaurantsQuery, [startDate, endDate]),
            ]);

            const analytics = {
                overview: {
                    totalOrders: totalOrdersResult[0]?.total || 0,
                    totalRevenue: revenueResult[0]?.revenue || 0,
                    averageDeliveryTime: avgDeliveryResult[0]?.avg_delivery_time || 0,
                    averageRating: ratingResult[0]?.avg_rating || 0,
                    ratedOrders: ratingResult[0]?.rated_orders || 0,
                },
                ordersByStatus: statusResult,
                topRestaurants: topRestaurantsResult,
                dateRange: {
                    startDate,
                    endDate,
                },
            };

            // Cache for 1 hour
            await Cache.setEx(cacheKey, 3600, JSON.stringify(analytics));

            logger.info('Dashboard analytics retrieved', { startDate, endDate });

            return analytics;
        } catch (error) {
            logger.error('getDashboardAnalytics error', { error: error.message });
            throw error;
        }
    }

    /**
     * Get user order analytics
     * @param {number} userId - User ID
     */
    static async getUserOrderAnalytics(userId) {
        try {
            const query = `
                SELECT
                    COUNT(DISTINCT o.id) as total_orders,
                    SUM(o.total_amount) as total_spent,
                    AVG(om.rating) as avg_rating,
                    COUNT(DISTINCT DATE(o.created_at)) as active_days,
                    MIN(o.created_at) as first_order_date,
                    MAX(o.created_at) as last_order_date,
                    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered_orders,
                    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders
                FROM orders o
                LEFT JOIN order_metrics om ON o.id = om.order_id
                WHERE o.user_id = ?
            `;

            return await Database.queryOne(query, [userId]);
        } catch (error) {
            logger.error('getUserOrderAnalytics error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Get restaurant performance metrics
     * @param {number} restaurantId - Restaurant ID
     */
    static async getRestaurantPerformance(restaurantId) {
        try {
            const query = `
                SELECT
                    COUNT(DISTINCT o.id) as total_orders,
                    SUM(o.total_amount) as total_revenue,
                    AVG(om.preparation_time_minutes) as avg_preparation_time,
                    AVG(om.rating) as avg_rating,
                    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered_orders,
                    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
                    (COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) / COUNT(*) * 100) as delivery_success_rate
                FROM orders o
                LEFT JOIN order_metrics om ON o.id = om.order_id
                WHERE o.restaurant_id = ?
            `;

            return await Database.queryOne(query, [restaurantId]);
        } catch (error) {
            logger.error('getRestaurantPerformance error', { restaurantId, error: error.message });
            throw error;
        }
    }

    /**
     * Record order rating and review
     * @param {number} orderId - Order ID
     * @param {Object} reviewData - Rating and review
     */
    static async recordReview(orderId, reviewData) {
        try {
            const { rating, review, userId } = reviewData;

            // Validate rating
            if (rating < 1 || rating > 5) {
                throw new Error('Rating must be between 1 and 5');
            }

            const query = `
                UPDATE order_metrics
                SET rating = ?, review = ?, rating_created_at = NOW()
                WHERE order_id = ? AND user_id = ?
            `;

            const result = await Database.query(query, [rating, review, orderId, userId]);

            if (result.affectedRows === 0) {
                throw new Error('Order metrics not found');
            }

            // Invalidate cache
            await Cache.del('analytics:dashboard');

            logger.info('Order review recorded', { orderId, rating });

            return { success: true };
        } catch (error) {
            logger.error('recordReview error', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Get hourly order trend
     * @param {Object} options - Query options
     */
    static async getHourlyOrderTrend(options = {}) {
        try {
            const { days = 7 } = options;
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const query = `
                SELECT
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
                    COUNT(*) as order_count,
                    SUM(total_amount) as revenue
                FROM orders
                WHERE created_at >= ?
                GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')
                ORDER BY hour ASC
            `;

            return await Database.query(query, [startDate]);
        } catch (error) {
            logger.error('getHourlyOrderTrend error', { error: error.message });
            throw error;
        }
    }

    /**
     * Get peak hours
     * @param {Object} options - Query options
     */
    static async getPeakHours(options = {}) {
        try {
            const { days = 7 } = options;
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const query = `
                SELECT
                    HOUR(created_at) as hour,
                    COUNT(*) as order_count,
                    AVG(total_amount) as avg_order_value
                FROM orders
                WHERE created_at >= ?
                GROUP BY HOUR(created_at)
                ORDER BY order_count DESC
            `;

            return await Database.query(query, [startDate]);
        } catch (error) {
            logger.error('getPeakHours error', { error: error.message });
            throw error;
        }
    }

    /**
     * Get order fulfillment rate
     * @param {Object} options - Query options
     */
    static async getFulfillmentRate(options = {}) {
        try {
            const { restaurantId = null, days = 30 } = options;
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            let query = `
                SELECT
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as fulfilled,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
                    COUNT(*) as total,
                    (COUNT(CASE WHEN status = 'delivered' THEN 1 END) / COUNT(*) * 100) as fulfillment_rate
                FROM orders
                WHERE created_at >= ?
            `;

            const params = [startDate];

            if (restaurantId) {
                query += ` AND restaurant_id = ?`;
                params.push(restaurantId);
            }

            return await Database.queryOne(query, params);
        } catch (error) {
            logger.error('getFulfillmentRate error', { error: error.message });
            throw error;
        }
    }
}

module.exports = OrderAnalyticsService;
