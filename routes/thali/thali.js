const express = require('express');
const connection = require('../../db');
const redis = require("../../redis");
const route = express.Router();

// http://localhost:3000/thali/all
route.get('/all', async (req, res) => {
    try {
        const cache = await redis.get("thaliAll");
        if (cache) return res.status(200).json(JSON.parse(cache));

        connection.query('SELECT * FROM thali', async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while fetching thalis" });
            await redis.set("thaliAll", JSON.stringify(result));
            res.status(200).json(result);
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/thali/get/id/1
route.get('/get/id/:thali_id', async (req, res) => {
    const cacheKey = `thaliById:${req.params.thali_id}`;
    try {
        const cache = await redis.get(cacheKey);
        if (cache) return res.status(200).json(JSON.parse(cache));

        const query = 'SELECT * FROM thali WHERE thali_id = ?';
        connection.query(query, [req.params.thali_id], async (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while fetching thali" });
            if (result.length === 0) return res.status(404).json({ message: "Thali not found" });

            await redis.set(cacheKey, JSON.stringify(result[0]));
            res.status(200).json(result[0]);
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/thali/add
route.post('/add', async (req, res) => {
    const { restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img } = req.body;
    try {
        const query = "INSERT INTO thali (restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img) VALUES (?, ?, ?, ?, ?, ?, ?)";
        connection.query(query, [restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img], (err, result) => {
            if (err) return res.status(500).json({ error: "Error occurred while inserting thali" });
            redis.del("thaliAll");
            res.status(201).json({ message: "Thali added successfully", result });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/thali/update/id/:thali_id
route.put('/update/id/:thali_id', async (req, res) => {
    const { restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img } = req.body;
    const thaliId = req.params.thali_id;

    try {
        connection.query('SELECT * FROM thali WHERE thali_id = ?', [thaliId], (selectErr, selectResult) => {
            if (selectErr) return res.status(500).json({ error: "Error fetching thali" });
            if (selectResult.length === 0) return res.status(404).json({ message: "Thali not found" });

            const updateQuery = 'UPDATE thali SET restaurant_id = ?, restaurant_name = ?, description = ?, price = ?, rating = ?, thali_name = ?, thali_img = ? WHERE thali_id = ?';
            connection.query(updateQuery, [restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img, thaliId], (err, result) => {
                if (err) return res.status(500).json({ error: "Error updating thali" });
                redis.del("thaliAll");
                redis.del(`thaliById:${thaliId}`);
                res.status(200).json({ message: "Thali updated successfully" });
            });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// http://localhost:3000/thali/delete/id/:thali_id
route.delete('/delete/id/:thali_id', async (req, res) => {
    const thaliId = req.params.thali_id;

    try {
        const query = 'DELETE FROM thali WHERE thali_id = ?';
        connection.query(query, [thaliId], (err, result) => {
            if (err) return res.status(500).json({ error: "Error deleting thali" });

            redis.del("thaliAll");
            redis.del(`thaliById:${thaliId}`);
            res.status(200).json({ message: "Thali deleted successfully" });
        });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = route;