const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/southindianmenu/id/1
route.get("/id/:restaurant_id", async (req, res) => {
    try {
        const cacheKey = `southIndianMenu:${req.params.restaurant_id}`;
        const cache = await redis.get(cacheKey);
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM southindianmenu WHERE restaurant_id = ?";
        connection.query(query, [req.params.restaurant_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while fetching menu", details: err });
            await redis.set(cacheKey, JSON.stringify(result));
            return res.status(200).json(result);
        });
    } catch (error) {
        return res.status(500).json({ error: "Server error", details: error });
    }
});

// http://localhost:3000/southindianmenu/create/1
route.post('/create/:restaurant_id', async (req, res) => {
    try {
        const { dish_name, dish_price, dish_rating, dish_description, dish_image } = req.body;
        const restaurant_id = req.params.restaurant_id;
        const query = `
        INSERT INTO southindianmenu 
        (dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`;
        connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while creating menu", details: err });
            const cacheKey = `southIndianMenu:${restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(201).json({ message: "Dish added successfully", result });
        });
    } catch (error) {
        return res.status(500).json({ error: "Server error", details: error });
    }
});

// http://localhost:3000/southindianmenu/update/id/1/1
route.put('/update/id/:restaurant_id/:dish_id', async (req, res) => {
    try {
        const { dish_name, dish_price, dish_rating, dish_description, dish_image } = req.body;
        const { restaurant_id, dish_id } = req.params;
        const query = `
        UPDATE southindianmenu 
        SET dish_name = ?, dish_price = ?, dish_rating = ?, dish_description = ?, dish_image = ? 
        WHERE restaurant_id = ? AND dish_id = ?`;
        connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id, dish_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while updating menu", details: err });
            const cacheKey = `southIndianMenu:${restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Dish updated successfully", result });
        });
    } catch (error) {
        return res.status(500).json({ error: "Server error", details: error });
    }
});

// http://localhost:3000/southindianmenu/delete/dish/1/1
route.delete('/delete/dish/:restaurant_id/:dish_id', async (req, res) => {
    try {
        const { restaurant_id, dish_id } = req.params;
        const query = "DELETE FROM southindianmenu WHERE restaurant_id = ? AND dish_id = ?";
        connection.query(query, [restaurant_id, dish_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while deleting dish", details: err });
            const cacheKey = `southIndianMenu:${restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Dish deleted successfully", result });
        });
    } catch (error) {
        return res.status(500).json({ error: "Server error", details: error });
    }
});

// http://localhost:3000/southindianmenu/delete/menu/1
route.delete('/delete/menu/:restaurant_id', async (req, res) => {
    try {
        const restaurant_id = req.params.restaurant_id;
        const query = "DELETE FROM southindianmenu WHERE restaurant_id = ?";
        connection.query(query, [restaurant_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while deleting menu", details: err });
            const cacheKey = `southIndianMenu:${restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Menu deleted successfully", result });
        });
    } catch (error) {
        return res.status(500).json({ error: "Server error", details: error });
    }
});

module.exports = route;