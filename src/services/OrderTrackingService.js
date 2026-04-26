/**
 * FOODIO API - Order Tracking Service
 * Production-level order tracking with real-time updates, analytics, and integrations
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');

const logger = new Logger('OrderTrackingService');

class OrderTrackingService {
    /**
     * Get real-time order tracking status
     * @param {number} orderId - Order ID
     * @param {number} userId - User ID for authorization
     * @returns {Object} Complete tracking information
     */
    static async getOrderTrackingStatus(orderId, userId) {
        try {
            // Check cache first
            const cacheKey = `order_tracking:${orderId}`;
            const cached = await Cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const query = `
                select * from orders where order_id = ? and user_id = ?;
            `;

            const order = await Database.queryOne(query, [orderId, userId]);

            if (!order) {
                return null;
            }

            // Get status history
            const statusHistoryQuery = `
                SELECT previous_status, current_status, changed_by_type, reason, created_at
                FROM order_status_history
                WHERE order_id = ?
                ORDER BY created_at ASC
            `;
            const statusHistory = await Database.query(statusHistoryQuery, [orderId]);

            // Get timeline events
            const timelineQuery = `
                SELECT event_type, event_title, event_description, created_at
                FROM order_timeline_events
                WHERE order_id = ?
                ORDER BY created_at ASC
            `;
            const timeline = await Database.query(timelineQuery, [orderId]);

            // Get delivery tracking if available
            let deliveryTracking = null;
            if (order.status === 'out_for_delivery' && order.delivery_partner_id) {
                const trackingQuery = `
                    SELECT latitude, longitude, accuracy, speed, updated_at
                    FROM delivery_tracking
                    WHERE order_id = ?
                    ORDER BY updated_at DESC
                    LIMIT 1
                `;
                deliveryTracking = await Database.queryOne(trackingQuery, [orderId]);
            }

            // Calculate time estimates
            const timeEstimates = this._calculateTimeEstimates(order, statusHistory);

            const trackingData = {
                order: {
                    id: order.order_id,
                    status: order.status,
                    totalAmount: order.total_amount,
                    deliveryAddress: order.delivery_address,
                    itemCount: order.item_count,
                    totalItems: order.total_items,
                    createdAt: order.created_at,
                    updatedAt: order.updated_at,
                },
                restaurant: {
                    id: order.restaurant_id,
                    name: order.restaurant_name,
                    phone: order.restaurant_phone,
                    address: order.restaurant_address,
                },
                delivery: {
                    partnerName: order.delivery_partner_name,
                    partnerPhone: order.delivery_partner_phone,
                    currentLocation: deliveryTracking ? {
                        latitude: deliveryTracking.latitude,
                        longitude: deliveryTracking.longitude,
                        accuracy: deliveryTracking.accuracy,
                        speed: deliveryTracking.speed,
                        updatedAt: deliveryTracking.updated_at,
                    } : null,
                    estimatedDeliveryTime: order.estimated_delivery_time,
                    actualDeliveryTime: order.actual_delivery_time,
                    distance: order.delivery_distance_km
                },
                tracking: {
                    statusHistory,
                    timeline,
                    timeEstimates,
                    currentLocation: {
                        latitude: order.latitude,
                        longitude: order.longitude,
                    },
                },
            };

            // Cache for 5 minutes
            // await Cache.setEx(cacheKey, 300, JSON.stringify(trackingData));

            return trackingData;
        } catch (error) {
            logger.error('getOrderTrackingStatus error', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Record order status change with history
     * @param {number} orderId - Order ID
     * @param {string} newStatus - New status
     * @param {Object} options - Additional options
     */
    static async updateOrderStatusWithTracking(orderId, newStatus, options = {}) {
        let connection;
        try {
            connection = await Database.beginTransaction();

            const {
                userId,
                changeType = 'system',
                reason = '',
                metadata = {},
            } = options;

            // Get current order status
            const currentOrderQuery = `SELECT status, user_id FROM orders WHERE order_id = ?`;
            const currentOrder = await connection.execute(currentOrderQuery, [orderId]);

            if (currentOrder[0].length === 0) {
                throw new Error('Order not found');
            }

            const previousStatus = currentOrder[0][0].status;
            const orderUserId = currentOrder[0][0].user_id;

            // Validate status transition
            this._validateStatusTransition(previousStatus, newStatus);

            // Update order status
            const updateQuery = `
                UPDATE orders
                SET status = ?, updated_at = NOW()
                WHERE order_id = ?
            `;
            await connection.execute(updateQuery, [newStatus, orderId]);

            // Record status history
            const historyQuery = `
                INSERT INTO order_status_history (
                    order_id, user_id, previous_status, current_status,
                    changed_by, changed_by_type, reason, metadata, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            await connection.execute(historyQuery, [
                orderId,
                orderUserId,
                previousStatus,
                newStatus,
                userId || null,
                changeType,
                reason,
                JSON.stringify(metadata),
            ]);

            // Add timeline event
            const timelineQuery = `
                INSERT INTO order_timeline_events (
                    order_id, event_type, event_title, event_description,
                    created_by, created_by_type, event_data, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            const eventTitle = this._getEventTitle(newStatus);
            const eventDescription = this._getEventDescription(newStatus, reason);

            await connection.execute(timelineQuery, [
                orderId,
                newStatus,
                eventTitle,
                eventDescription,
                userId || null,
                changeType,
                JSON.stringify(metadata),
            ]);

            await Database.commitTransaction(connection);

            // Invalidate cache
            // await Cache.del(`order_tracking:${orderId}`);

            logger.info('Order status updated with tracking', {
                orderId,
                previousStatus,
                newStatus,
                changeType,
            });

            return {
                orderId,
                previousStatus,
                currentStatus: newStatus,
                transitionTime: new Date(),
            };
        } catch (error) {
            if (connection) {
                await Database.rollbackTransaction(connection);
            }
            logger.error('updateOrderStatusWithTracking error', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Update delivery partner location in real-time
     * @param {number} orderId - Order ID
     * @param {number} deliveryPartnerId - Delivery partner ID
     * @param {Object} location - Location coordinates
     */
    static async updateDeliveryLocation(orderId, deliveryPartnerId, location) {
        try {
            const { latitude, longitude, accuracy = null, speed = null, heading = null } = location;

            // Validate location data
            if (!latitude || !longitude) {
                throw new Error('Invalid location coordinates');
            }

            // Insert delivery tracking record
            const query = `
                INSERT INTO delivery_tracking (
                    order_id, delivery_partner_id, latitude, longitude,
                    accuracy, speed, heading, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            await Database.query(query, [
                orderId,
                deliveryPartnerId,
                latitude,
                longitude,
                accuracy,
                speed,
                heading,
            ]);

            // Also update the orders table with latest coordinates
            const updateOrderQuery = `
                UPDATE orders
                SET latitude = ?, longitude = ?
                WHERE order_id = ? AND delivery_partner_id = ?
            `;

            await Database.query(updateOrderQuery, [latitude, longitude, orderId, deliveryPartnerId]);

            // Invalidate cache
            // await Cache.del(`order_tracking:${orderId}`);

            logger.info('Delivery location updated', { orderId, deliveryPartnerId });

            return { success: true };
        } catch (error) {
            logger.error('updateDeliveryLocation error', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Get delivery tracking history
     * @param {number} orderId - Order ID
     * @returns {Array} Tracking history
     */
    static async getDeliveryTrackingHistory(orderId) {
        try {
            const query = `
                SELECT latitude, longitude, accuracy, speed, heading, updated_at
                FROM delivery_tracking
                WHERE order_id = ?
                ORDER BY updated_at ASC
            `;

            return await Database.query(query, [orderId]);
        } catch (error) {
            logger.error('getDeliveryTrackingHistory error', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Calculate time estimates based on status history
     * @private
     */
    static _calculateTimeEstimates(order, statusHistory) {
        const times = {};
        let previousTime = new Date(order.created_at);

        for (const history of statusHistory) {
            const currentTime = new Date(history.created_at);
            const duration = Math.floor((currentTime - previousTime) / 60000); // in minutes

            if (history.current_status === 'confirmed') {
                times.confirmation_time = duration;
            } else if (history.current_status === 'preparing') {
                times.acceptance_time = duration;
            } else if (history.current_status === 'ready') {
                times.preparation_time = duration;
            } else if (history.current_status === 'out_for_delivery') {
                times.handover_time = duration;
            } else if (history.current_status === 'delivered') {
                times.delivery_time = duration;
            }

            previousTime = currentTime;
        }

        return times;
    }

    /**
     * Validate order status transitions
     * @private
     */
    static _validateStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            'pending': ['confirmed', 'cancelled'],
            'confirmed': ['preparing', 'cancelled'],
            'preparing': ['ready', 'cancelled'],
            'ready': ['picked', 'out_for_delivery', 'cancelled'],
            'picked': ['out_for_delivery', 'delivered', 'cancelled'],
            'out_for_delivery': ['delivered', 'cancelled'],
            'delivered': ['refunded'],
            'cancelled': ['refunded'],
            'refunded': [],
        };

        if (!validTransitions[currentStatus]) {
            throw new Error(`Invalid current status: ${currentStatus}`);
        }

        if (!validTransitions[currentStatus].includes(newStatus)) {
            throw new Error(
                `Cannot transition from ${currentStatus} to ${newStatus}. Valid statuses: ${validTransitions[currentStatus].join(', ')}`
            );
        }
    }

    /**
     * Get event title for status change
     * @private
     */
    static _getEventTitle(status) {
        const titles = {
            'pending': 'Order Placed',
            'confirmed': 'Order Confirmed',
            'preparing': 'Order Being Prepared',
            'ready': 'Order Ready for Pickup',
            'picked': 'Order Picked Up',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Order Delivered',
            'cancelled': 'Order Cancelled',
            'refunded': 'Refund Processed',
        };
        return titles[status] || 'Order Updated';
    }

    /**
     * Get event description for status change
     * @private
     */
    static _getEventDescription(status, reason = '') {
        const descriptions = {
            'pending': 'Your order has been successfully placed',
            'confirmed': 'The restaurant has confirmed your order',
            'preparing': 'Your food is being prepared',
            'ready': 'Your order is ready for pickup',
            'picked': 'Your order has been picked up by the delivery partner',
            'out_for_delivery': 'Your order is on its way',
            'delivered': 'Your order has been delivered',
            'cancelled': reason ? `Order cancelled: ${reason}` : 'Your order has been cancelled',
            'refunded': 'Your refund has been processed',
        };
        return descriptions[status] || 'Your order has been updated';
    }
}

module.exports = OrderTrackingService;
