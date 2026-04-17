/**
 * FOODIO API - Order Notification Service
 * Handles notifications for orders via multiple channels (push, email, SMS, in-app)
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');
const MailerService = require('./MailerService');

const WebSocketManager = require('../utils/WebSocketManager');

const logger = new Logger('OrderNotificationService');

class OrderNotificationService {
    /**
     * Notify all online delivery partners in a city about a new order
     * @param {Object} orderData - Order data
     */
    static async notifyNewOrderToPartners(orderData) {
        try {
            const { order_id, city, total_amount, delivery_charges } = orderData;
            
            // 1. Get all online delivery partners in the same city
            const sql = `
                SELECT u.user_id 
                FROM user u
                JOIN delivery_partners dp ON u.user_id = dp.user_id
                WHERE dp.status = 'available' AND dp.city = ?
            `;
            const partners = await Database.query(sql, [city]);

            const notification = {
                title: 'New Order Available! 🛍️',
                message: `New order #${order_id} in ${city}. Grab it now!`,
                orderId: order_id,
                total: total_amount,
                charges: delivery_charges,
                type: 'order.new_available'
            };

            // 2. Send via WebSocket to each partner
            for (const partner of partners) {
                WebSocketManager.broadcastNotification(partner.user_id, notification);
            }

            logger.info('New order notification sent to partners', { order_id, city, partnerCount: partners.length });
        } catch (error) {
            logger.error('notifyNewOrderToPartners error', { error: error.message });
        }
    }

    /**
     * Send notification for order status change
     * @param {number} orderId - Order ID
     * @param {number} userId - User ID
     * @param {string} status - New order status
     * @param {Object} options - Notification options
     */
    static async notifyStatusChange(orderId, userId, status, options = {}) {
        try {
            const { channels = ['push', 'in_app', 'email'], metadata = {} } = options;

            const notification = {
                title: this._getNotificationTitle(status),
                message: this._getNotificationMessage(status, metadata),
                type: `order.${status}`,
            };

            // Try to save notification to database (optional - may not exist)
            try {
                const insertQuery = `
                    INSERT INTO order_notifications (
                        order_id, user_id, notification_type, title, message,
                        channel, metadata, is_read, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NOW())
                `;
                for (const channel of channels) {
                    await Database.query(insertQuery, [
                        orderId, userId, notification.type,
                        notification.title, notification.message,
                        channel, JSON.stringify(metadata),
                    ]);
                }
            } catch (dbErr) {
                // Table may not exist - silently skip DB insert
                logger.warn('order_notifications DB insert skipped', { error: dbErr.message });
            }

            // Send WebSocket / push notifications
            await this._sendNotifications(userId, notification, channels, metadata);

            logger.info('Status change notification sent', { orderId, userId, status, channels });

            return notification;
        } catch (error) {
            // Do NOT throw - notifications are non-critical
            logger.error('notifyStatusChange error', { orderId, userId, error: error.message });
            return null;
        }
    }

    /**
     * Notify user about delivery updates
     * @param {number} orderId - Order ID
     * @param {number} userId - User ID
     * @param {Object} deliveryData - Delivery information
     */
    static async notifyDeliveryUpdate(orderId, userId, deliveryData) {
        try {
            const {
                deliveryPartnerName,
                estimatedArrival,
                currentLocation,
                channels = ['push', 'in_app'],
            } = deliveryData;

            const notification = {
                title: 'Delivery Partner Arrived',
                message: `${deliveryPartnerName} is on the way. Estimated arrival: ${estimatedArrival}`,
                type: 'delivery.update',
            };

            const metadata = { deliveryPartnerName, estimatedArrival, currentLocation };

            // Try to save (optional)
            try {
                const insertQuery = `
                    INSERT INTO order_notifications (
                        order_id, user_id, notification_type, title, message,
                        channel, metadata, is_read, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NOW())
                `;
                for (const channel of channels) {
                    await Database.query(insertQuery, [
                        orderId, userId, notification.type,
                        notification.title, notification.message,
                        channel, JSON.stringify(metadata),
                    ]);
                }
            } catch (dbErr) {
                logger.warn('order_notifications DB insert skipped', { error: dbErr.message });
            }

            await this._sendNotifications(userId, notification, channels, metadata);
            logger.info('Delivery update notification sent', { orderId, userId });
            return notification;
        } catch (error) {
            // Do NOT throw - notifications are non-critical
            logger.error('notifyDeliveryUpdate error', { orderId, userId, error: error.message });
            return null;
        }
    }

    /**
     * Send order confirmation email
     * @param {number} userEmail - User email
     * @param {Object} orderData - Order details
     */
    static async sendOrderConfirmationEmail(userEmail, orderData) {
        try {
            const { orderId, restaurantName, totalAmount, estimatedDeliveryTime, items } = orderData;

            const itemsList = items.map(item => `- ${item.name} x ${item.quantity}`).join('\n');

            const emailContent = `
                <h2>Order Confirmation</h2>
                <p>Your order has been confirmed!</p>
                <hr>
                <p><strong>Order ID:</strong> #${orderId}</p>
                <p><strong>Restaurant:</strong> ${restaurantName}</p>
                <p><strong>Items:</strong></p>
                <pre>${itemsList}</pre>
                <p><strong>Total Amount:</strong> ₹${totalAmount}</p>
                <p><strong>Estimated Delivery:</strong> ${estimatedDeliveryTime}</p>
                <hr>
                <p>Track your order status <a href="${process.env.APP_URL}/orders/${orderId}">here</a></p>
            `;

            await MailerService.sendMail({
                to: userEmail,
                subject: `Order Confirmation - #${orderId}`,
                html: emailContent,
            });

            logger.info('Order confirmation email sent', { orderId, userEmail });

            return { success: true };
        } catch (error) {
            logger.error('sendOrderConfirmationEmail error', { orderId: orderData.orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Get user notifications
     * @param {number} userId - User ID
     * @param {Object} options - Query options
     */
    static async getUserNotifications(userId, options = {}) {
        try {
            const { page = 1, limit = 20, unreadOnly = false } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT * FROM order_notifications
                WHERE user_id = ?
            `;

            const params = [userId];

            if (unreadOnly) {
                query += ` AND is_read = FALSE`;
            }

            query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), offset);

            const countQuery = `
                SELECT COUNT(*) as total FROM order_notifications
                WHERE user_id = ?
                ${unreadOnly ? 'AND is_read = FALSE' : ''}
            `;

            const [notifications, countResult] = await Promise.all([
                Database.query(query, params),
                Database.query(countQuery, unreadOnly ? [userId] : [userId]),
            ]);

            const total = countResult[0]?.total || 0;
            const unreadCount = await this._getUnreadCount(userId);

            return {
                notifications,
                total,
                unreadCount,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('getUserNotifications error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Mark notification as read
     * @param {number} notificationId - Notification ID
     */
    static async markNotificationAsRead(notificationId) {
        try {
            const query = `
                UPDATE order_notifications
                SET is_read = TRUE, read_at = NOW()
                WHERE id = ?
            `;

            await Database.query(query, [notificationId]);

            logger.info('Notification marked as read', { notificationId });

            return { success: true };
        } catch (error) {
            logger.error('markNotificationAsRead error', { notificationId, error: error.message });
            throw error;
        }
    }

    /**
     * Mark all notifications as read for user
     * @param {number} userId - User ID
     */
    static async markAllAsRead(userId) {
        try {
            const query = `
                UPDATE order_notifications
                SET is_read = TRUE, read_at = NOW()
                WHERE user_id = ? AND is_read = FALSE
            `;

            const result = await Database.query(query, [userId]);

            logger.info('All notifications marked as read', { userId, count: result.affectedRows });

            return { success: true, markedCount: result.affectedRows };
        } catch (error) {
            logger.error('markAllAsRead error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Send notifications through multiple channels
     * @private
     */
    static async _sendNotifications(userId, notification, channels, metadata = {}) {
        try {
            for (const channel of channels) {
                switch (channel) {
                    case 'push':
                        await this._sendPushNotification(userId, notification);
                        break;
                    case 'email':
                        await this._sendEmailNotification(userId, notification, metadata);
                        break;
                    case 'sms':
                        await this._sendSmsNotification(userId, notification);
                        break;
                    case 'in_app':
                        // In-app notifications are already saved to DB
                        break;
                }
            }
        } catch (error) {
            logger.error('_sendNotifications error', { userId, error: error.message });
        }
    }

    /**
     * Send push notification
     * @private
     */
    static async _sendPushNotification(userId, notification) {
        try {
            // Get user's FCM token from cache or database
            let fcmToken = await Cache.get(`user_fcm:${userId}`);

            if (!fcmToken) {
                // In production, fetch from users table if FCM token is stored there
                logger.warn('FCM token not found for user', { userId });
                return;
            }

            // In production, integrate with Firebase Cloud Messaging
            logger.info('Push notification sent', { userId, title: notification.title });
        } catch (error) {
            logger.error('_sendPushNotification error', { userId, error: error.message });
        }
    }

    /**
     * Send email notification
     * @private
     */
    static async _sendEmailNotification(userId, notification, metadata = {}) {
        try {
            // Get user email
            const userQuery = `SELECT email FROM users WHERE id = ?`;
            const user = await Database.queryOne(userQuery, [userId]);

            if (!user || !user.email) {
                logger.warn('User email not found', { userId });
                return;
            }

            // Send email
            await MailerService.sendMail({
                to: user.email,
                subject: notification.title,
                html: `<p>${notification.message}</p>`,
            });

            logger.info('Email notification sent', { userId, email: user.email });
        } catch (error) {
            logger.error('_sendEmailNotification error', { userId, error: error.message });
        }
    }

    /**
     * Send SMS notification
     * @private
     */
    static async _sendSmsNotification(userId, notification) {
        try {
            // Get user phone
            const userQuery = `SELECT phone FROM users WHERE id = ?`;
            const user = await Database.queryOne(userQuery, [userId]);

            if (!user || !user.phone) {
                logger.warn('User phone not found', { userId });
                return;
            }

            // In production, integrate with SMS service (e.g., Twilio)
            logger.info('SMS notification would be sent', { userId, phone: user.phone });
        } catch (error) {
            logger.error('_sendSmsNotification error', { userId, error: error.message });
        }
    }

    /**
     * Get notification title
     * @private
     */
    static _getNotificationTitle(status) {
        const titles = {
            'pending': 'Order Placed',
            'confirmed': 'Order Confirmed!',
            'preparing': 'Preparing Your Order',
            'ready': 'Order Ready!',
            'out_for_delivery': 'On The Way!',
            'delivered': 'Order Delivered!',
            'cancelled': 'Order Cancelled',
            'refunded': 'Refund Processed',
        };
        return titles[status] || 'Order Update';
    }

    /**
     * Get notification message
     * @private
     */
    static _getNotificationMessage(status, metadata = {}) {
        const messages = {
            'pending': 'Your order has been placed successfully.',
            'confirmed': 'The restaurant has confirmed your order.',
            'preparing': 'Your delicious food is being prepared. Stay hungry! 😋',
            'ready': 'Your order is ready. Come pick it up!',
            'out_for_delivery': `${metadata.deliveryPartnerName || 'Your delivery partner'} is on the way with your order.`,
            'delivered': 'Your order has been delivered. Enjoy your meal! 🍽️',
            'cancelled': metadata.reason ? `Order cancelled: ${metadata.reason}` : 'Your order has been cancelled.',
            'refunded': 'Your refund has been processed successfully.',
        };
        return messages[status] || 'Your order has been updated.';
    }

    /**
     * Get unread notification count
     * @private
     */
    static async _getUnreadCount(userId) {
        try {
            const query = `SELECT COUNT(*) as count FROM order_notifications WHERE user_id = ? AND is_read = FALSE`;
            const result = await Database.queryOne(query, [userId]);
            return result?.count || 0;
        } catch (error) {
            logger.error('_getUnreadCount error', { userId, error: error.message });
            return 0;
        }
    }
}

module.exports = OrderNotificationService;
