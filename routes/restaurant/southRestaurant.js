const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/southindianrestaurants/all
route.get('/all', (req, res) => {
    const query = "select * from southindianrestaurants";
    connection.query(query, (err, result) => {
        if (err) return res.send("Error occured in get all restaurant", err).status(500);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/southindianrestaurants/get/id/1
route.get('/get/id/:restaurant_id', (req, res) => {
    const query = "select * from southindianrestaurants where res_id = ?";
    connection.query(query, [req.params.restaurant_id], (err, result) => {
        if (err) return res.send("Error occured in get restaurant by id", err).status(500);
        return res.send(result[0]).status(200);
    });
});

// http://localhost:3000/southindianrestaurants/create
route.post("/create", (req, res) => {
    const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
    const query = "insert into southindianrestaurants (res_name, res_rating, res_address, res_phone, res_img) values (?, ?, ?, ?, ?)";
    connection.query(query, [res_name, res_rating, res_address, res_phone, res_img], (err, result) => {
        if (err) return res.send("Error occured in create a restaurant.", err).status(500);
        return res.send(result).status(201);
    });
});

// http://localhost:3000/southindianrestaurants/update/id/1
route.put("/update/id/:restaurant_id", (req, res) => {
    const { res_name, res_rating, res_address, res_phone, res_img } = req.body;
    const restaurnt_id = req.params.restaurant_id;
    const query = "update southindianrestaurants set res_name = ?, res_rating = ?, res_address = ?, res_phone = ?, res_img = ? where res_id = ?";
    connection.query(query, [res_name, res_rating, res_address, res_phone, res_img, restaurnt_id], (err, result) => {
        if (err) return res.send("Error occured in update a restaurant by  id.", err).status(500);
        return res.send(result).status(201);
    });
});

// http://localhost:3000/southindianrestaurants/delete/id/1
route.delete('delete/id/:restaurant_id', (req, res) => {
    const query = "delete from southindianrestaurants where res_id = ?";
    connection.query(query, [req.params.restaurant_id], (err, result) => {
        if (err) return res.send("error occured in delete restaurant by id : ", err).status(500);
        return res.send(result).status(200);
    })
})
module.exports = route