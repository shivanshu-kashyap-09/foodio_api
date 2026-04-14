const Database = require('../utils/Database');
const Logger = require('../utils/Logger');
const WebSocketManager = require('../utils/WebSocketManager');


const logger = new Logger('DeliveryService');

class DeliveryService {
    async getPendingOrders(city) {
        try {
            let sql = "SELECT * FROM orders WHERE status = 'pending' AND delivery_partner_id IS NULL";
            const params = [];
            if (city) {
                sql += " AND city = ?";
                params.push(city);
            }
            return await Database.query(sql, params);
        } catch (error) {
            logger.error('Failed to fetch pending orders', { city, error: error.message });
            throw error;
        }
    }

    async getPartnerStats(partnerId) {
        try {
            const sql = "SELECT * FROM delivery_partners WHERE id = ? OR user_id = ?";
            const partner = await Database.queryOne(sql, [partnerId, partnerId]);
            
            if (!partner) return null;

            const completedSql = "SELECT COUNT(*) as completed FROM orders WHERE delivery_partner_id = ? AND status = 'Delivered'";
            const earningsSql = "SELECT SUM(delivery_charges) as earnings FROM orders WHERE delivery_partner_id = ? AND status = 'Delivered'";

            const completed = await Database.queryOne(completedSql, [partner.id]);
            const earnings = await Database.queryOne(earningsSql, [partner.id]);

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
        let connection;
        try {
            connection = await Database.beginTransaction();

            // 1. Get order with lock to prevent race condition
            const checkSql = "SELECT delivery_partner_id, status FROM orders WHERE order_id = ? FOR UPDATE";
            const [orderRows] = await connection.query(checkSql, [orderId]);

            if (!orderRows || orderRows.length === 0) {
                throw new Error('Order not found');
            }

            if (orderRows[0].delivery_partner_id !== null) {
                throw new Error('Order already accepted by another partner');
            }

            // 2. Fetch partner details to save in order table
            const partnerSql = "SELECT name, phone FROM delivery_partners WHERE user_id = ? OR id = ?";
            const [partnerRows] = await connection.query(partnerSql, [partnerId, partnerId]);
            const partnerName = partnerRows.length > 0 ? partnerRows[0].name : 'Delivery Partner';
            const partnerPhone = partnerRows.length > 0 ? partnerRows[0].phone : '';

            // 3. Assign partner and update status
            const updateSql = "UPDATE orders SET delivery_partner_id = ?, delivery_partner_name = ?, delivery_partner_phone = ?, status = 'confirmed' WHERE order_id = ?";
            await connection.query(updateSql, [partnerId, partnerName, partnerPhone, orderId]);

            await Database.commitTransaction(connection);
            
            // Notify user
            WebSocketManager.broadcastOrderStatusUpdate(orderId, { status: 'confirmed' });

            return { success: true, message: 'Order accepted' };
        } catch (error) {
            if (connection) await Database.rollbackTransaction(connection);
            logger.error('Failed to accept order', { orderId, partnerId, error: error.message });
            throw error;
        }
    }

    async toggleStatus(partnerId, status) {
        try {
            const sql = "UPDATE delivery_partners SET status = ? WHERE id = ? OR user_id = ?";
            const result = await Database.query(sql, [status, partnerId, partnerId]);
            return result;
        } catch (error) {
            logger.error('Failed to toggle partner status', { partnerId, status, error: error.message });
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
