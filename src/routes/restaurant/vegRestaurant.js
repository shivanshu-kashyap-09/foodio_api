const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/vegrestaurant/all
route.get('/all', async (req, res) => {
    try {
        const cache = await redis.get("vegRestaurantAll");
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM vegrestaurant";
        connection.query(query, async (err, result) => {
            if (err) return res.status(500).send("Error occurred while fetching all restaurants.");
            await redis.set("vegRestaurantAll", JSON.stringify(result));
            return res.status(200).json(result);
        });
    } catch (error) {
        return res.status(500).send("Internal server error.");
    }
});

// http://localhost:3000/vegrestaurant/get/id/1
route.get('/get/id/:restaurant_id', async (req, res) => {
    try {
        const cacheKey = `vegRestaurant:${req.params.restaurant_id}`;
        const cache = redis.get(cacheKey);
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM vegrestaurant WHERE res_id = ?";
        connection.query(query, [req.params.restaurant_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while fetching restaurant by ID.");
            if (result.length === 0) return res.status(404).send("Restaurant not found.");
            await redis.set(cacheKey, JSON.stringify(result[0]));
            return res.status(200).json(result[0]);
        });
    } catch (error) {
        return res.status(500).send("Internal server error.");
    }
});

// http://localhost:3000/vegrestaurant/create
route.post("/create", async (req, res) => {
    try {
        const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
        const query = "INSERT INTO vegrestaurant (res_name, res_rating, res_address, res_phone, res_img) VALUES (?, ?, ?, ?, ?)";
        connection.query(query, [res_name, res_rating, res_address, res_phone, res_img], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while creating the restaurant.");
            await redis.del("vegRestaurantAll");
            return res.status(201).json({ message: "Restaurant created successfully.", id: result.insertId });
        });
    } catch (error) {
        return res.status(500).send("Internal server error.");
    }
});

// http://localhost:3000/vegrestaurant/update/id/1
route.put("/update/id/:restaurant_id", async (req, res) => {
    try {
        const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
        const restaurant_id = req.params.restaurant_id;
        const query = "UPDATE vegrestaurant SET res_name = ?, res_rating = ?, res_address = ?, res_phone = ?, res_img = ? WHERE res_id = ?";
        connection.query(query, [res_name, res_rating, res_address, res_phone, res_img, restaurant_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while updating the restaurant.");
            if (result.affectedRows === 0) return res.status(404).send("Restaurant not found for update.");
            const cacheKey = `vegRestaurant:${restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Restaurant updated successfully." });
        });
    } catch (error) {
        return res.status(500).send("Internal server error.");
    }
});

// http://localhost:3000/vegrestaurant/delete/id/1
route.delete('/delete/id/:restaurant_id', async (req, res) => {
    try {
        const query = "DELETE FROM vegrestaurant WHERE res_id = ?";
        connection.query(query, [req.params.restaurant_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while deleting the restaurant.");
            if (result.affectedRows === 0) return res.status(404).send("Restaurant not found for deletion.");
            const cacheKey = `vegRestaurant:${req.params.restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: "Restaurant deleted successfully." });
        });
    } catch (error) {
        return res.status(500).send("Internal server error.");
    }
});

module.exports = route;
