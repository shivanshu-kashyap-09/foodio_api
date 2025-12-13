const express = require('express');
const connection = require('../../db');
const route = express.Router();

// http://localhost:3000/contact/contact
route.post("/contact", async (req, res) => {
    try {
        const { name, email, message } = req.body;  
        if (!name || !email || !message) {
            return res.status(400).send("All fields are required.");
        } 
        const query = "INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)";
        connection.query(query, [name, email, message], async (err, result) => {
            if (err) return res.status(500).send("Error occurred while saving contact message: " + err);
            return res.status(201).json({ message: "Contact message saved successfully", result });
        });
    } catch (error) {
        return res.status(500).send("Internal Server Error: " + error.message);
    }
});

module.exports = route;