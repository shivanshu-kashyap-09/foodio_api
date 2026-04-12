const Database = require('../utils/Database');
const Logger = require('../utils/Logger');
const WebSocketManager = require('../utils/WebSocketManager');


const logger = new Logger('DeliveryService');

class DeliveryService {
    async getPendingOrders() {
        try {
            const sql = "SELECT * FROM orders WHERE status = 'Ready' AND delivery_partner_id IS NULL";
            return await Database.query(sql);
        } catch (error) {
            logger.error('Failed to fetch pending orders', { error: error.message });
            throw error;
        }
    }

    async getPartnerStats(partnerId) {
        try {
            const sql = "SELECT * FROM delivery_partner WHERE partner_id = ?";
            const partner = await Database.queryOne(sql, [partnerId]);
            const completedSql = "SELECT COUNT(*) as completed FROM orders WHERE delivery_partner_id = ? AND status = 'Delivered'";
            const earningsSql = "SELECT SUM(total_amount * 0.1) as earnings FROM orders WHERE delivery_partner_id = ? AND status = 'Delivered'"; // 10% commission

            const completed = await Database.queryOne(completedSql, [partnerId]);
            const earnings = await Database.queryOne(earningsSql, [partnerId]);

            return {
                ...partner,
                completedOrders: completed.completed,
                totalEarnings: earnings ? (earnings.earnings || 0) : 0
            };
        } catch (error) {
            logger.error('Failed to fetch partner stats', { error: error.message });
            throw error;
        }
    }

    async getAssignedOrders(partnerId) {
        try {
            const sql = "SELECT * FROM orders WHERE delivery_partner_id = ? AND status != 'Delivered'";
            return await Database.query(sql, [partnerId]);
        } catch (error) {
            logger.error('Failed to fetch assigned orders', { error: error.message });
            throw error;
        }
    }

    async acceptOrder(orderId, partnerId) {
        try {
            const sql = "UPDATE orders SET delivery_partner_id = ?, status = 'Accepted' WHERE order_id = ?";
            return await Database.query(sql, [partnerId, orderId]);
        } catch (error) {
            logger.error('Failed to accept order', { error: error.message });
            throw error;
        }
    }

    async updateStatus(orderId, status) {
        try {
            const sql = "UPDATE orders SET status = ? WHERE order_id = ?";
            const result = await Database.query(sql, [status, orderId]);
            
            // Real-time status update
            WebSocketManager.broadcastOrderStatusUpdate(orderId, { status });

            return result;
        } catch (error) {

            logger.error('Failed to update delivery status', { error: error.message });
            throw error;
        }
    }

    async updateLocation(partnerId, lat, lng) {
        try {
            const sql = "UPDATE delivery_partner SET current_lat = ?, current_lng = ? WHERE partner_id = ?";
            const result = await Database.query(sql, [lat, lng, partnerId]);

            // Find associated active orders for this partner
            const activeOrders = await Database.query("SELECT order_id FROM orders WHERE delivery_partner_id = ? AND status != 'Delivered'", [partnerId]);
            
            // Emit location to all active order rooms
            activeOrders.forEach(order => {
                WebSocketManager.broadcastDeliveryLocationUpdate(order.order_id, { latitude: lat, longitude: lng });
            });

            return result;
        } catch (error) {

            logger.error('Failed to update location', { error: error.message });
            throw error;
        }
    }
}

module.exports = new DeliveryService();
