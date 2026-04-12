const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/config');

const razorpayInstance = new Razorpay({
    key_id: config.payments.razorpay.keyId,
    key_secret: config.payments.razorpay.keySecret,
});

/**
 * Create a new Razorpay order
 * @param {number} amount - Amount in INR
 * @param {string} currency - Currency code
 * @param {string} receipt - Receipt ID
 * @param {Object} notes - Additional notes
 * @returns {Promise<Object>} Order object
 */
async function createOrder(amount, currency = 'INR', receipt = null, notes = {}) {
    try {
        const options = {
            amount: Math.round(amount * 100), // convert to paisa
            currency,
            receipt: receipt || `rcptid_${Math.random().toString(36).substring(7)}`,
            notes,
        };

        const order = await razorpayInstance.orders.create(options);
        return order;
    } catch (error) {
        console.error('[PaymentService.createOrder] Error:', error);
        throw new Error('Payment initialization failed');
    }
}

/**
 * Fetch order details from Razorpay
 * @param {string} orderId - Razorpay order ID
 * @returns {Promise<Object>} Order details
 */
async function fetchOrder(orderId) {
    try {
        const order = await razorpayInstance.orders.fetch(orderId);
        return order;
    } catch (error) {
        console.error('[PaymentService.fetchOrder] Error:', error);
        throw new Error('Failed to fetch order details');
    }
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {boolean} Verification status
 */
function verifyPayment(orderId, paymentId, signature) {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', config.payments.razorpay.keySecret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        return expectedSignature === signature;
    } catch (error) {
        console.error('[PaymentService.verifyPayment] Error:', error);
        return false;
    }
}

module.exports = {
    createOrder,
    fetchOrder,
    verifyPayment,
    keyId: config.payments.razorpay.keyId
};
