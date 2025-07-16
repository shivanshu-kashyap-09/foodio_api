const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/thalidish/thali/1
route.get('/thali/:thali_id', (req, res) => {
    const thali_id = req.params.thali_id;
    const query = "SELECT * FROM thali_dishes WHERE thali_id = ?";
    connection.query(query, [thali_id], (err, result) => {
        if (err) return res.status(500).send("Error occurred in getting the thali dishes: " + err);
        return res.status(200).send(result);
    });
});


// http://localhost:3000/thaidish/create/1
route.post('/create/:thali_id', (req, res) => {
    const {dish_name, qty} = req.body;
    const thali_id = req.params.thali_id;
    const query = 'insert into thali_dishes (dish_name, qty, thali_id) values (?, ?, ?)';
    connection.query(query, [dish_name, qty, thali_id], (err, result) => {
        if(err) return res.send("Error occured in create a dish", err).status(500);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/thaidish/update/1/1
route.put('/update/:thali_id/:thali_dishe_id', (req, res) => {
    const {dish_name, qty} = req.body;
    const thali_id = req.params.thali_id;
    const thali_dish_id = req.params.thali_dishe_id;
    const query = "update thali_dishes set dish_name = ?, qty = ? where thali_id = ? & thali_dishe_id = ?";
    connection.query(query, [dish_name, qty, thali_id, thali_dish_id], (err, result) => {
        if(err) return res.send("error occured in thali dish").status(500);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/thaidish/delete/dish/1/1
route.delete('/delete/dish/:thali_id/:thali_dishe_id', (req, res) => {
    const thali_id = req.params.thali_id;
    const thali_dish_id = req.params.thali_dishe_id;
    const query = "delete from thali_dishes where thali_id = ? & thali_dishe_id = ?";
    connection.query(query, [thali_id, thali_dish_id], (err, result) => {
        if(err) return res.send("error occured in delete thali dish", err).status(500);
        return res.send("Delete successfully").status(200);
    });
});

// http://localhost:3000/thaidish/delete/1
route.delete('/delete/:thali_id', (req, res) => {
    const thali_id = req.params.thali_id;
    const query = "delete from thali_dishes where thali_id = ?";
    connection.query(query, [thali_id], (err, result) => {
        if(err) return res.send("error occured in delete thali dishes", err).status(500);
        return res.send("Delete successfully").status(200);
    });
});

module.exports = route;