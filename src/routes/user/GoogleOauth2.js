const express = require('express');
const connection = require('../../db')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;
const GOOGLE_OAUTH_URL = process.env.GOOGLE_OAUTH_URL;
const GOOGLE_ACCESS_TOKEN_URL = process.env.GOOGLE_ACCESS_TOKEN_URL;
const GOOGLE_TOKEN_INFO_URL = process.env.GOOGLE_TOKEN_INFO_URL;

const SCOPE = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

// http://localhost:3000/auth/googleoauth2
router.get('/googleoauth2', (req, res) => {
    const GOOGLE_CALLBACK_URL = `${GOOGLE_OAUTH_URL}?response_type=code&client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_REDIRECT_URL}&scope=${SCOPE}&access_type=offline&prompt=consent`;

    res.redirect(GOOGLE_CALLBACK_URL);
});

// http://localhost:3000/auth/google/callback
router.get('/google/callback', async (req, res) => {
    // console.log(req.query);
    const code = req.query.code;
    if (!code) {
        return res.status(400).json({ message: 'Authorization code not provided' });
    }
    try {
        const tokenResponse = await fetch(GOOGLE_ACCESS_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URL,
                grant_type: 'authorization_code'
            })
        });
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
      return res.status(401).send("Failed to obtain access token");
    }
        const accessToken = tokenData.access_token;
        const userInfoResponse = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const userInfo = await userInfoResponse.json();
        if (!userInfo.email) {
      return res.status(401).send("Google authentication failed");
    }
        // console.log(userInfo);
        const email = userInfo.email;
        const name = userInfo.name || userInfo.given_name || "Google User";
        const picture = userInfo.picture || null;
        const phone = '0000000000';
        const checkQuery = "SELECT * FROM user WHERE user_gmail = ?";
        connection.query(checkQuery, [email], (err, result) => {
            if (err) return res.status(500).json({ error: "DB error" + err });
            let user;
            if (result.length > 0) {
                user = {
                    user_id: result[0].user_id,
                    user_name: result[0].user_name,
                    user_gmail: result[0].user_gmail
                };
            }
            if (result.length > 0) {
                return redirectUser(result[0]);
            }
            const password = bcrypt.hashSync(
                crypto.randomBytes(16).toString("hex"),
                10
            );
            connection.query(
                "INSERT INTO user (user_name, user_gmail, user_phone, user_password, user_img, user_verify) VALUES (?, ?, ?, ?, ?, 1)",
                [name, email, phone, password, picture],
                (err, insertResult) => {
                    if (err) return res.status(500).send("Insert error" + err);

                    const newUser = {
                        user_id: insertResult.insertId,
                        user_name: name,
                        user_gmail: email
                    };

                    redirectUser(newUser);
                }
            );
        }
        );

        function redirectUser(user) {
            const token = jwt.sign(
                { userId: user.user_id },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.redirect(
                `${process.env.FRONTEND_URL}/#/oauth2-success?token=${token}&user_id=${user.user_id}`
            );
        }

    } catch (error) {
        return res.status(500).json({ message: 'Server error', error });
    }
});

module.exports = router;