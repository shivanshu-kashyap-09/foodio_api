const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/whishlist/get/1
route.get('/get/:user_id', (req, res) => {
    const query = "select * from whishlist where user_id = ?";
    connection.query(query, [req.params.user_id], (err, result) => {
        if(err) return res.send("Error occured in get whishlist : "+err).status(404);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/whishlist/insert/1
route.post('/insert/:user_id', (req, res) => {
    const { dish_img, dish_name, dish_price, dish_description } = req.body;
    if (!dish_img || !dish_name || !dish_price || !dish_description) {
        return res.status(400).send("Missing dish data in request body");
    }
    const query = "INSERT INTO whishlist (user_id, dish_img, dish_name, dish_price, dish_description) VALUES (?, ?, ?, ?, ?)";
    connection.query(query, [req.params.user_id, dish_img, dish_name, dish_price, dish_description], (err, result) => {
        if (err) return res.status(500).send("Error occurred in insert: " + err.message);
        return res.status(201).send(result);
    });
});

// http://localhost:3000/whishlist/delete/1
route.delete('/delete/:user_id', (req, res) => {
    const { dish_name } = req.body;
    const query = "DELETE FROM whishlist WHERE user_id = ? AND dish_name = ?";
    connection.query(query, [req.params.user_id, dish_name], (err, result) => {
        if (err) return res.status(500).send("Error occurred in delete dish: " + err);
        return res.status(200).send(result);
    });
});


module.exports = route;