const express = require('express');
const connection = require('../../db');
const route = express.Router();
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    const uniqueName = `user_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// http://localhost:3000/user/get/1
route.get('/get/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM user WHERE user_id = ?';

    connection.query(query, [id], (err, result) => {
        if (err) return res.status(500).send("Error while fetching user: " + err);
        if (result.length === 0) return res.status(404).send("User not found");
        return res.status(200).send(result[0]);
    });
});



// http://localhost:3000/user/update/:1
route.put('/update/:id', upload.single('user_img'), (req, res) => {
  const { id } = req.params;
  const { user_name, user_phone, user_gmail, user_address } = req.body;

  let query = `
    UPDATE user 
    SET user_name = ?, user_phone = ?, user_gmail = ?, user_address = ?
  `;
  const values = [user_name, user_phone, user_gmail, user_address];

  // If image uploaded, update that too
  if (req.file) {
    query += `, user_img = ?`;
    values.push(`/uploads/${req.file.filename}`);
  }

  query += ` WHERE user_id = ?`;
  values.push(id);

  connection.query(query, values, (err, result) => {
    if (err) return res.status(500).send("Error updating user: " + err);
    res.status(200).send({ message: "User updated successfully!" });
  });
});



// http://localhost:3000/user/login
route.post('/login', (req, res) => {
    const { userName, password } = req.body;
    const query = "SELECT * FROM user WHERE user_gmail = ? AND user_password = ?";

    connection.query(query, [userName, password], (err, result) => {
        if (err) return res.status(500).send("Error occurred while login: " + err);
        if (result.length === 0) return res.status(401).send("Invalid credentials");
        return res.status(200).json(result[0]);
    });
});

// http://localhost:3000/user/signup
route.post('/signup', async (req, res) => {
    const { userName, userEmail, userPhone, userPassword } = req.body;

    const query = "INSERT INTO user (user_name, user_gmail, user_phone, user_password, user_verify) VALUES (?, ?, ?, ?, 0)";
    connection.query(query, [userName, userEmail, userPhone, userPassword], async (err, result) => {
        if (err) return res.status(500).send("Error occurred while signup: " + err);

        try {
            await sendMail(userEmail);
            return res.status(201).send({ message: "User created. Verification email sent.", result });
        } catch (mailErr) {
            return res.status(500).send("User created but email sending failed: " + mailErr);
        }
    });
});

route.get('/verify', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).send("Email required");

    const query = `UPDATE user SET user_verify = 1 WHERE user_gmail = ?`;
    connection.query(query, [email], (err, result) => {
        if (err) return res.status(400).send("User verification failed.");
        return res.send("Email verified successfully!");
    });
});

const sendMail = async (userEmail) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAIL,
            pass: process.env.PASSWORD,   
        },
    });

    const mailOptions = {
        from: "kashyapshivanshu097@gmail.com",
        to: userEmail,
        subject: "Verify your FOODIO account",
        html: `
            <h3>Welcome to FOODIO!</h3>
            <p>Click below to verify your email:</p>
            <a href="http://localhost:3000/user/verify?email=${userEmail}">Verify Account</a>
        `,
    };

    return transporter.sendMail(mailOptions);
};

module.exports = route;