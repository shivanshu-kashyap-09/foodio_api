const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/nonvegmenu/id/1
route.get("/id/:restaurant_id", async (req, res) => {
    try {
        const cacheKey = `nonVegMenu:${req.params.restaurant_id}`;
        const cache = await redis.get(cacheKey);
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM nonvegmenu WHERE restaurant_id = ?";
        connection.query(query, [req.params.restaurant_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while fetching menu" });
            await redis.set(cacheKey, JSON.stringify(result));
            res.status(200).json(result);
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/nonvegmenu/create/1
route.post('/create/:restaurant_id', async (req, res) => {
    try {
        const { dish_name, dish_price, dish_rating, dish_description, dish_image } = req.body;
        const res_id = req.params.restaurant_id;
        const query = "INSERT INTO nonvegmenu (dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)";
        connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, res_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while creating menu" });
            const cacheKey = `nonVegMenu:${res_id}`;
            await redis.del(cacheKey);
            res.status(201).json({ message: "Dish added successfully", result });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/nonvegmenu/update/id/1/1
route.put('/update/id/:restaurant_id/:dish_id', async (req, res) => {
    try {
        const { dish_name, dish_price, dish_rating, dish_description, dish_image } = req.body;
        const restaurant_id = req.params.restaurant_id;
        const dish_id = req.params.dish_id;
        const query = "UPDATE nonvegmenu SET dish_name = ?, dish_price = ?, dish_rating = ?, dish_description = ?, dish_image = ? WHERE restaurant_id = ? AND dish_id = ?";
        connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id, dish_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while updating dish" });
            const cacheKey = `nonVegMenu:${res_id}`;
            await redis.del(cacheKey);
            res.status(200).json({ message: "Dish updated successfully", result });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/nonvegmenu/delete/dish/1/1
route.delete('/delete/dish/:restaurant_id/:dish_id', async (req, res) => {
    try {
        const query = 'DELETE FROM nonvegmenu WHERE restaurant_id = ? AND dish_id = ?';
        connection.query(query, [req.params.restaurant_id, req.params.dish_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while deleting dish" });
            const cacheKey = `nonVegMenu:${req.params.restaurant_id}`;
            await redis.del(cacheKey);
            res.status(200).json({ message: "Dish deleted successfully" });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/nonvegmenu/delete/menu/1
route.delete('/delete/menu/:restaurant_id', async (req, res) => {
    try {
        const query = 'DELETE FROM nonvegmenu WHERE restaurant_id = ?';
        connection.query(query, [req.params.restaurant_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while deleting menu" });
            const cacheKey = `nonVegMenu:${req.params.restaurant_id}`;
            await redis.del(cacheKey);
            res.status(200).json({ message: "Menu deleted successfully" });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = route;