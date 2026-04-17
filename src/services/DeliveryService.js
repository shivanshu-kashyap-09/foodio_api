const Database = require('../utils/Database');
const Logger = require('../utils/Logger');
const WebSocketManager = require('../utils/WebSocketManager');
const OrderTrackingService = require('./OrderTrackingService');
const OrderService = require('./OrderService');
const MailerService = require('./MailerService');


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

            const completedSql = "SELECT COUNT(*) as completed FROM orders WHERE delivery_partner_id = ? AND status = 'delivered'";
            const earningsSql = "SELECT SUM(delivery_charges) as earnings FROM orders WHERE delivery_partner_id = ? AND status = 'delivered'";

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
            // Show active orders + recently delivered ones (last 2 hours) so partner sees completion
            const sql = `
                SELECT * FROM orders 
                WHERE delivery_partner_id = ? 
                AND (
                    status IN ('confirmed', 'picked', 'out_for_delivery')
                    OR (status = 'delivered' AND created_at >= NOW() - INTERVAL 2 HOUR)
                )
                ORDER BY CASE status 
                    WHEN 'confirmed' THEN 1 
                    WHEN 'picked' THEN 2 
                    WHEN 'out_for_delivery' THEN 3 
                    WHEN 'delivered' THEN 4 
                END, created_at DESC
            `;
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

    async updateStatus(orderId, status, partnerId, otp = null) {
        try {
            const validStatuses = ['confirmed', 'picked', 'out_for_delivery', 'delivered'];
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid delivery status: ${status}. Allowed: ${validStatuses.join(', ')}`);
            }

            const order = await Database.queryOne(
                `SELECT order_id, status, delivery_partner_id, user_id, handover_otp, handover_otp_expires_at, delivery_otp, delivery_otp_expires_at, handover_verified
                 FROM orders WHERE order_id = ?`,
                [orderId]
            );

            if (!order) {
                throw new Error('Order not found');
            }

            if (order.delivery_partner_id !== partnerId) {
                throw new Error('Unauthorized delivery partner');
            }

            if (status === 'picked') {
                if (order.status !== 'ready') {
                    throw new Error('Order must be ready before pickup');
                }
                if (!otp) {
                    throw new Error('Handover OTP is required to pick up the order');
                }
                await OrderService.verifyOrderOtp(orderId, 'handover', otp);
                await OrderTrackingService.updateOrderStatusWithTracking(orderId, 'picked', {
                    userId: partnerId,
                    changeType: 'delivery_partner',
                    reason: 'Handover OTP verified'
                });
                await Database.query(
                    `UPDATE orders SET handover_verified = TRUE, handover_otp = NULL, handover_otp_expires_at = NULL, updated_at = NOW() WHERE order_id = ?`,
                    [orderId]
                );

                const deliveryOtp = await OrderService.createOrderOtp(orderId, 'delivery', 20);
                const user = await Database.queryOne('SELECT user_gmail FROM user WHERE user_id = ?', [order.user_id]);
                if (user?.user_gmail) {
                    await MailerService.sendDeliveryOtpNotification(user.user_gmail, orderId, deliveryOtp);
                }

                WebSocketManager.broadcastOrderStatusUpdate(orderId, { status: 'picked' });
                return { success: true, message: 'Order picked up and delivery OTP sent to user' };
            }

            if (status === 'out_for_delivery') {
                if (order.status !== 'picked') {
                    throw new Error('Order must be picked up before starting delivery');
                }
                if (!order.handover_verified) {
                    throw new Error('Handover verification is required before delivery');
                }
                await OrderTrackingService.updateOrderStatusWithTracking(orderId, 'out_for_delivery', {
                    userId: partnerId,
                    changeType: 'delivery_partner',
                    reason: 'Delivery started'
                });
                WebSocketManager.broadcastOrderStatusUpdate(orderId, { status: 'out_for_delivery' });
                return { success: true, message: 'Order is now out for delivery' };
            }

            if (status === 'delivered') {
                if (order.status !== 'out_for_delivery') {
                    throw new Error('Order must be out for delivery before it can be delivered');
                }
                if (!otp) {
                    throw new Error('Delivery OTP is required to complete delivery');
                }
                await OrderService.verifyOrderOtp(orderId, 'delivery', otp);
                await OrderTrackingService.updateOrderStatusWithTracking(orderId, 'delivered', {
                    userId: partnerId,
                    changeType: 'delivery_partner',
                    reason: 'Delivery OTP verified'
                });
                await Database.query(
                    `UPDATE orders SET delivery_verified = TRUE, delivery_otp = NULL, delivery_otp_expires_at = NULL, updated_at = NOW() WHERE order_id = ?`,
                    [orderId]
                );

                const completeOrder = await Database.queryOne('SELECT delivery_charges, total_amount FROM orders WHERE order_id = ?', [orderId]);
                if (order.delivery_partner_id) {
                    await Database.query('UPDATE delivery_partners SET status = ? WHERE id = ? OR user_id = ?', ['available', order.delivery_partner_id, order.delivery_partner_id]);
                }

                WebSocketManager.broadcastOrderStatusUpdate(orderId, { status: 'delivered' });
                return { success: true, deliveryCharges: completeOrder.delivery_charges, totalAmount: completeOrder.total_amount };
            }

            return { success: false, message: 'Unexpected delivery status' };
        } catch (error) {
            logger.error('Failed to update delivery status', { orderId, status, error: error.message });
            throw error;
        }
    }

    async updateLocation(partnerId, lat, lng) {
        try {
            const sql = "UPDATE delivery_partner SET current_lat = ?, current_lng = ? WHERE partner_id = ?";
            const result = await Database.query(sql, [lat, lng, partnerId]);

            // Find associated active orders for this partner
            const activeOrders = await Database.query("SELECT order_id FROM orders WHERE delivery_partner_id = ? AND status != 'delivered'", [partnerId]);
            
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
