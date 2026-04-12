const express = require('express');
const router = express.Router();
const paymentService = require('../../services/PaymentService');

/**
 * POST /api/razorpay/create-order
 * Create a new payment order
 */
router.post('/create-order', async (req, res) => {
    try {
        const { amount, currency, receipt, notes } = req.body;
        
        if (!amount) {
            return res.status(400).json({ success: false, message: 'Amount is required' });
        }

        const order = await paymentService.createOrder(amount, currency, receipt, notes);
        
        return res.status(201).json({
            success: true,
            data: order,
            keyId: paymentService.keyId // Send keyId for frontend
        });
    } catch (error) {
        console.error('[RazorpayRoute.createOrder] Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/razorpay/fetch-order/:orderId
 * Fetch order details
 */
router.get('/fetch-order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await paymentService.fetchOrder(orderId);
        return res.status(200).json({ success: true, data: order });
    } catch (error) {
        console.error('[RazorpayRoute.fetchOrder] Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/razorpay/verify-payment
 * Verify signature after successful payment
 */
router.post('/verify-payment', (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        const isValid = paymentService.verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);

        if (isValid) {
            return res.status(200).json({ success: true, message: 'Payment verified successfully' });
        } else {
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }
    } catch (error) {
        console.error('[RazorpayRoute.verifyPayment] Error:', error);
        return res.status(500).json({ success: false, message: 'Verification process failed' });
    }
});

module.exports = router;