const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/cart/get/1
route.get('/get/:user_id', async (req, res) => {
    try {
        const cacheKey = `cartByUserId:${req.params.user_id}`;
        const cache = await redis.get(cacheKey);
        if(cache) return res.status(200).json(JSON.parse(cache)); 
        const query = "SELECT * FROM cart WHERE user_id = ?";
        connection.query(query, [req.params.user_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while fetching the cart: " + err);
            if (result.length === 0) return res.status(404).send("No cart items found for the user.");
            await redis.set(cacheKey, JSON.stringify(result));
            return res.status(200).json(result);
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error: " + error.message);
    }
});

// http://localhost:3000/cart/insert/1
route.post('/insert/:user_id', async (req, res) => {
    try {
        const { dish_img, dish_name, dish_price, dish_description, dish_qty } = req.body;
        if (!dish_img || !dish_name || !dish_price || !dish_description || !dish_qty) {
            return res.status(400).send("Missing required fields.");
        }

        const query = `INSERT INTO cart 
                       (dish_img, dish_name, dish_price, dish_description, dish_qty, user_id) 
                       VALUES (?, ?, ?, ?, ?, ?)`;

        connection.query(query, [dish_img, dish_name, dish_price, dish_description, dish_qty, req.params.user_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while inserting in cart: " + err);
            const cacheKey = `cartByUserId:${req.params.user_id}`;
            await redis.del(cacheKey);
            return res.status(201).json({ message: "Item added to cart", result });
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error: " + error.message);
    }
});

// http://localhost:3000/cart/update/1
route.put('/update/:user_id', async (req, res) => {
    try {
        const { dish_name, dish_qty } = req.body;
        if (!dish_name || !dish_qty) {
            return res.status(400).send("Missing dish_name or dish_qty.");
        }

        const query = "UPDATE cart SET dish_qty = ? WHERE user_id = ? AND dish_name = ?";
        connection.query(query, [dish_qty, req.params.user_id, dish_name], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while updating the dish: " + err);
            if (result.affectedRows === 0) return res.status(404).send("Dish not found in cart.");
            const cacheKey = `cartByUserId:${req.params.user_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Cart updated successfully", result });
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error: " + error.message);
    }
});

// http://localhost:3000/cart/delete/id/1
route.delete('/delete/id/:user_id', async (req, res) => {
    try {
        const { dish_name } = req.body;
        if (!dish_name) return res.status(400).send("dish_name is required.");

        const query = "DELETE FROM cart WHERE user_id = ? AND dish_name = ?";
        connection.query(query, [req.params.user_id, dish_name], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while deleting dish: " + err);
            if (result.affectedRows === 0) return res.status(404).send("Dish not found in cart.");
            const cacheKey = `cartByUserId:${req.params.user_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Dish removed from cart", result });
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error: " + error.message);
    }
});

// http://localhost:3000/cart/delete/all/1
route.delete('/delete/all/:user_id', async (req, res) => {
    try {
        const query = "DELETE FROM cart WHERE user_id = ?";
        connection.query(query, [req.params.user_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while deleting all dishes: " + err);
            if (result.affectedRows === 0) return res.status(404).send("No items found in cart to delete.");
            const cacheKey = `cartByUserId:${req.params.user_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "All cart items deleted", result });
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error: " + error.message);
    }
});

module.exports = route;