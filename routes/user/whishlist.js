const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/whishlist/get/1
route.get('/get/:user_id', async (req, res) => {
    try {
        const cacheKey = `whishLishByUserId:${req.params.user_id}`;
        const cache = await redis.get(cacheKey);
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM whishlist WHERE user_id = ?";
        connection.query(query, [req.params.user_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while fetching wishlist: " + err);
            if (result.length === 0) return res.status(404).send("Wishlist not found for user.");
            await redis.set(cacheKey, JSON.stringify(result));
            return res.status(200).json(result);
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error");
    }
});

// http://localhost:3000/whishlist/insert/1
route.post('/insert/:user_id', async (req, res) => {
    try {
        const { dish_img, dish_name, dish_price, dish_description } = req.body;
        if (!dish_img || !dish_name || !dish_price || !dish_description) {
            return res.status(400).send("Missing dish data in request body");
        }

        const query = "INSERT INTO whishlist (user_id, dish_img, dish_name, dish_price, dish_description) VALUES (?, ?, ?, ?, ?)";
        connection.query(query, [req.params.user_id, dish_img, dish_name, dish_price, dish_description], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while inserting wishlist item: " + err);
            const cacheKey = `whishLishByUserId:${req.params.user_id}`;
            await redis.del(cacheKey);
            return res.status(201).send("Wishlist item added successfully");
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error");
    }
});

// http://localhost:3000/whishlist/delete/1
route.delete('/delete/:user_id', async (req, res) => {
    try {
        const { dish_name } = req.body;
        if (!dish_name) {
            return res.status(400).send("Dish name is required to delete an item");
        }

        const query = "DELETE FROM whishlist WHERE user_id = ? AND dish_name = ?";
        connection.query(query, [req.params.user_id, dish_name], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while deleting wishlist item: " + err);
            if (result.affectedRows === 0) return res.status(404).send("No such dish found in wishlist");
            const cacheKey = `whishLishByUserId:${req.params.user_id}`;
            await redis.del(cacheKey);
            return res.status(200).send("Wishlist item deleted successfully");
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error");
    }
});

module.exports = route;
