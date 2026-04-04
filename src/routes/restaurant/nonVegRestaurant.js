const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/nonvegrestaurant/all
route.get('/all', async (req, res) => {
    try {
        const cache = await redis.get("nonVegRestaurantAll");
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM nonvegrestaurant";
        connection.query(query, async (err, result) => {
            if (err) return res.status(500).send("Error occurred while fetching all restaurants.");
            if (!result.length) return res.status(404).send("No restaurants found.");
            await redis.set("nonVegRestaurantAll", JSON.stringify(result));
            return res.status(200).send(result);
        });
    } catch {
        return res.status(500).send("Internal server error.");
    }
});

// http://localhost:3000/nonvegrestaurant/get/id/1
route.get('/get/id/:restaurant_id', async (req, res) => {
    try {
        const cacheKey = `nonVegRestaurant:${req.params.restaurant_id}`;
        const cache = await redis.get(cacheKey);
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM nonvegrestaurant WHERE res_id = ?";
        connection.query(query, [req.params.restaurant_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while fetching the restaurant.");
            if (!result.length) return res.status(404).send("Restaurant not found.");
            await redis.set(cacheKey, JSON.stringify(result[0]));
            return res.status(200).send(result[0]);
        });
    } catch {
        return res.status(500).send("Internal server error.");
    }
});

// http://localhost:3000/nonvegrestaurant/create
route.post('/create', async (req, res) => {
    try {
        const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
        if (!res_name || !res_rating || !res_address || !res_phone || !res_img)
            return res.status(400).send("All fields are required.");
        const query = "INSERT INTO nonvegrestaurant (res_name, res_rating, res_address, res_phone, res_img) VALUES (?, ?, ?, ?, ?)";
        connection.query(query, [res_name, res_rating, res_address, res_phone, res_img], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while creating the restaurant.");
            await redis.del("nonVegRestaurantAll");
            return res.status(201).send({ message: "Restaurant created successfully", id: result.insertId });
        });
    } catch {
        return res.status(500).send("Internal server error.");
    }
});

// http://localhost:3000/nonvegrestaurant/update/id/1
route.put('/update/id/:restaurant_id', async (req, res) => {
    try {
        const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
        const restaurant_id = req.params.restaurant_id;
        const query = "UPDATE nonvegrestaurant SET res_name = ?, res_rating = ?, res_address = ?, res_phone = ?, res_img = ? WHERE res_id = ?";
        connection.query(query, [res_name, res_rating, res_address, res_phone, res_img, restaurant_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while updating the restaurant.");
            if (result.affectedRows === 0) return res.status(404).send("Restaurant not found.");
            const cacheKey = `nonVegRestaurant:${restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(200).send({ message: "Restaurant updated successfully." });
        });
    } catch {
        return res.status(500).send("Internal server error.");
    }
});

// http://localhost:3000/nonvegrestaurant/delete/id/1
route.delete('/delete/id/:restaurant_id', async (req, res) => {
    try {
        const query = "DELETE FROM nonvegrestaurant WHERE res_id = ?";
        connection.query(query, [req.params.restaurant_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while deleting the restaurant.");
            if (result.affectedRows === 0) return res.status(404).send("Restaurant not found.");
            const cacheKey = `nonVegRestaurant:${req.params.restaurant_id}`;
            await redis.del(cacheKey);
            return res.status(200).send({ message: "Restaurant deleted successfully." });
        });
    } catch {
        return res.status(500).send("Internal server error.");
    }
});

module.exports = route;