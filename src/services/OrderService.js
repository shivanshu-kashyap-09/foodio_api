/**
 * FOODIO API - Order Service
 * Business logic for order operations
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');

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
            const orderQuery = `
                INSERT INTO orders (
                    user_id,
                    items,
                    restaurant_id,
                    delivery_address,
                    phone,
                    special_instructions,
                    payment_method,
                    total_amount,
                    status,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            const orderResult = await connection.execute(orderQuery, [
                userId,
                items.length,
                restaurantId,
                deliveryAddress,
                phone || null,
                specialInstructions,
                paymentMethod,
                totalAmount,
                'pending',
            ]);

            const orderId = orderResult[0].insertId;

            // Insert order dishes
            for (const item of items) {
                const dishQuery = `
                    INSERT INTO orderdishes (
                        order_id,
                        dish_id,
                        dish_type,
                        quantity,
                        price,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                `;

                await connection.execute(dishQuery, [
                    orderId,
                    item.itemId || null,
                    item.dishType || null,
                    item.quantity || 0,
                    item.price || 0,
                ]);
            }

            await Database.commitTransaction(connection);

            logger.info('Order created', { orderId, userId, totalAmount });

            return {
                orderId,
                userId,
                restaurantId: restaurantId,
                totalAmount: totalAmount,
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
                WHERE o.id = ?
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
            const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            const query = `
                UPDATE orders
                SET status = ?, updated_at = NOW()
                WHERE id = ?
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
     * Cancel order
     */
    static async cancelOrder(orderId) {
        try {
            const orderQuery = `SELECT status FROM orders WHERE id = ?`;
            const order = await Database.queryOne(orderQuery, [orderId]);

            if (!order) {
                return null;
            }

            if (order.status === 'delivered' || order.status === 'cancelled') {
                throw new Error(`Cannot cancel order with status: ${order.status}`);
            }

            return await this.updateOrderStatus(orderId, 'cancelled');
        } catch (error) {
            logger.error('cancelOrder error', { orderId, error: error.message });
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
