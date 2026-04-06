const express = require('express');
const razorpay = require('razorpay');
const router = express.Router();

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// http://localhost:3000/razorpay/create-order
router.post('/create-order', async (req, res) => {
    const { amount, currency, receipt, notes } = req.body;
    const options = {
        amount: amount * 100, 
        currency: currency || 'INR',
        receipt: receipt || `rcptid_${Math.random().toString(36).substring(7)}`,
        notes: notes || {},
    };
    try {
        const order = await razorpayInstance.orders.create(options);
        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// http://localhost:3000/razorpay/fetch-order/:orderId
router.get('/fetch-order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await razorpayInstance.orders.fetch(orderId);
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// http://localhost:3000/razorpay/verify-payment
router.post('/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const crypto = require('crypto');
    const signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (signature === razorpay_signature) {
        res.status(200).json({ success: true });
    } else {
        res.status(400).json({ success: false });
    }
});
module.exports = router;