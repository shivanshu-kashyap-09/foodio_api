const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/southindianrestaurants/all
route.get('/all', async (req, res) => {
    try {
        const cache = await redis.get("southIndianRestaurantAll");
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM southindianrestaurants";
        connection.query(query, async (err, result) => {
            if (err) throw err;
            if (result.length === 0) {
                return res.status(404).json({ message: "No restaurants found" });
            }
            await redis.set("southIndianRestaurantAll", JSON.stringify(result));
            return res.status(200).json(result);
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error", error });
    }
});

// http://localhost:3000/southindianrestaurants/get/id/1
route.get('/get/id/:restaurant_id', async (req, res) => {
    try {
        const cacheKey = `southIndianRestaurant:${req.params.restaurant_id}`;
        const cache = await redis.get(cacheKey);
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM southindianrestaurants WHERE res_id = ?";
        connection.query(query, [req.params.restaurant_id], async (err, result) => {
            if (err) throw err;
            if (result.length === 0) {
                return res.status(404).json({ message: "Restaurant not found with the given ID" });
            }
            await redis.set(cacheKey, JSON.stringify(result[0]));
            return res.status(200).json(result[0]);
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error", error });
    }
});

// http://localhost:3000/southindianrestaurants/create
route.post('/create', async (req, res) => {
    try {
        const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
        if (!res_name || !res_rating || !res_address || !res_phone || !res_img) {
            return res.status(400).json({ message: "All fields are required" });
        }
        
        const query = `
        INSERT INTO southindianrestaurants (res_name, res_rating, res_address, res_phone, res_img)
        VALUES (?, ?, ?, ?, ?)
        `;
        connection.query(query, [res_name, res_rating, res_address, res_phone, res_img], async (err, result) => {
            if (err) throw err;
            await redis.del("southIndianRestaurantAll");
            return res.status(201).json({ message: "Restaurant created successfully", insertId: result.insertId });
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error", error });
    }
});

// http://localhost:3000/southindianrestaurants/update/id/1
route.put('/update/id/:restaurant_id', async (req, res) => {
    try {
        const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
        const restaurant_id = req.params.restaurant_id;
        const query = `
        UPDATE southindianrestaurants
        SET res_name = ?, res_rating = ?, res_address = ?, res_phone = ?, res_img = ?
        WHERE res_id = ?
        `;
        connection.query(query, [res_name, res_rating, res_address, res_phone, res_img, restaurant_id], async (err, result) => {
            if (err) throw err;
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Restaurant not found for update" });
            }
            const cacheKey = `southIndianRestaurant:${restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Restaurant updated successfully" });
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error", error });
    }
});

// http://localhost:3000/southindianrestaurants/delete/id/1
route.delete('/delete/id/:restaurant_id', async (req, res) => {
    try {
        const query = "DELETE FROM southindianrestaurants WHERE res_id = ?";
        connection.query(query, [req.params.restaurant_id], async (err, result) => {
            if (err) throw err;
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Restaurant not found for deletion" });
            }
            const cacheKey = `southIndianRestaurant:${req.params.restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Restaurant deleted successfully" });
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error", error });
    }
});

module.exports = route;
