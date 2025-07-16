const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/order/get/1
route.get('/get/:user_id', (req, res) => {
    const query = "select * from orders where user_id = ?";
    connection.query(query, [req.params.user_id], (err, result) => {
        if (err) return res.status(500).send("Error occured while get the orders : " + err);
        return res.status(200).send(result);
    });
});

// http://localhost:3000/order/insert/1
route.post('/insert/:user_id', (req, res) => {
    const { items, total, payment, delivery_status } = req.body;
    const query = "insert into orders (items, total, payment, delivery_status, user_id) values (?, ?, ?, ?, ?)";
    connection.query(query, [items, total, payment, delivery_status, req.params.user_id], (err, result) => {
        if (err) return res.status(500).send("Error occured in insert order : " + err);
        const order_id = result.order_id;
        res.status(201).send(result);
        setTimeout(() => {
            const update = 'update orders set delivery_status = "Delivered" where user_id = ? and order_id = ?';
            connection.query(update, [req.params.user_id, order_id], (e, r) => {
                if (e) return res.status(500).send("Error occured while update the status : " + e);
                res.status(200).send(r);
            })
        }, 60 * 1000);
    });
});

// http://localhost:3000/order/update/1/1
route.put('/update/:user_id/:order_id', (req, res) => {
    const { delivery_status } = req.body;
    const query = "update orders set delivery_status = ? where user_id = ? and order_id = ?";
    connection.query(query, [delivery_status, req.params.user_id, req.params.order_id], (err, result) => {
        if (err) return res.status(500).send("Error occured in update order : " + err);
        return res.status(200).send(result);
    })
})

// http://localhost:3000/order/delete/1/1
route.delete('/delete/:user_id/:order_id', (req, res) => {
    const query = "delete from orders where user_id = ? and order_id = ?";
    connection.query(query, [req.params.user_id, req.params.order_id], (err, result) => {
        if (err) return res.status(500).send("Error occured while delete order : " + err);
        return res.status(200).send(result);
    });
});

module.exports = route;