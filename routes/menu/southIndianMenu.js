const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/southindianmenu/id/1
route.get("/id/:restaurnt_id", (req, res) => {
    const query = "select * from southindianmenu where restaurant_id = ?";
    connection.query(query, [req.params.restaurnt_id], (err, result) => {
        if(err) return res.send("Error occured in get menu by restaurant id : ",err).status(500);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/southindianmenu/create/1
route.post('/create/:restaurant_id', (req, res) => {
    const {dish_name, dish_price, dish_rating, dish_description, dish_image} = req.body;
    const res_id = req.params.restaurant_id;
    const query = "insert into southindianmenu (dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id) values (?, ?, ?, ?, ?, ?)";
    connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, res_id], (err, result) => {
        if(err) return res.send("error occured in create a menu : ",err).status(500);
        return res.send(result).status(201);
    });
});

// http://localhost:3000/southindianmenu/update/id/1/1
route.put('/update/id/:restaurant_id/:dish_id', (req, res) => {
    const {dish_name, dish_price, dish_rating, dish_description, dish_image} = req.body;
    const restaurant_id = req.params.restaurant_id;
    const dish_id = req.params.dish_id;
    const query = "update southindianmenu set dish_name = ?, dish_price = ?, dish_rating = ?, dish_description = ?, dish_image = ? where restaurant_id = ? & dish_id = ?";
    connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id, dish_id], (err, result) => {
        if(err) return res.send("error occured in update a menu : ",err).status(500);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/southindianmenu/delete/dish/1/1
route.delete('/delete/dish/:resturant_id/:dish_id', (req, res) => {
    const query = 'delete from southindianmenu where resturant_id = ? & dish_id = ?';
    connection.query(query, [req.params.resturant_id, req.params.dish_id], (err, result) => {
        if(err) return res.send("Error occured while delete dish.",err).status(500);
        return res.send('dish deleted successfully').status(200);
    });
});

// http://localhost:3000/southindianmenu/delete/menu/1
route.delete('/delete/menu/:resturant_id', (req, res) => {
    const query = 'delete from southindianmenu where resturant_id = ?';
    connection.query(query, [req.params.resturant_id], (err, result) => {
        if(err) return res.send("Error occured while delete menu.",err).status(500);
        return res.send('menu deleted successfully').status(200);
    });
});

module.exports = route;