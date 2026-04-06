const Database = require('../utils/Database');
const Logger = require('../utils/Logger');

const logger = new Logger('AdminService');

class AdminService {
    async getDashboardStats() {
        try {
            const revenueSql = "SELECT SUM(total) as totalRevenue FROM orders WHERE delivery_status = 'Delivered'";
            const ordersSql = "SELECT COUNT(*) as totalOrders FROM orders";
            const usersSql = "SELECT COUNT(*) as totalUsers FROM user";
            const activeUsersSql = "SELECT COUNT(*) as activeUsers FROM user WHERE user_verify = 1";

            const revenue = await Database.queryOne(revenueSql);
            const orders = await Database.queryOne(ordersSql);
            const users = await Database.queryOne(usersSql);
            const activeUsers = await Database.queryOne(activeUsersSql);

            return {
                totalRevenue: revenue ? (revenue.totalRevenue || 0) : 0,
                totalOrders: orders ? orders.totalOrders : 0,
                totalUsers: users ? users.totalUsers : 0,
                activeUsers: activeUsers ? activeUsers.activeUsers : 0
            };
        } catch (error) {
            logger.error('Failed to fetch dashboard stats', { error: error.message });
            throw error;
        }
    }

    async getRecentOrders() {
        try {
            const sql = "SELECT * FROM orders ORDER BY order_id DESC LIMIT 10";
            return await Database.query(sql);
        } catch (error) {
            logger.error('Failed to fetch recent orders', { error: error.message });
            throw error;
        }
    }

    async getRestaurantsForApproval() {
        try {
            // Check all restaurant tables
            const veg = await Database.query("SELECT *, 'veg' as type FROM vegrestaurant WHERE is_approved = 0");
            const nonVeg = await Database.query("SELECT *, 'nonveg' as type FROM nonvegrestaurant WHERE is_approved = 0");
            const south = await Database.query("SELECT *, 'southindian' as type FROM southindianrestaurants WHERE is_approved = 0");

            return [...veg, ...nonVeg, ...south];
        } catch (error) {
            logger.error('Failed to fetch restaurants for approval', { error: error.message });
            throw error;
        }
    }

    async approveRestaurant(type, id, status) {
        try {
            let table = '';
            if (type === 'veg') table = 'vegrestaurant';
            else if (type === 'nonveg') table = 'nonvegrestaurant';
            else if (type === 'southindian') table = 'southindianrestaurants';

            if (!table) throw new Error('Invalid restaurant type');

            const sql = `UPDATE ${table} SET is_approved = ? WHERE res_id = ?`;
            return await Database.query(sql, [status ? 1 : -1, id]); // 1 for approved, -1 for rejected
        } catch (error) {
            logger.error('Failed to approve/reject restaurant', { error: error.message });
            throw error;
        }
    }
}

module.exports = new AdminService();
