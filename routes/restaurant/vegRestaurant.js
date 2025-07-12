const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/vegrestaurant/all
route.get('/all', (req, res) => {
    const query = "select * from vegrestaurant";
    connection.query(query, (err, result) => {
        if (err) return res.send("Error occured in get all restaurant", err).status(500);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/vegrestaurant/get/id/1
route.get('/get/id/:restaurant_id', (req, res) => {
    const query = "select * from vegrestaurant where res_id = ?";
    connection.query(query, [req.params.restaurant_id], (err, result) => {
        if (err) return res.send("Error occured in get restaurant by id", err).status(500);
        return res.send(result[0]).status(200);
    });
});

// http://localhost:3000/vegrestaurant/create
route.post("/create", (req, res) => {
    const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
    const query = "insert into vegrestaurant (res_name, res_rating, res_address, res_phone, res_img) values (?, ?, ?, ?, ?)";
    connection.query(query, [res_name, res_rating, res_address, res_phone, res_img], (err, result) => {
        if (err) return res.send("Error occured in create a restaurant.", err).status(500);
        return res.send(result).status(201);
    });
});

// http://localhost:3000/vegrestaurant/update/id/1
route.put("/update/id/:restaurant_id", (req, res) => {
    const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
    const restaurnt_id = req.params.restaurant_id;
    const query = "update vegrestaurant set res_name = ?, res_rating = ?, res_address = ?, res_phone = ?, res_img = ? where res_id = ?";
    connection.query(query, [res_name, res_rating, res_address, res_phone, res_img, restaurnt_id], (err, result) => {
        if (err) return res.send("Error occured in update a restaurant by  id.", err).status(500);
        return res.send(result).status(201);
    });
});

// http://localhost:3000/vegrestaurant/delete/id/1
route.delete('delete/id/:restaurant_id', (req, res) => {
    const query = "delete from vegrestaurant where res_id = ?";
    connection.query(query, [req.params.restaurant_id], (err, result) => {
        if (err) return res.send("error occured in delete restaurant by id : ", err).status(500);
        return res.send(result).status(200);
    })
})
module.exports = route