const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
const route = express.Router();

// http://localhost:3000/vegmenu/restaurant/1
route.get("/restaurant/:restaurant_id", async (req, res) => {
    try {
        const { restaurant_id } = req.params;
        const cacheKey = `vegMenu:${restaurant_id}`;
        const cache = await redis.get(cacheKey);
        if(cache) return res.status(200).json(JSON.parse(cache));
        const query = "SELECT * FROM vegmenu WHERE restaurant_id = ?";
        connection.query(query, [restaurant_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while fetching menu");
            if (result.length === 0) return res.status(404).send("No menu found");
            await redis.set(cacheKey, JSON.stringify(result));
            res.status(200).send(result);
        });
    } catch (err) {
        res.status(500).send("Server error");
    }
});

// http://localhost:3000/vegmenu/restaurant/1/create
route.post("/restaurant/:restaurant_id/create", async (req, res) => {
    try {
        const { dish_name, dish_price, dish_rating, dish_description, dish_image } = req.body;
        const { restaurant_id } = req.params;
        const query = `
        INSERT INTO vegmenu (dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id)
        VALUES (?, ?, ?, ?, ?, ?)
        `;
        connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while creating menu");
            const cacheKey = `vegMenu:${restaurant_id}`;
            await redis.del(cacheKey);
            res.status(201).send(result);
        });
    } catch (err) {
        res.status(500).send("Server error");
    }
});

// http://localhost:3000/vegmenu/restaurant/1/update/1
route.put("/restaurant/:restaurant_id/update/:dish_id", async (req, res) => {
    try {
        const { dish_name, dish_price, dish_rating, dish_description, dish_image } = req.body;
        const { restaurant_id, dish_id } = req.params;
        const query = `
        UPDATE vegmenu SET dish_name = ?, dish_price = ?, dish_rating = ?, dish_description = ?, dish_image = ?
        WHERE restaurant_id = ? AND dish_id = ?
        `;
        connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id, dish_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while updating dish");
            const cacheKey = `vegMenu:${restaurant_id}`;
            await redis.del(cacheKey);
            res.status(200).send(result);
        });
    } catch (err) {
        res.status(500).send("Server error");
    }
});

// http://localhost:3000/vegmenu/restaurant/1/delete/1
route.delete("/restaurant/:restaurant_id/delete/:dish_id", async (req, res) => {
    try {
        const { restaurant_id, dish_id } = req.params;
        const query = "DELETE FROM vegmenu WHERE restaurant_id = ? AND dish_id = ?";
        connection.query(query, [restaurant_id, dish_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while deleting dish");
            const cacheKey = `vegMenu:${restaurant_id}`;
            await redis.del(cacheKey);
            res.status(200).send("Dish deleted successfully");
        });
    } catch (err) {
        res.status(500).send("Server error");
    }
});

// http://localhost:3000/vegmenu/restaurant/1/deleteall
route.delete("/restaurant/:restaurant_id/deleteall", async (req, res) => {
    try {
        const { restaurant_id } = req.params;
        const query = "DELETE FROM vegmenu WHERE restaurant_id = ?";
        connection.query(query, [restaurant_id], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while deleting menu");
            const cacheKey = `vegMenu:${restaurant_id}`;
            await redis.del(cacheKey);
            res.status(200).send("Menu deleted successfully");
        });
    } catch (err) {
        res.status(500).send("Server error");
    }
});

module.exports = route;