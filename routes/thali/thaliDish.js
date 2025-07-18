const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/thalidish/thali/1
route.get('/thali/:thali_id', async (req, res) => {
    try {
        const thali_id = req.params.thali_id;
        const cacheKey = `thaliDish:${thali_id}`;
        const cache = await redis.get(cacheKey);
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM thali_dishes WHERE thali_id = ?";
        connection.query(query, [thali_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while fetching thali dishes" });
            await redis.set(cacheKey, JSON.stringify(result));
            res.status(200).json(result);
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/thaidish/create/1
route.post('/create/:thali_id', async (req, res) => {
    try {
        const { dish_name, qty } = req.body;
        const thali_id = req.params.thali_id;
        const query = 'INSERT INTO thali_dishes (dish_name, qty, thali_id) VALUES (?, ?, ?)';
        connection.query(query, [dish_name, qty, thali_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while creating dish" });
            const cacheKey = `thaliDish:${thali_id}`;
            await redis.del(cacheKey);
            res.status(201).json({ message: "Dish added successfully", result });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/thaidish/update/1/1
route.put('/update/:thali_id/:thali_dishe_id', async (req, res) => {
    try {
        const { dish_name, qty } = req.body;
        const thali_id = req.params.thali_id;
        const thali_dish_id = req.params.thali_dishe_id;
        const query = "UPDATE thali_dishes SET dish_name = ?, qty = ? WHERE thali_id = ? AND thali_dishe_id = ?";
        connection.query(query, [dish_name, qty, thali_id, thali_dish_id],async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while updating dish" });
            const cacheKey = `thaliDish:${thali_id}`;
            await redis.del(cacheKey);
            res.status(200).json({ message: "Dish updated successfully", result });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/thaidish/delete/dish/1/1
route.delete('/delete/dish/:thali_id/:thali_dishe_id', async (req, res) => {
    try {
        const thali_id = req.params.thali_id;
        const thali_dish_id = req.params.thali_dishe_id;
        const query = "DELETE FROM thali_dishes WHERE thali_id = ? AND thali_dishe_id = ?";
        connection.query(query, [thali_id, thali_dish_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while deleting dish" });
            const cacheKey = `thaliDish:${thali_id}`;
            await redis.del(cacheKey);
            res.status(200).json({ message: "Dish deleted successfully" });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/thaidish/delete/1
route.delete('/delete/:thali_id', async (req, res) => {
    try {
        const thali_id = req.params.thali_id;
        const query = "DELETE FROM thali_dishes WHERE thali_id = ?";
        connection.query(query, [thali_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while deleting all dishes for thali" });
            const cacheKey = `thaliDish:${thali_id}`;
            await redis.del(cacheKey);
            res.status(200).json({ message: "All dishes for thali deleted successfully" });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = route;