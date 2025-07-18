const express = require('express');
const connection = require('../../db');
const redis = require('../../redis');
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
route.get('/get/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const cache = await redis.get(`userById:${id}`);
    if(cache) return res.status(200).json(JSON.parse(cache));
    const query = 'SELECT * FROM user WHERE user_id = ?';
    connection.query(query, [id], async (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err });
      if (result.length === 0) return res.status(404).json({ message: 'User not found' });
      await redis.set(`userById:${id}`, JSON.stringify(result[0]));
      return res.status(200).json(result[0]);
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
});


// http://localhost:3000/user/update/:1
route.put('/update/:id', upload.single('user_img'), async (req, res) => {
  const { id } = req.params;
  const { user_name, user_phone, user_gmail, user_address } = req.body;

  try {
      let query = `
      UPDATE user 
      SET user_name = ?, user_phone = ?, user_gmail = ?, user_address = ?
      `;
      const values = [user_name, user_phone, user_gmail, user_address];
      
      if (req.file) {
          query += ', user_img = ?';
          values.push(`/uploads/${req.file.filename}`);
        }
        
        query += ' WHERE user_id = ?';
        values.push(id);
        
        connection.query(query, values, async (err, result) => {
            if (err) return res.status(500).json({ message: 'Error updating user', error: err });
            if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
            const cacheKey = `userById:${id}`;
            await redis.del(cacheKey);
            return res.status(200).json({ message: 'User updated successfully' });
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
});


// http://localhost:3000/user/login
route.post('/login', async (req, res) => {
  const { userName, password } = req.body;

  try {
    const query = "SELECT * FROM user WHERE user_gmail = ? AND user_password = ?";
    connection.query(query, [userName, password], async (err, result) => {
        if (err) return res.status(500).json({ message: 'Login failed', error: err });
        if (result.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
      return res.status(200).json(result[0]);
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
});



// http://localhost:3000/user/signup
route.post('/signup', async (req, res) => {
  const { userName, userEmail, userPhone, userPassword } = req.body;

  try {
    const query = "INSERT INTO user (user_name, user_gmail, user_phone, user_password, user_verify) VALUES (?, ?, ?, ?, 0)";
    connection.query(query, [userName, userEmail, userPhone, userPassword], async (err, result) => {
      if (err) return res.status(500).json({ message: 'Signup failed', error: err });

      try {
        await sendMail(userEmail);
        return res.status(201).json({ message: 'User created. Verification email sent.', result });
      } catch (mailErr) {
        return res.status(500).json({ message: 'User created but failed to send verification email', error: mailErr });
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
});

route.get('/verify', async (req, res) => {
  const { email } = req.query;

  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const query = `UPDATE user SET user_verify = 1 WHERE user_gmail = ?`;
    connection.query(query, [email], (err, result) => {
      if (err) return res.status(500).json({ message: 'Verification failed', error: err });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Email not found or already verified' });
      return res.status(200).json({ message: 'Email verified successfully!' });
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
});

const sendMail = async (userEmail) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAIL,
            pass: process.env.MAIL_PASSWORD,   
        },
    });

    const mailOptions = {
        from: process.env.MAIL,
        to: userEmail,
        subject: "Verify your FOODIO account",
        html: `
            <h3>Welcome to FOODIO!</h3>
            <p>Click below to verify your email:</p>
            <a href="${process.env.URL}/user/verify?email=${userEmail}">Verify Account</a>
        `,
    };

    return transporter.sendMail(mailOptions);
};

module.exports = route;