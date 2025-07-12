const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/cart/get/1
route.get('/get/:user_id', (req, res) => {
    const query = "select * from cart where user_id = ?";
    connection.query(query, [req.params.user_id], (err, result) => {
        if(err) return res.status(500).send("Error occured while get the cart : "+err);
        return res.status(200).send(result);
    });
});

// http://localhost:3000/cart/insert/1
route.post('/insert/:user_id', (req,res) => {
    const {dish_img, dish_name, dish_price, dish_description, dish_qty} = req.body;
    const query = "insert into cart (dish_img, dish_name, dish_price, dish_description, dish_qty, user_id) values (?, ?, ?, ?, ?, ?)";
    connection.query(query, [dish_img, dish_name, dish_price, dish_description, dish_qty, req.params.user_id], (err, result) => {
        if(err) return res.status(500).send("Error occured while insert in cart"+err);
        return res.status(201).send(result);
    });
});

// http://localhost:3000/cart/update/1
route.put('/update/:user_id', (req, res) => {
    const {dish_name, dish_qty} = req.body;
    const query = "update cart set dish_qty = ? where user_id = ? and dish_name = ?";
    connection.query(query, [dish_qty, req.params.user_id, dish_name], (err, result) => {
        if(err) return res.status(500).send("Error occured in update the dish : "+err);
        return res.status(200).send(result);
    });
});

// http://localhost:3000/cart/delete/id/1
route.delete('/delete/id/:user_id', (req, res) => {
    const {dish_name} = req.body;
    const query = "delete from cart where user_id = ? and dish_name =?";
    connection.query(query, [req.params.user_id, dish_name], (err, result) => {
        if(err) return res.status(500).send("Error occured in delete dish : "+err);
        return res.status(200).send(result);
    });
});

// http://localhost:3000/cart/delete/all/1
route.delete('/delete/all/:user_id', (req, res) => {
    const query = "delete from cart where user_id = ?";
    connection.query(query, [req.params.user_id], (err, result) => {
        if(err) return res.status(500).send("Error occured in delete all dishes : "+err);
        return res.status(200).send(result);
    })
})

module.exports = route;