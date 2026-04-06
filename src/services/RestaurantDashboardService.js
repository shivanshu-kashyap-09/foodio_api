const Database = require('../utils/Database');
const Logger = require('../utils/Logger');
const WebSocketManager = require('../utils/WebSocketManager');

const logger = new Logger('RestaurantDashboardService');

class RestaurantDashboardService {
    async getEarningsSummary(resId) {
        try {
            // Updated to get more insights: Earnings, Orders, Customers, and Avg Rating
            const statsSql = `
                SELECT 
                    COALESCE(SUM(total), 0) as earnings, 
                    COUNT(*) as orders,
                    COUNT(DISTINCT user_id) as customers
                FROM orders 
                WHERE restaurant_id = ? AND delivery_status = 'Delivered'
            `;
            
            // To get avg rating, we'll check across all menu types this restaurant might have
            // This is a simplified version; in a real SaaS we'd have a 'reviews' table
            const ratingSql = `
                SELECT AVG(rating) as avg_rating FROM (
                    SELECT dish_rating as rating FROM vegmenu WHERE restaurant_id = ?
                    UNION ALL
                    SELECT dish_rating as rating FROM nonvegmenu WHERE restaurant_id = ?
                    UNION ALL
                    SELECT dish_rating as rating FROM southindianmenu WHERE restaurant_id = ?
                ) as all_ratings
            `;

            const stats = await Database.queryOne(statsSql, [resId]);
            const rating = await Database.queryOne(ratingSql, [resId, resId, resId]);

            return {
                ...stats,
                avg_rating: rating.avg_rating ? parseFloat(rating.avg_rating).toFixed(1) : "0.0"
            };
        } catch (error) {
            logger.error('Failed to fetch earnings summary', { error: error.message });
            throw error;
        }
    }

    async getAnalyticsData(resId) {
        try {
            // Get earnings trend for the last 7 days
            const sql = `
                SELECT 
                    DATE(created_at) as date, 
                    SUM(total) as earnings 
                FROM orders 
                WHERE restaurant_id = ? AND delivery_status = 'Delivered' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at) ASC
            `;
            return await Database.query(sql, [resId]);
        } catch (error) {
            logger.error('Failed to fetch analytics', { error: error.message });
            throw error;
        }
    }

    async getIncomingOrders(resId) {
        try {
            const sql = "SELECT * FROM orders WHERE restaurant_id = ? AND delivery_status != 'Delivered' ORDER BY order_id DESC";
            return await Database.query(sql, [resId]);
        } catch (error) {
            logger.error('Failed to fetch incoming orders', { error: error.message });
            throw error;
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            const sql = "UPDATE orders SET delivery_status = ? WHERE order_id = ?";
            const result = await Database.query(sql, [status, orderId]);
            
            WebSocketManager.broadcastOrderStatusUpdate(orderId, { 
                status, 
                message: `Order status updated to ${status}` 
            });

            return result;
        } catch (error) {
            logger.error('Failed to update order status', { error: error.message });
            throw error;
        }
    }

    async getDishes(resId, type) {
        try {
            const table = this._getMenuTable(type);
            const sql = `SELECT * FROM ${table} WHERE restaurant_id = ?`;
            return await Database.query(sql, [resId]);
        } catch (error) {
            logger.error('Failed to fetch dishes', { error: error.message });
            throw error;
        }
    }

    async addDish(resId, type, dishData) {
        try {
            const table = this._getMenuTable(type);
            const sql = `INSERT INTO ${table} (dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)`;
            return await Database.query(sql, [dishData.dish_name, dishData.dish_price, dishData.dish_rating || 4.5, dishData.dish_description, dishData.dish_image, resId]);
        } catch (error) {
            logger.error('Failed to add dish', { error: error.message });
            throw error;
        }
    }

    async updateDish(resId, type, dishId, dishData) {
        try {
            const table = this._getMenuTable(type);
            const sql = `UPDATE ${table} SET dish_name = ?, dish_price = ?, dish_description = ?, dish_image = ? WHERE dish_id = ? AND restaurant_id = ?`;
            return await Database.query(sql, [dishData.dish_name, dishData.dish_price, dishData.dish_description, dishData.dish_image, dishId, resId]);
        } catch (error) {
            logger.error('Failed to update dish', { error: error.message });
            throw error;
        }
    }

    async deleteDish(resId, type, dishId) {
        try {
            const table = this._getMenuTable(type);
            const sql = `DELETE FROM ${table} WHERE dish_id = ? AND restaurant_id = ?`;
            return await Database.query(sql, [dishId, resId]);
        } catch (error) {
            logger.error('Failed to delete dish', { error: error.message });
            throw error;
        }
    }

    _getMenuTable(type) {
        if (type === 'veg') return 'vegmenu';
        if (type === 'nonveg') return 'nonvegmenu';
        if (type === 'southindian') return 'southindianmenu';
        throw new Error('Invalid menu type: ' + type);
    }
}

module.exports = new RestaurantDashboardService();

