const Logger = require('./Logger');
const logger = new Logger('WebSocketManager');

class WebSocketManager {
    constructor() {
        this.connections = new Map();
        this.subscribers = new Map();
        this.rooms = new Map();
    }

    /**
     * Initialize WebSocket for a connection
     * @param {Object} socket - Socket.io socket object
     * @param {Object} auth - Authentication data
     */
    initialize(socket, auth) {
        try {
            const { userId, orderId } = auth;

            if (!userId) {
                socket.disconnect(true);
                logger.warn('WebSocket connection rejected - missing userId');
                return;
            }

            // Store connection
            this.connections.set(socket.id, {
                socket,
                userId,
                orderId,
                connectedAt: new Date(),
            });

            // Join user room
            socket.join(`user:${userId}`);

            // Join order room if orderId provided
            if (orderId) {
                socket.join(`order:${orderId}`);
            }

            logger.info('WebSocket connection established', { socketId: socket.id, userId, orderId });

            // Handle events
            this._setupEventHandlers(socket);
        } catch (error) {
            logger.error('WebSocket initialization error', { error: error.message });
        }
    }

    /**
     * Broadcast order status update to all connected clients
     * @param {number} orderId - Order ID
     * @param {Object} statusData - Status data
     */
    broadcastOrderStatusUpdate(orderId, statusData) {
        try {
            const eventData = {
                orderId,
                ...statusData,
                timestamp: new Date(),
            };

            // Emit to order room
            if (this.subscribers.has(`order:${orderId}`)) {
                const io = this.subscribers.get(`order:${orderId}`);
                io.to(`order:${orderId}`).emit('order:status_updated', eventData);
                logger.info('Order status update broadcasted', { orderId });
            }
        } catch (error) {
            logger.error('broadcastOrderStatusUpdate error', { orderId, error: error.message });
        }
    }

    /**
     * Broadcast delivery location update
     * @param {number} orderId - Order ID
     * @param {Object} location - Location data
     */
    broadcastDeliveryLocationUpdate(orderId, location) {
        try {
            const eventData = {
                orderId,
                ...location,
                timestamp: new Date(),
            };

            if (this.subscribers.has(`order:${orderId}`)) {
                const io = this.subscribers.get(`order:${orderId}`);
                io.to(`order:${orderId}`).emit('delivery:location_updated', eventData);
                logger.info('Delivery location update broadcasted', { orderId });
            }
        } catch (error) {
            logger.error('broadcastDeliveryLocationUpdate error', { orderId, error: error.message });
        }
    }

    /**
     * Broadcast notification to user
     * @param {number} userId - User ID
     * @param {Object} notification - Notification data
     */
    broadcastNotification(userId, notification) {
        try {
            const eventData = {
                userId,
                ...notification,
                timestamp: new Date(),
            };

            if (this.subscribers.has(`user:${userId}`)) {
                const io = this.subscribers.get(`user:${userId}`);
                io.to(`user:${userId}`).emit('notification:new', eventData);
                logger.info('Notification broadcasted', { userId });
            }
        } catch (error) {
            logger.error('broadcastNotification error', { userId, error: error.message });
        }
    }

    /**
     * Send message to specific socket
     * @param {string} socketId - Socket ID
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    sendToSocket(socketId, event, data) {
        try {
            const connection = this.connections.get(socketId);
            if (connection) {
                connection.socket.emit(event, {
                    ...data,
                    timestamp: new Date(),
                });
                logger.debug('Message sent to socket', { socketId, event });
            }
        } catch (error) {
            logger.error('sendToSocket error', { socketId, event, error: error.message });
        }
    }

    /**
     * Get active connections count
     */
    getActiveConnectionsCount() {
        return this.connections.size;
    }

    /**
     * Get connections for order
     * @param {number} orderId - Order ID
     */
    getOrderConnections(orderId) {
        const connections = [];
        for (const [socketId, conn] of this.connections) {
            if (conn.orderId === orderId) {
                connections.push({ socketId, ...conn });
            }
        }
        return connections;
    }

    /**
     * Get connections for user
     * @param {number} userId - User ID
     */
    getUserConnections(userId) {
        const connections = [];
        for (const [socketId, conn] of this.connections) {
            if (conn.userId === userId) {
                connections.push({ socketId, ...conn });
            }
        }
        return connections;
    }

    /**
     * Register Socket.io instance for broadcasting
     * @param {string} namespace - Namespace identifier
     * @param {Object} io - Socket.io instance
     */
    registerIO(namespace, io) {
        this.subscribers.set(namespace, io);
        logger.info('IO instance registered', { namespace });
    }

    /**
     * Setup event handlers
     * @private
     */
    _setupEventHandlers(socket) {
        socket.on('order:track', (data) => {
            const { orderId } = data;
            socket.join(`order:${orderId}`);
            logger.debug('User joined order tracking', { socketId: socket.id, orderId });
        });

        socket.on('delivery:location_update', (data) => {
            const { orderId, location } = data;
            const connection = this.connections.get(socket.id);

            if (!connection) {
                return;
            }

            this.broadcastDeliveryLocationUpdate(orderId, location);
        });

        socket.on('disconnect', () => {
            this.connections.delete(socket.id);
            logger.info('WebSocket connection closed', { socketId: socket.id });
        });

        socket.on('error', (error) => {
            logger.error('WebSocket error', { socketId: socket.id, error });
        });
    }
}

module.exports = new WebSocketManager();
