const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/<div className='border-3 border-red-700 ml-4 p-4 bg-white'>

route.get("/id/:restaurant_id", (req, res) => {
    const query = "select * from nonvegmenu where restaurant_id = ?";
    connection.query(query, [req.params.restaurant_id], (err, result) => {
        if(err) return res.send("Error occured in get menu by restaurant id : ",err).status(500);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/nonvegmenu/create/1
route.post('/create/:restaurant_id', (req, res) => {
    const {dish_name, dish_price, dish_rating, dish_description, dish_image} = req.body;
    const res_id = req.params.restaurant_id;
    const query = "insert into nonvegmenu (dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id) values (?, ?, ?, ?, ?, ?)";
    connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, res_id], (err, result) => {
        if(err) return res.send("error occured in create a menu : ",err).status(500);
        return res.send(result).status(201);
    });
});

// http://localhost:3000/nonvegmenu/update/id/1/1
route.put('/update/id/:restaurant_id/:dish_id', (req, res) => {
    const {dish_name, dish_price, dish_rating, dish_description, dish_image} = req.body;
    const restaurant_id = req.params.restaurant_id;
    const dish_id = req.params.dish_id;
    const query = "update nonvegmenu set dish_name = ?, dish_price = ?, dish_rating = ?, dish_description = ?, dish_image = ? where restaurant_id = ? & dish_id = ?";
    connection.query(query, [dish_name, dish_price, dish_rating, dish_description, dish_image, restaurant_id, dish_id], (err, result) => {
        if(err) return res.send("error occured in update a menu : ",err).status(500);
        return res.send(result).status(200);
    });
});

// http://localhost:3000/nonvegmenu/delete/dish/1/1
route.delete('/delete/dish/:restaurant_id/:dish_id', (req, res) => {
    const query = 'delete from nonvegmenu where resturant_id = ? & dish_id = ?';
    connection.query(query, [req.params.restaurant_id, req.params.dish_id], (err, result) => {
        if(err) return res.send("Error occured while delete dish.",err).status(500);
        return res.send('dish deleted successfully').status(200);
    });
});

// http://localhost:3000/nonvegmenu/delete/menu/1
route.delete('/delete/menu/:restaurant_id', (req, res) => {
    const query = 'delete from nonvegmenu where resturant_id = ?';
    connection.query(query, [req.params.restaurant_id], (err, result) => {
        if(err) return res.send("Error occured while delete menu.",err).status(500);
        return res.send('menu deleted successfully').status(200);
    });
});

module.exports = route;