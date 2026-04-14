const axios = require('axios');
const config = require('../config/config');
const Logger = require('../utils/Logger');

const logger = new Logger('BorzoService');

class BorzoService {
    constructor() {
        this.apiToken = config.delivery.borzo.apiToken;
        this.apiUrl = config.delivery.borzo.apiUrl;
        this.headers = {
            'X-DV-Auth-Token': this.apiToken,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Calculate delivery price
     * @param {Object} points - Pickup and delivery points
     * @returns {Promise<Object>} Price calculation result
     */
    async calculatePrice(points) {
        try {
            const payload = {
                type: 'cms_order',
                matter: 'Food Delivery',
                points: points.map(p => ({
                    address: p.address,
                    contact_person: {
                        phone: p.phone,
                        name: p.name || ''
                    }
                }))
            };

            const response = await axios.post(`${this.apiUrl}/api/business/1.1/calculate-order`, payload, {
                headers: this.headers
            });
            logger.info('calculatePrice response', { response: response.data });
            if (response.data.success) {
                return response.data;
            } else {
                throw new Error(response.data.errors?.join(', ') || 'Price calculation failed');
            }
        } catch (error) {
            logger.error('calculatePrice error', { error: error });
            throw error;
        }
    }

    /**
     * Create delivery order
     * @param {Object} orderData - Order details and points
     * @returns {Promise<Object>} Created order details
     */
    async createOrder(orderData) {
        try {
            const payload = {
                type: 'cms_order',
                matter: orderData.matter || 'Food Delivery',
                points: orderData.points.map(p => ({
                    address: p.address,
                    contact_person: {
                        phone: p.phone,
                        name: p.name || ''
                    },
                    buyout_amount: p.buyout_amount || 0,
                    note: p.note || ''
                }))
            };

            const response = await axios.post(`${this.apiUrl}/api/business/1.1/create-order`, payload, {
                headers: this.headers
            });

            if (response.data.success) {
                return response.data;
            } else {
                throw new Error(response.data.errors?.join(', ') || 'Order creation failed');
            }
        } catch (error) {
            logger.error('createOrder error', { error: error.message });
            throw error;
        }
    }

    /**
     * Fetch order status
     * @param {string} orderId - Borzo order ID
     * @returns {Promise<Object>} Order status
     */
    async getOrderStatus(orderId) {
        try {
            const response = await axios.get(`${this.apiUrl}/api/business/1.1/orders?order_id=${orderId}`, {
                headers: this.headers
            });

            if (response.data.success) {
                return response.data.orders[0];
            } else {
                throw new Error(response.data.errors?.join(', ') || 'Failed to fetch order status');
            }
        } catch (error) {
            logger.error('getOrderStatus error', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Cancel delivery order
     * @param {string} orderId - Borzo order ID
     * @returns {Promise<Object>} Cancel result
     */
    async cancelOrder(orderId) {
        try {
            const response = await axios.post(`${this.apiUrl}/api/business/1.1/cancel-order`, { order_id: orderId }, {
                headers: this.headers
            });

            if (response.data.success) {
                return response.data;
            } else {
                throw new Error(response.data.errors?.join(', ') || 'Order cancellation failed');
            }
        } catch (error) {
            logger.error('cancelOrder error', { orderId, error: error.message });
            throw error;
        }
    }
}

module.exports = new BorzoService();
