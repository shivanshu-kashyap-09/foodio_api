const DB = require('../utils/DB');
const Redis = require('../utils/Redis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const crypto = require('crypto');
const { promisify } = require('util');

// Convert callback-based DB query to Promise
const queryAsync = promisify(DB.query).bind(DB);

/**
 * Fetch all users from database
 * @returns {Promise<Array>} Array of user objects
 */
async function getAllUser() {
    try {
        const query = 'SELECT user_id, user_name, user_gmail, user_phone, user_address, role, created_at FROM user';
        const results = await queryAsync(query);
        return results;
    } catch (error) {
        console.error('[AuthService.getAllUser] Error fetching users:', error);
        throw new Error('Failed to fetch users');
    }
}

/**
 * Fetch user by ID
 * @param {number|string} id - User ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserById(id) {
    try {
        if (!id) {
            throw new Error('Invalid user ID');
        }

        const userId = parseInt(id, 10);
        if (isNaN(userId)) {
            throw new Error('Invalid user ID format');
        }

        // Check cache first
        // const cachedUser = await Redis.get(`user:${userId}`);
        // if (cachedUser) {
        //     return JSON.parse(cachedUser);
        // }

        const query = 'SELECT user_id, user_name, user_gmail, user_phone, user_address, user_img, role FROM user WHERE user_id = ?';
        const results = await queryAsync(query, [userId]);

        if (!results || results.length === 0) {
            return null;
        }

        const user = results[0];
        // Cache for 1 hour
        // await Redis.set(`user:${userId}`, JSON.stringify(user), 'EX', 3600);
        return user;
    } catch (error) {
        console.error('[AuthService.getUserById] Error fetching user by ID:', error);
        throw new Error('Failed to fetch user');
    }
}

/**
 * Fetch user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserByEmail(email) {
    try {
        if (!email || typeof email !== 'string') {
            throw new Error('Invalid email');
        }

        const query = 'SELECT user_id, user_name, user_gmail, user_phone, user_address, user_img, user_password, user_verify, role FROM user WHERE user_gmail = ?';
        const results = await queryAsync(query, [email.toLowerCase()]);

        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error('[AuthService.getUserByEmail] Error fetching user by email:', error);
        throw new Error('Failed to fetch user');
    }
}

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user data
 */
async function createUser(userData) {
    try {
        const { user_name, user_gmail, user_phone, user_password, user_role, restaurantType, address, vehicle_type, vehicle_number } = userData;

        if (!user_name || !user_gmail || !user_phone || !user_password || !user_role) {
            throw new Error('Missing required fields');
        }

        // Check if user already exists
        const existingUser = await getUserByEmail(user_gmail);
        if (existingUser) {
            const error = new Error('User already exists');
            error.statusCode = 409;
            throw error;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(user_password, 10);

        // 1. Insert into base user table
        const userQuery = `
            INSERT INTO user (user_name, user_gmail, user_phone, user_password, user_verify, role, user_address, created_at)
            VALUES (?, ?, ?, ?, 0, ?, ?, NOW())
        `;
        const userResult = await queryAsync(userQuery, [
            user_name,
            user_gmail.toLowerCase(),
            user_phone,
            hashedPassword,
            user_role,
            address || ''
        ]);

        const newUserId = userResult.insertId;

        // 2. SaaS Logic: Insert into specialized tables based on role
        if (user_role === 'restaurant') {
            let restaurantTable = '';
            // Determine table based on restaurant type
            if (restaurantType === 'veg') restaurantTable = 'vegrestaurant';
            else if (restaurantType === 'nonveg') restaurantTable = 'nonvegrestaurant';
            else if (restaurantType === 'southindian') restaurantTable = 'southindianrestaurant';

            if (restaurantTable) {
                const resQuery = `
                    INSERT INTO ${restaurantTable} (
                        res_name, res_phone, res_address, res_img, res_rating
                    ) VALUES (?, ?, ?, ?, ?)
                `;
                // Using default image placeholders for new signups
                const defaultImg = "https://img.freepik.com/premium-psd/3d-male-character-free-psd_837431-38.jpg";
                await queryAsync(resQuery, [user_name, user_phone, address || '', defaultImg, 3]);
            }
        } else if (user_role === 'delivery') {
            const deliveryQuery = `
                INSERT INTO delivery_partners (
                    name, phone, vehicle_type, vehicle_number, user_id, status
                ) VALUES (?, ?, ?, ?, ?, 'offline')
            `;
            await queryAsync(deliveryQuery, [user_name, user_phone, vehicle_type || '', vehicle_number || '', newUserId]);
        }

        return {
            user_id: newUserId,
            user_name,
            user_gmail,
            user_phone,
            user_role
        };
    } catch (error) {
        console.error('[AuthService.createUser] Error creating user:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            const dupError = new Error('User already exists');
            dupError.statusCode = 409;
            throw dupError;
        }
        throw error;
    }
}

/**
 * Authenticate user with email/phone and password
 * @param {string} user - Email or phone number
 * @param {string} password - User password
 * @returns {Promise<Object>} User data with token
 */
async function loginUser(user, password) {
    try {
        if (!user || !password) {
            throw new Error('Email/Phone and password are required');
        }

        const query = `
            SELECT * FROM user WHERE user_gmail = ? OR user_phone = ?
        `;
        const results = await queryAsync(query, [user.toLowerCase(), user]);

        if (!results || results.length === 0) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        const userData = results[0];

        // Check if user is verified
        if (userData.user_verify === 0) {
            const error = new Error('Please verify your email before logging in');
            error.statusCode = 403;
            throw error;
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, userData.user_password);
        if (!isPasswordValid) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: userData.user_id, role: userData.role },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        //         await Redis.set(`user:${userData.user_id}:token`, token, 86400);
        // await Redis.del(`user:${userData.user_id}`);

        return {
            id: userData.user_id,
            user_name: userData.user_name,
            user_gmail: userData.user_gmail,
            user_phone: userData.user_phone,
            user_address: userData.user_address,
            user_img: userData.user_img,
            role: userData.role,
            token
        };
    } catch (error) {
        console.error('[AuthService.loginUser] Error logging in user:', error);
        throw error;
    }
}

/**
 * Logout user by removing token
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function logoutUser(userId) {
    try {
        if (!userId) {
            throw new Error('User ID is required');
        }

        await Redis.del(`user:${userId}:token`);
        return true;
    } catch (error) {
        console.error('[AuthService.logoutUser] Error logging out user:', error);
        throw new Error('Failed to logout user');
    }
}

/**
 * Update user profile
 * @param {number} id - User ID
 * @param {Object} userData - Updated user data
 * @returns {Promise<Object>} Updated user data
 */
async function updateUserProfile(id, userData) {
    try {
        if (!id) {
            throw new Error('User ID is required');
        }

        const { user_name, user_phone, user_gmail, user_address, user_img } = userData;

        // Only update fields that are provided
        const updateFields = [];
        const updateValues = [];

        if (user_name !== undefined) {
            updateFields.push('user_name = ?');
            updateValues.push(user_name);
        }
        if (user_phone !== undefined) {
            updateFields.push('user_phone = ?');
            updateValues.push(user_phone);
        }
        if (user_gmail !== undefined) {
            updateFields.push('user_gmail = ?');
            updateValues.push(user_gmail.toLowerCase());
        }
        if (user_address !== undefined) {
            updateFields.push('user_address = ?');
            updateValues.push(user_address);
        }
        if (user_img !== undefined) {
            updateFields.push('user_img = ?');
            updateValues.push(user_img);
        }

        if (updateFields.length === 0) {
            throw new Error('No fields to update');
        }

        updateValues.push(id);
        const query = `UPDATE user SET ${updateFields.join(', ')} WHERE user_id = ?`;
        const result = await queryAsync(query, updateValues);

        if (result.affectedRows === 0) {
            return null;
        }

        // Clear cache
        // await Redis.del(`user:${id}`);

        return await getUserById(id);
    } catch (error) {
        console.error('[AuthService.updateUserProfile] Error updating user profile:', error);
        throw error;
    }
}

/**
 * Reset user password
 * @param {string} email - User email
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
async function resetPassword(email, newPassword) {
    try {
        if (!email || !newPassword) {
            throw new Error('Email and password are required');
        }

        const user = await getUserByEmail(email);
        if (!user) {
            const error = new Error('Email not found');
            error.statusCode = 404;
            throw error;
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const query = 'UPDATE user SET user_password = ?, updated_at = NOW() WHERE user_gmail = ?';
        const result = await queryAsync(query, [hashedPassword, email.toLowerCase()]);

        if (result.affectedRows === 0) {
            throw new Error('Failed to reset password');
        }

        // Clear cache
        await Redis.del(`user:${user.user_id}`);

        return true;
    } catch (error) {
        console.error('[AuthService.resetPassword] Error resetting password:', error);
        throw error;
    }
}

/**
 * Verify user email
 * @param {string} email - User email
 * @returns {Promise<boolean>} Success status
 */
async function verifyEmail(email) {
    try {
        if (!email) {
            throw new Error('Email is required');
        }

        const query = 'UPDATE user SET user_verify = 1, updated_at = NOW() WHERE user_gmail = ?';
        const result = await queryAsync(query, [email.toLowerCase()]);

        if (result.affectedRows === 0) {
            const error = new Error('Email not found or already verified');
            error.statusCode = 404;
            throw error;
        }

        return true;
    } catch (error) {
        console.error('[AuthService.verifyEmail] Error verifying email:', error);
        throw error;
    }
}

/**
 * Delete user account
 * @param {number} id - User ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteUser(id) {
    try {
        if (!id) {
            throw new Error('User ID is required');
        }

        const query = 'DELETE FROM user WHERE user_id = ?';
        const result = await queryAsync(query, [id]);

        if (result.affectedRows === 0) {
            return null;
        }

        // Clear cache
        await Redis.del(`user:${id}`);
        await Redis.del(`user:${id}:token`);

        return true;
    } catch (error) {
        console.error('[AuthService.deleteUser] Error deleting user:', error);
        throw error;
    }
}

module.exports = {
    getAllUser,
    getUserById,
    getUserByEmail,
    createUser,
    loginUser,
    logoutUser,
    updateUserProfile,
    resetPassword,
    verifyEmail,
    deleteUser,
    getGoogleAuthUrl,
    handleGoogleCallback
};

/**
 * Generate Google OAuth URL
 */
function getGoogleAuthUrl() {
    const { oauth } = config;
    const scope = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ');

    return `${oauth.google.oauthUrl}?response_type=code&client_id=${oauth.google.clientId}&redirect_uri=${oauth.google.redirectUrl}&scope=${scope}&access_type=offline&prompt=consent`;
}

/**
 * Handle Google OAuth Callback
 * @param {string} code - Authorization code
 */
async function handleGoogleCallback(code) {
    const { oauth } = config;

    // 1. Exchange code for tokens
    const tokenResponse = await fetch(oauth.google.accessTokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: oauth.google.clientId,
            client_secret: oauth.google.clientSecret,
            redirect_uri: oauth.google.redirectUrl,
            grant_type: 'authorization_code'
        })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
        throw new Error('Failed to obtain access token');
    }

    // 2. Get user info from Google
    const userInfoResponse = await fetch(oauth.google.userInfoUrl, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userInfo = await userInfoResponse.json();
    if (!userInfo.email) {
        throw new Error('Google authentication failed: Email not found');
    }

    const email = userInfo.email.toLowerCase();
    const name = userInfo.name || userInfo.given_name || "Google User";
    const picture = userInfo.picture || null;

    // 3. Check if user exists
    let user = await getUserByEmail(email);

    if (!user) {
        // Create new user for Google login
        const randomPassword = crypto.randomBytes(16).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const phone = '0000000000'; // Default phone for social login

        const insertQuery = `
            INSERT INTO user (user_name, user_gmail, user_phone, user_password, user_img, user_verify, role, created_at)
            VALUES (?, ?, ?, ?, ?, 1, 'user', NOW())
        `;
        const insertResult = await queryAsync(insertQuery, [name, email, phone, hashedPassword, picture]);

        user = {
            user_id: insertResult.insertId,
            user_name: name,
            user_gmail: email,
            role: 'user'
        };
    }

    // 4. Generate JWT
    const token = jwt.sign(
        { id: user.user_id, role: user.role || 'user' },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );

    return {
        token,
        user: {
            id: user.user_id,
            user_name: user.user_name,
            user_gmail: user.user_gmail
        },
        redirectUrl: `${oauth.google.frontendSuccessUrl}/#/oauth2-success?token=${token}&user_id=${user.user_id}`
    };
}