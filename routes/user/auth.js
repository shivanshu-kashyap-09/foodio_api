const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/user/login
route.post('/login', (req, res) => {
    const {userName, password} = req.body;
    const query = "select * from user where user_name = ? and user_password = ?";
    connection.query(query, [userName, password], (err, result) => {
        if(err) return res.status(500).send("Error occured while login : "+err);
        return res.status(200).send(result);
    });
});

route.post('/signup', (req, res) => {
    const {userName, userEmail, userPhone, userPassword} = req.body;
    const query = "insert into user (user_name, user_gmail, user_phone, user_password) values (?, ?, ?, ?)";
    connection.query(query, [userName, userEmail, userPhone, userPassword], (err, result) => {
        if(err) return res.status(500).send("error occured while singnup : "+err);
        return res.status(201).send(result);
    });
});

module.exports = route;