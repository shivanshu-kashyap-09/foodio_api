const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/order/get/1
route.get('/get/:user_id', async (req, res) => {
    try {
        const cacheKey = `orderByUserId:${req.params.user_id}`;
        const cache = await redis.get(cacheKey);
        if(Cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM orders WHERE user_id = ?";
        connection.query(query, [req.params.user_id], async (err, result) => {
            if (err) {
                console.error("Error fetching orders:", err);
                return res.status(500).send("Internal Server Error");
            }
            if (result.length === 0) {
                return res.status(404).send("No orders found for this user");
            }
            await redis.set(cacheKey, JSON.stringify(result));
            return res.status(200).json(result);
        });
    } catch (error) {
        console.error("Unexpected error in GET /get/:user_id", error);
        res.status(500).send("Something went wrong");
    }
});

// http://localhost:3000/order/insert/1
route.post('/insert/:user_id', async (req, res) => {
    try {
        const { items, total, payment, delivery_status } = req.body;
        if (!items || !total || !payment || !delivery_status) {
            return res.status(400).send("Missing required order fields");
        }

        const query = "INSERT INTO orders (items, total, payment, delivery_status, user_id) VALUES (?, ?, ?, ?, ?)";
        connection.query(query, [items, total, payment, delivery_status, req.params.user_id], async (err, result) => {
            if (err) {
                console.error("Error inserting order:", err);
                return res.status(500).send("Failed to insert order");
            }

            const order_id = result.insertId;
            const cacheKey = `orderByUserId:${req.params.user_id}`;
            await redis.del(cacheKey);
            res.status(201).json({ message: "Order placed successfully", order_id });

            setTimeout(() => {
                const update = 'UPDATE orders SET delivery_status = "Delivered" WHERE user_id = ? AND order_id = ?';
                connection.query(update, [req.params.user_id, order_id], (e, r) => {
                    if (e) console.error("Error auto-updating delivery status:", e);
                    else console.log(`Order ${order_id} marked as Delivered`);
                });
            }, 60 * 1000);
        });
    } catch (error) {
        console.error("Unexpected error in POST /insert/:user_id", error);
        res.status(500).send("Something went wrong");
    }
});

// http://localhost:3000/order/update/1/1
route.put('/update/:user_id/:order_id', async (req, res) => {
    try {
        const { delivery_status } = req.body;
        if (!delivery_status) {
            return res.status(400).send("Delivery status is required");
        }

        const query = "UPDATE orders SET delivery_status = ? WHERE user_id = ? AND order_id = ?";
        connection.query(query, [delivery_status, req.params.user_id, req.params.order_id], async (err, result) => {
            if (err) {
                console.error("Error updating order:", err);
                return res.status(500).send("Failed to update order");
            }
            if (result.affectedRows === 0) {
                return res.status(404).send("Order not found");
            }
            const cacheKey = `orderByUserId:${req.params.user_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Order updated successfully" });
        });
    } catch (error) {
        console.error("Unexpected error in PUT /update/:user_id/:order_id", error);
        res.status(500).send("Something went wrong");
    }
});

// http://localhost:3000/order/delete/1/1
route.delete('/delete/:user_id/:order_id', async (req, res) => {
    try {
        const query = "DELETE FROM orders WHERE user_id = ? AND order_id = ?";
        connection.query(query, [req.params.user_id, req.params.order_id], async (err, result) => {
            if (err) {
                console.error("Error deleting order:", err);
                return res.status(500).send("Failed to delete order");
            }
            if (result.affectedRows === 0) {
                return res.status(404).send("Order not found");
            }
            const cacheKey = `orderByUserId:${req.params.user_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Order deleted successfully" });
        });
    } catch (error) {
        console.error("Unexpected error in DELETE /delete/:user_id/:order_id", error);
        res.status(500).send("Something went wrong");
    }
});

module.exports = route;
