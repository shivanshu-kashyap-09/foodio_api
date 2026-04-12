const Database = require('../utils/Database');
const Logger = require('../utils/Logger');
const WebSocketManager = require('../utils/WebSocketManager');

const logger = new Logger('RestaurantDashboardService');

class RestaurantDashboardService {
    async getEarningsSummary(userId) {
        try {
            // Find which restaurant type this user belongs to
            // Since we don't know the type here, we have to check all or pass it.
            // For now, we'll try to find the restaurant by phone from ANY restaurant table.
            const stats = await this._findStatsAcrossTypes(userId);
            return stats;
        } catch (error) {
            logger.error('Failed to fetch earnings summary', { error: error.message });
            throw error;
        }
    }

    async getAnalyticsData(userId) {
        try {
            // Get earnings trend for the last 7 days
            const user = await Database.queryOne("SELECT user_phone FROM user WHERE user_id = ?", [userId]);
            const sql = `
                SELECT 
                    DATE(created_at) as date, 
                    SUM(total_amount) as earnings 
                FROM orders 
                WHERE (restaurant_phone = ? OR restaurant_id IN (
                    SELECT res_id FROM vegrestaurant WHERE res_phone = ?
                    UNION SELECT res_id FROM nonvegrestaurant WHERE res_phone = ?
                    UNION SELECT res_id FROM southindianrestaurant WHERE res_phone = ?
                )) AND status = 'Delivered' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at) ASC
            `;
            return await Database.query(sql, [user.user_phone, user.user_phone, user.user_phone, user.user_phone]);
        } catch (error) {
            logger.error('Failed to fetch analytics', { error: error.message });
            throw error;
        }
    }

    async getTrendingDishes(userId) {
        try {
            const user = await Database.queryOne("SELECT user_phone FROM user WHERE user_id = ?", [userId]);
            const phone = user.user_phone;
            const sql = `
                SELECT dish_name, dish_image, dish_rating, COUNT(*) as orders
                FROM (
                    SELECT dish_name, dish_image, dish_rating FROM vegmenu WHERE restaurant_id IN (SELECT res_id FROM vegrestaurant WHERE res_phone = ?)
                    UNION ALL
                    SELECT dish_name, dish_image, dish_rating FROM nonvegmenu WHERE restaurant_id IN (SELECT res_id FROM nonvegrestaurant WHERE res_phone = ?)
                    UNION ALL
                    SELECT dish_name, dish_image, dish_rating FROM southindianmenu WHERE restaurant_id IN (SELECT res_id FROM southindianrestaurant WHERE res_phone = ?)
                ) as all_dishes
                GROUP BY dish_name, dish_image, dish_rating
                ORDER BY dish_rating DESC
                LIMIT 3
            `;
            return await Database.query(sql, [phone, phone, phone]);
        } catch (error) {
            logger.error('Failed to fetch trending dishes', { error: error.message });
            throw error;
        }
    }

    async getOrderTrends(userId) {
        try {
            const user = await Database.queryOne("SELECT user_phone FROM user WHERE user_id = ?", [userId]);
            const phone = user.user_phone;
            const sql = `
                SELECT 
                    MONTHNAME(created_at) as month, 
                    COUNT(*) as count 
                FROM orders 
                WHERE (restaurant_phone = ? OR restaurant_id IN (
                    SELECT res_id FROM vegrestaurant WHERE res_phone = ?
                    UNION SELECT res_id FROM nonvegrestaurant WHERE res_phone = ?
                    UNION SELECT res_id FROM southindianrestaurant WHERE res_phone = ?
                ))
                AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                GROUP BY MONTH(created_at), MONTHNAME(created_at)
                ORDER BY MONTH(created_at) ASC
            `;
            return await Database.query(sql, [phone, phone, phone, phone]);
        } catch (error) {
            logger.error('Failed to fetch order trends', { error: error.message });
            throw error;
        }
    }

    async getIncomingOrders(userId) {
        try {
            const user = await Database.queryOne("SELECT user_phone FROM user WHERE user_id = ?", [userId]);
            const sql = "SELECT * FROM orders WHERE (restaurant_phone = ? OR restaurant_id IN (SELECT res_id FROM vegrestaurant WHERE res_phone = ? UNION SELECT res_id FROM nonvegrestaurant WHERE res_phone = ?)) AND status != 'Delivered' ORDER BY order_id DESC";
            return await Database.query(sql, [user.user_phone, user.user_phone, user.user_phone]);
        } catch (error) {
            logger.error('Failed to fetch incoming orders', { error: error.message });
            throw error;
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            const sql = "UPDATE orders SET status = ? WHERE order_id = ?";
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

    async getDishes(userId, type) {
        try {
            const resId = await this._resolveRestaurantId(userId, type);
            if (!resId) return [];
            const table = this._getMenuTable(type);
            const sql = `SELECT * FROM ${table} WHERE restaurant_id = ?`;
            return await Database.query(sql, [resId]);
        } catch (error) {
            logger.error('Failed to fetch dishes', { error: error.message });
            throw error;
        }
    }

    async _findStatsAcrossTypes(userId) {
        const user = await Database.queryOne("SELECT user_phone FROM user WHERE user_id = ?", [userId]);
        const phone = user.user_phone;
        
        const statsSql = `
            SELECT 
                COALESCE(SUM(total_amount), 0) as earnings, 
                COUNT(*) as orders,
                COUNT(DISTINCT user_id) as customers
            FROM orders 
            WHERE (restaurant_phone = ? OR restaurant_id IN (
                SELECT res_id FROM vegrestaurant WHERE res_phone = ?
                UNION SELECT res_id FROM nonvegrestaurant WHERE res_phone = ?
                UNION SELECT res_id FROM southindianrestaurant WHERE res_phone = ?
            )) AND status = 'Delivered'
        `;
        
        const ratingSql = `
            SELECT AVG(rating) as avg_rating FROM (
                SELECT dish_rating as rating FROM vegmenu WHERE restaurant_id IN (SELECT res_id FROM vegrestaurant WHERE res_phone = ?)
                UNION ALL
                SELECT dish_rating as rating FROM nonvegmenu WHERE restaurant_id IN (SELECT res_id FROM nonvegrestaurant WHERE res_phone = ?)
                UNION ALL
                SELECT dish_rating as rating FROM southindianmenu WHERE restaurant_id IN (SELECT res_id FROM southindianrestaurant WHERE res_phone = ?)
            ) as all_ratings
        `;

        const stats = await Database.queryOne(statsSql, [phone, phone, phone, phone]);
        const rating = await Database.queryOne(ratingSql, [phone, phone, phone]);

        return {
            ...stats,
            avg_rating: rating?.avg_rating ? parseFloat(rating.avg_rating).toFixed(1) : "0.0"
        };
    }

    async addDish(userId, type, dishData) {
        try {
            const resId = await this._resolveRestaurantId(userId, type);
            if (!resId) throw new Error("Restaurant record not found for this user");

            const table = this._getMenuTable(type);
            const sql = `INSERT INTO ${table} (dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)`;
            console.log(type, resId, dishData);
            return await Database.query(sql, [dishData.dish_name, dishData.dish_price, dishData.dish_rating || 4.5, dishData.dish_description, dishData.dish_image, resId]);
        } catch (error) {
            logger.error('Failed to add dish', { error: error.message });
            throw error;
        }
    }

    async updateDish(userId, type, dishId, dishData) {
        try {
            const resId = await this._resolveRestaurantId(userId, type);
            const table = this._getMenuTable(type);
            const sql = `UPDATE ${table} SET dish_name = ?, dish_price = ?, dish_description = ?, dish_image = ? WHERE dish_id = ? AND restaurant_id = ?`;
            return await Database.query(sql, [dishData.dish_name, dishData.dish_price, dishData.dish_description, dishData.dish_image, dishId, resId]);
        } catch (error) {
            logger.error('Failed to update dish', { error: error.message });
            throw error;
        }
    }

    async deleteDish(userId, type, dishId) {
        try {
            const resId = await this._resolveRestaurantId(userId, type);
            const table = this._getMenuTable(type);
            const sql = `DELETE FROM ${table} WHERE dish_id = ? AND restaurant_id = ?`;
            return await Database.query(sql, [dishId, resId]);
        } catch (error) {
            logger.error('Failed to delete dish', { error: error.message });
            throw error;
        }
    }

    // Helper to find the real restaurant record linked to this user (SaaS link)
    async _resolveRestaurantId(userId, type) {
        try {
            const resTable = this._getRestaurantTable(type);
            const user = await Database.queryOne("SELECT user_phone FROM user WHERE user_id = ?", [userId]);
            if (!user) return null;
            
            const restaurant = await Database.queryOne(`SELECT res_id FROM ${resTable} WHERE res_phone = ?`, [user.user_phone]);
            return restaurant ? restaurant.res_id : null;
        } catch (error) {
            logger.error('Failed to resolve restaurant ID', { userId, type });
            return null;
        }
    }

    _getMenuTable(type) {
        if (type === 'veg') return 'vegmenu';
        if (type === 'nonveg') return 'nonvegmenu';
        if (type === 'southindian') return 'southindianmenu';
        throw new Error('Invalid menu type: ' + type);
    }

    _getRestaurantTable(type) {
        if (type === 'veg') return 'vegrestaurant';
        if (type === 'nonveg') return 'nonvegrestaurant';
        if (type === 'southindian') return 'southindianrestaurant';
        return 'vegrestaurant';
    }
}

module.exports = new RestaurantDashboardService();

