const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/thali/all
route.get('/all', (req, res) => {
    connection.query('select * from thali', (err, result) => {
        if (err) return res.send("Error occured in get all thali : ", err).send(404);
        return res.send(result);
    });
});

// http://localhost:3000/thali/get/id/1
route.get('/get/id/:thali_id', (req, res) => {
    const query = 'select * from thali where thali_id = ?';
    connection.query(query, [req.params.thali_id], (err, result) => {
        if (err) return res.send("Error occured in get by id thali : ", err).status(404);
        return res.send(result[0]).status(200);
    });
});

// http://localhost:3000/thali/add
route.post('/add', (req, res) => {
    const { restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img } = req.body;
    const query = "insert into thali (restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img ) values (?, ?, ?, ?, ?, ?, ?)";
    connection.query(query, [restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img], (err, result) => {
        if (err) return res.send("Error occured in insert thali : ", err).status(404);
        return res.send(result[0]).status(201);
    });
});

// http://localhost:3000/thali/update/id/:1
route.put('/update/id/:thali_id', (req, res) => {
    const { restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img } = req.body;
    const thaliId = req.params.thali_id;

    connection.query('SELECT * FROM thali WHERE thali_id = ?', [thaliId], (selectErr, selectResult) => {
        if (selectErr) {
            console.error('Error fetching thali:', selectErr);
            return res.status(500).send('Error fetching thali');
        }
        if (selectResult.length === 0) return res.send('Thali not found.').status(404);

        const query = 'UPDATE thali SET restaurant_id = ?, restaurant_name = ?, description = ?, price = ?, rating = ?, thali_name = ?, thali_img = ? WHERE thali_id = ?';


        connection.query(query, [restaurant_id, restaurant_name, description, price, rating, thali_name, thali_img, thaliId], (err, result) => {
            if (err) {
                console.error('Error updating thali:', err);
                return res.send('Error occurred while updating thali').status(500);
            }
            res.send(result[0]).status(200);
        });
    });
});

// http://localhost:3000/thali/delete/id/1
route.delete('/delete/id/:thali_id', (req, res) => {
    const query = 'delete from thali where thali_id = ?';
    connection.query(query, req.params.thali_id, (err, result) => {
        if (err) return res.send("Error occured while delete thali.", err).status(500);
        return res.send('thali deleted successfully').status(200);
    })
})
module.exports = route;