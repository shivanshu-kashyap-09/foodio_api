/**
 * FOODIO API - Order Service
 * Business logic for order operations
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');
const OrderNotificationService = require('./OrderNotificationService');
const OrderTrackingService = require('./OrderTrackingService');
const MailerService = require('./MailerService');

const logger = new Logger('OrderService');

class OrderService {
    /**
     * Create order from cart
     */
    static async createOrder(userId, orderData) {
        let connection;

        try {
            connection = await Database.beginTransaction();

            const {
                restaurantId,
                deliveryAddress,
                specialInstructions,
                phone,
                paymentMethod,
                totalAmount,
                items,
            } = orderData;

            // Insert order
            const addressParts = (deliveryAddress || '').split(',').map(p => p.trim());
            const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : addressParts[0] || 'Unknown';
            const deliveryCharges = 50.00; // Fixed delivery charges for now

            const orderQuery = `
                INSERT INTO orders (
                    user_id,
                    items,
                    restaurant_id,
                    delivery_address,
                    city,
                    phone,
                    special_instructions,
                    payment_method,
                    total_amount,
                    delivery_charges,
                    status,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            const orderResult = await connection.execute(orderQuery, [
                userId,
                items.length,
                restaurantId,
                deliveryAddress,
                city,
                phone || null,
                specialInstructions,
                paymentMethod,
                totalAmount,
                deliveryCharges,
                'pending',
            ]);

            const orderId = orderResult[0].insertId;

            // Insert order dishes
            for (const item of items) {
                const dishQuery = `
                    INSERT INTO orderdishes (
                        order_id,
                        dish_id,
                        dish_name,
                        dish_type,
                        quantity,
                        price,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW())
                `;

                await connection.execute(dishQuery, [
                    orderId,
                    item.itemId || null,
                    item.dishName || 'Unknown Dish',
                    item.dishType || null,
                    item.quantity || 0,
                    item.price || 0,
                ]);
            }

            await Database.commitTransaction(connection);

            logger.info('Order created', { orderId, userId, totalAmount });

            // Notify nearby delivery partners (Commented out for Borzo integration)
            /*
            OrderNotificationService.notifyNewOrderToPartners({
                order_id: orderId,
                city,
                total_amount: totalAmount,
                delivery_charges: deliveryCharges
            });
            */

            return {
                orderId,
                userId,
                restaurantId: restaurantId,
                totalAmount: totalAmount,
                deliveryCharges: deliveryCharges,
                city,
                status: 'pending',
                items,
            };
        } catch (error) {
            if (connection) {
                await Database.rollbackTransaction(connection);
            }
            logger.error('createOrder error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Get user orders
     */
    static async getUserOrders(userId, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;

            const query = `
                SELECT * FROM orders
                WHERE user_id = ?
                LIMIT ? OFFSET ?
            `;

            const countQuery = `SELECT COUNT(*) as total FROM orders WHERE user_id = ?`;

            const [orders, countResult] = await Promise.all([
                Database.query(query, [userId, parseInt(limit), offset]),
                Database.query(countQuery, [userId]),
            ]);

            const total = countResult[0]?.total || 0;

            return {
                orders,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('getUserOrders error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Get order details
     */
    static async getOrderDetails(orderId) {
        try {
            const orderQuery = `
                SELECT o.*,
                       r.restaurant_name,
                       r.restaurant_phone,
                       r.restaurant_address
                FROM orders o
                LEFT JOIN vegrestaurant r ON o.restaurant_id = r.id
                WHERE o.order_id = ?
            `;

            const dishesQuery = `
                SELECT od.* FROM orderdishes od
                WHERE od.order_id = ?
            `;

            const [order, dishes] = await Promise.all([
                Database.queryOne(orderQuery, [orderId]),
                Database.query(dishesQuery, [orderId]),
            ]);

            if (!order) {
                return null;
            }

            return {
                ...order,
                dishes,
            };
        } catch (error) {
            logger.error('getOrderDetails error', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Update order status
     */
    static async updateOrderStatus(orderId, status) {
        try {
            const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'picked', 'out_for_delivery', 'delivered', 'cancelled'];

            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            const query = `
                UPDATE orders
                SET status = ?, updated_at = NOW()
                WHERE order_id = ?
            `;

            const result = await Database.query(query, [status, orderId]);

            if (result.affectedRows === 0) {
                return null;
            }

            logger.info('Order status updated', { orderId, status });

            return await this.getOrderDetails(orderId);
        } catch (error) {
            logger.error('updateOrderStatus error', { orderId, status: error.message });
            throw error;
        }
    }

    /**
     * Cancel order with actor metadata and notifications
     */
    static async cancelOrder(orderId, actorType = 'user', actorId = null, reason = '') {
        try {
            const orderQuery = `
                SELECT order_id, status, user_id, restaurant_phone, delivery_partner_id, restaurant_name
                FROM orders
                WHERE order_id = ?
            `;
            const order = await Database.queryOne(orderQuery, [orderId]);

            if (!order) {
                return null;
            }

            if (order.status === 'delivered' || order.status === 'cancelled') {
                throw new Error(`Cannot cancel order with status: ${order.status}`);
            }

            await OrderTrackingService.updateOrderStatusWithTracking(orderId, 'cancelled', {
                userId: actorId,
                changeType: actorType,
                reason: reason || `Cancelled by ${actorType}`
            });

            if (order.delivery_partner_id) {
                await Database.query(
                    `UPDATE delivery_partners SET status = 'available' WHERE id = ? OR user_id = ?`,
                    [order.delivery_partner_id, order.delivery_partner_id]
                );
            }

            const user = await Database.queryOne('SELECT user_gmail, user_name FROM user WHERE user_id = ?', [order.user_id]);
            const restaurantUser = order.restaurant_phone ? await Database.queryOne('SELECT user_gmail, user_name, user_id FROM user WHERE user_phone = ?', [order.restaurant_phone]) : null;
            const partnerUser = order.delivery_partner_id ? await Database.queryOne(
                `SELECT u.user_id, u.user_gmail, u.user_name
                 FROM delivery_partners dp
                 JOIN user u ON dp.user_id = u.user_id
                 WHERE dp.id = ? OR dp.user_id = ?
                 LIMIT 1`,
                [order.delivery_partner_id, order.delivery_partner_id]
            ) : null;

            if (actorType === 'restaurant') {
                if (user?.user_gmail) {
                    await MailerService.sendOrderCancellationEmail(user.user_gmail, orderId, 'Restaurant');
                }
                if (partnerUser) {
                    await OrderNotificationService.notifyStatusChange(orderId, partnerUser.user_id, 'cancelled', {
                        metadata: { reason, cancelledBy: 'restaurant' }
                    });
                }
            } else if (actorType === 'user') {
                if (restaurantUser?.user_gmail) {
                    await MailerService.sendOrderCancellationEmail(restaurantUser.user_gmail, orderId, 'User');
                }
                if (partnerUser) {
                    await OrderNotificationService.notifyStatusChange(orderId, partnerUser.user_id, 'cancelled', {
                        metadata: { reason, cancelledBy: 'user' }
                    });
                }
            } else {
                if (user?.user_gmail) {
                    await MailerService.sendOrderCancellationEmail(user.user_gmail, orderId, 'System');
                }
            }

            if (user) {
                await OrderNotificationService.notifyStatusChange(orderId, order.user_id, 'cancelled', {
                    metadata: { reason, cancelledBy: actorType }
                });
            }

            if (restaurantUser) {
                await OrderNotificationService.notifyStatusChange(orderId, restaurantUser.user_id, 'cancelled', {
                    metadata: { reason, cancelledBy: actorType }
                });
            }

            return order;
        } catch (error) {
            logger.error('cancelOrder error', { orderId, error: error.message });
            throw error;
        }
    }

    static _generateOtp() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    static async createOrderOtp(orderId, type, expiresMinutes = 15) {
        try {
            const otp = this._generateOtp();
            const column = type === 'handover' ? 'handover_otp' : 'delivery_otp';
            const expiresColumn = type === 'handover' ? 'handover_otp_expires_at' : 'delivery_otp_expires_at';

            const query = `
                UPDATE orders
                SET ${column} = ?, ${expiresColumn} = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW()
                WHERE order_id = ?
            `;

            await Database.query(query, [otp, expiresMinutes, orderId]);
            return otp;
        } catch (error) {
            logger.error('createOrderOtp error', { orderId, type, error: error.message });
            throw error;
        }
    }

    static async verifyOrderOtp(orderId, type, otp) {
        try {
            const column = type === 'handover' ? 'handover_otp' : 'delivery_otp';
            const expiresColumn = type === 'handover' ? 'handover_otp_expires_at' : 'delivery_otp_expires_at';

            const query = `SELECT ${column} as otp, ${expiresColumn} as expires FROM orders WHERE order_id = ?`;
            const order = await Database.queryOne(query, [orderId]);

            if (!order || !order.otp) {
                throw new Error('OTP is not available for this order');
            }

            if (order.otp !== otp) {
                throw new Error('Invalid OTP');
            }

            if (order.expires && new Date(order.expires) < new Date()) {
                throw new Error('OTP has expired');
            }

            return true;
        } catch (error) {
            logger.error('verifyOrderOtp error', { orderId, type, error: error.message });
            throw error;
        }
    }

    /**
     * Get all orders (admin)
     */
    static async getAllOrders(page = 1, limit = 10, status = null) {
        try {
            const offset = (page - 1) * limit;

            let query = `SELECT * FROM orders`;
            let countQuery = `SELECT COUNT(*) as total FROM orders`;
            const params = [];

            if (status) {
                query += ` WHERE status = ?`;
                countQuery += ` WHERE status = ?`;
                params.push(status);
            }

            query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;

            const [orders, countResult] = await Promise.all([
                Database.query(query, [...params, parseInt(limit), offset]),
                Database.query(countQuery, params),
            ]);

            const total = countResult[0]?.total || 0;

            return {
                orders,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('getAllOrders error', { error: error.message });
            throw error;
        }
    }
}

module.exports = OrderService;
