const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/nonvegrestaurant/all
route.get('/all', (req, res) => {
    const query = "select * from nonvegrestaurant";
    connection.query(query, (err, result) => {
        if (err) return res.send("Error occured in get all restaurant", err).status(500);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/nonvegrestaurant/get/id/1
route.get('/get/id/:restaurant_id', (req, res) => {
    const query = "select * from nonvegrestaurant where res_id = ?";
    connection.query(query, [req.params.restaurant_id], (err, result) => {
        if (err) return res.send("Error occured in get restaurant by id", err).status(500);
        return res.send(result[0]).status(200);
    });
});

// http://localhost:3000/nonvegrestaurant/create
route.post("/create", (req, res) => {
    const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
    const query = "insert into nonvegrestaurant (res_name, res_rating, res_address, res_phone, res_img) values (?, ?, ?, ?, ?)";
    connection.query(query, [res_name, res_rating, res_address, res_phone, res_img], (err, result) => {
        if (err) return res.send("Error occured in create a restaurant.", err).status(500);
        return res.send(result).status(201);
    });
});

// http://localhost:3000/nonvegrestaurant/update/id/1
route.put("/update/id/:restaurant_id", (req, res) => {
    const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
    const restaurnt_id = req.params.restaurant_id;
    const query = "update nonvegrestaurant set res_name = ?, res_rating = ?, res_address = ?, res_phone = ?, res_img = ? where res_id = ?";
    connection.query(query, [res_name, res_rating, res_address, res_phone, res_img, restaurnt_id], (err, result) => {
        if (err) return res.send("Error occured in update a restaurant by  id.", err).status(500);
        return res.send(result).status(201);
    });
});

// http://localhost:3000/nonvegrestaurant/delete/id/1
route.delete('delete/id/:restaurant_id', (req, res) => {
    const query = "delete from nonvegrestaurant where res_id = ?";
    connection.query(query, [req.params.restaurant_id], (err, result) => {
        if (err) return res.send("error occured in delete restaurant by id : ", err).status(500);
        return res.send(result).status(200);
    })
})
module.exports = route