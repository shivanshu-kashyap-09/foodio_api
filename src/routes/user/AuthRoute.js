const express = require('express');
const route = express.Router();

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
// const trimRequest = require('trim-request'); // Temporarily disabled

const { authenticateToken: authMiddleware } = require('../../middleware/Auth');
const { upload: uploadMiddleware } = require('../../middleware/UploadFiles');
const authService = require('../../services/AuthService');
const mailerService = require('../../services/MailerService');
const Cache = require('../../utils/Cache');
const Logger = require('../../utils/Logger');

// Input validation utilities
const validators = {
  email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  phone: (phone) => /^[0-9]{10,}$/.test(phone.replace(/[-\s]/g, '')),
  password: (password) => password && password.length >= 8,
};

// Rate limiting middleware
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute
  message: 'Too many OTP requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
// route.use(trimRequest.all()); // Temporarily disabled

/**
 * GET /user/get/all
 * Fetch all users (Admin only)
 */
route.get('/get/all', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    }

    const users = await authService.getAllUser();
    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('[AuthRoute.get.all] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

/**
 * GET /user/profile
 * Fetch authenticated user profile
 */
route.get('/profile', authMiddleware, async (req, res) => {
  try {
    console.log('User profile fetched successfully', { user: req.user });
    const user = await authService.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User profile fetched successfully',
      data: user
    });
  } catch (error) {
    console.error('[AuthRoute.profile] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile'
    });
  }
});

/**
 * PUT /user/update/profile
 * Update user profile
 */
route.put('/update/profile', authMiddleware, uploadMiddleware.single('user_img'), async (req, res) => {
  try {
    const { user_name, user_phone, user_gmail, user_address } = req.body;

    // Validate inputs
    const validationErrors = [];
    if (user_gmail && !validators.email(user_gmail)) {
      validationErrors.push('Invalid email format');
    }
    if (user_phone && !validators.phone(user_phone)) {
      validationErrors.push('Invalid phone number format');
    }
    if (user_name && user_name.length < 2) {
      validationErrors.push('Name must be at least 2 characters');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const updateData = {
      user_name: user_name ? user_name.trim() : undefined,
      user_phone: user_phone ? user_phone.trim() : undefined,
      user_gmail: user_gmail ? user_gmail.toLowerCase().trim() : undefined,
      user_address: user_address ? user_address.trim() : undefined,
      user_img: req.file ? `/uploads/${req.file.filename}` : undefined
    };

    const profile = await authService.updateUserProfile(req.user.id, updateData);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User profile updated successfully',
      data: profile
    });
  } catch (error) {
    console.error('[AuthRoute.update.profile] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user profile'
    });
  }
});

/**
 * POST /user/login
 * User login with email/phone and password
 */
route.post('/login', loginLimiter, async (req, res) => {
  try {
    const { user, password } = req.body;

    // Validate inputs
    if (!user || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Phone and password are required'
      });
    }

    const normalizedUser = user.toLowerCase().trim();

    // Validate format
    const isEmail = validators.email(normalizedUser);
    const isPhone = validators.phone(normalizedUser);

    if (!isEmail && !isPhone) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or phone number format'
      });
    }

    const userData = await authService.loginUser(normalizedUser, password);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: userData.token,
        user: {
          id: userData.id,
          user_name: userData.user_name,
          user_gmail: userData.user_gmail,
          user_phone: userData.user_phone,
          user_address: userData.user_address,
          user_img: userData.user_img,
          role: userData.role
        }
      }
    });
  } catch (error) {
    console.error('[AuthRoute.login] Error:', error);

    // Handle specific errors
    if (error.statusCode === 401) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});


/**
 * POST /user/signup
 * Register a new user
 */
route.post('/signup', async (req, res) => {
  try {
    const { userName, userEmail, userPhone, userPassword, userConfirmPassword, userRole, restaurantType, address, vehicle_type, vehicle_number } = req.body;

    // Validate inputs
    const validationErrors = [];

    if (!userName || userName.trim().length < 2) {
      validationErrors.push('Name must be at least 2 characters');
    }
    if (!userEmail || !validators.email(userEmail)) {
      validationErrors.push('Invalid email format');
    }
    if (!userPhone || !validators.phone(userPhone)) {
      validationErrors.push('Invalid phone number format (minimum 10 digits)');
    }
    if (!userPassword || !validators.password(userPassword)) {
      validationErrors.push('Password must be at least 8 characters');
    }
    if (userPassword !== userConfirmPassword) {
      validationErrors.push('Passwords do not match');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Create user
    const user = await authService.createUser({
      user_name: userName.trim(),
      user_gmail: userEmail.toLowerCase().trim(),
      user_phone: userPhone.trim(),
      user_password: userPassword,
      user_role: userRole,
      restaurantType,
      address,
      vehicle_type,
      vehicle_number
    });

    // Send verification email
    try {
      await mailerService.sendVerificationEmail(userEmail, user.id);
    } catch (mailError) {
      console.error('[AuthRoute.signup] Failed to send verification email:', mailError);
      // Continue even if email fails
    }

    return res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your email.',
      data: {
        id: user.id,
        user_name: user.user_name,
        user_gmail: user.user_gmail
      }
    });
  } catch (error) {
    console.error('[AuthRoute.signup] Error:', error);

    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to register user'
    });
  }
});

/**
 * POST /user/logout
 * Logout user
 */
route.post('/logout', authMiddleware, async (req, res) => {
  try {
    await authService.logoutUser(req.user.id);
    await Cache.del(`user:${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('[AuthRoute.logout] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to logout'
    });
  }
});

/**
 * GET /user/verify-email/:token
 * Verify user email with token
 */
route.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    // Get email from Redis cache
    const emailFromToken = await Cache.get(`verify_token:${token}`);

    if (!emailFromToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Verify email
    await authService.verifyEmail(emailFromToken);

    // Delete token
    await Cache.del(`verify_token:${token}`);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('[AuthRoute.verify-email] Error:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
});

/**
 * POST /user/forgot-password
 * Request password reset (send OTP)
 */
route.post('/forgot-password', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validators.email(email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const user = await authService.getUserByEmail(normalizedEmail);
    if (!user) {
      // Don't reveal if email exists (security best practice)
      return res.status(200).json({
        success: true,
        message: 'If email exists, OTP will be sent to your email'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Cache with 10-minute expiry
    await Cache.set(`otp:${normalizedEmail}`, otp, 600);

    // Send OTP email
    try {
      await mailerService.sendOtpEmail(normalizedEmail, otp);
    } catch (mailError) {
      console.error('[AuthRoute.forgot-password] Failed to send OTP email:', mailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again later.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email'
    });
  } catch (error) {
    console.error('[AuthRoute.forgot-password] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
});

/**
 * POST /user/verify-otp
 * Verify OTP sent to email
 */
route.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate inputs
    if (!email || !validators.email(email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }
    if (!otp || otp.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Valid OTP is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const storedOtp = await Cache.get(`otp:${normalizedEmail}`);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found'
      });
    }

    if (storedOtp !== otp.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { email: normalizedEmail },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '15m' }
    );

    // Store reset token in Redis
    await Cache.set(`reset_token:${normalizedEmail}`, resetToken, 900);

    // Delete OTP
    await Cache.del(`otp:${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        resetToken
      }
    });
  } catch (error) {
    console.error('[AuthRoute.verify-otp] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'OTP verification failed'
    });
  }
});

/**
 * POST /user/reset-password
 * Reset password using reset token
 */
route.post('/reset-password', async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;

    // Validate inputs
    if (!email || !validators.email(email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }
    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required'
      });
    }
    if (!newPassword || !validators.password(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify reset token
    const storedToken = await Cache.get(`reset_token:${normalizedEmail}`);
    if (!storedToken || storedToken !== resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Verify JWT token
    try {
      jwt.verify(resetToken, process.env.JWT_SECRET || 'default_secret');
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Reset password
    await authService.resetPassword(normalizedEmail, newPassword);

    // Delete reset token
    await Cache.del(`reset_token:${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('[AuthRoute.reset-password] Error:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

/**
 * POST /user/delete-account
 * Delete user account (authenticated user only)
 */
route.post('/delete-account', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }

    // Verify password before deletion
    const user = await authService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, user.user_password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Delete user account
    await authService.deleteUser(req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('[AuthRoute.delete-account] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  }
});
/**
 * GET /user/googleoauth2
 * Google OAuth2 authentication redirect
 */
route.get('/googleoauth2', (req, res) => {
    try {
        const url = authService.getGoogleAuthUrl();
        res.redirect(url);
    } catch (error) {
        console.error('[AuthRoute.googleoauth2] Error:', error);
        return res.status(500).json({ success: false, message: 'OAuth initialization failed' });
    }
});

/**
 * GET /user/google/callback
 * Google OAuth2 callback handler
 */
route.get('/google/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ success: false, message: 'Authorization code not provided' });
        }

        const result = await authService.handleGoogleCallback(code);
        
        // Redirect to frontend with token and user info
        res.redirect(result.redirectUrl);
    } catch (error) {
        console.error('[AuthRoute.google.callback] Error:', error);
        return res.status(500).json({ success: false, message: 'Social login failed' });
    }
});


module.exports = route;