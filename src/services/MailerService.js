const nodemailer = require('nodemailer');
const Cache = require('../utils/Cache');

// Email transporter configuration
let transporter = null;

/**
 * Initialize email transporter
 */
function initializeTransporter() {
    // Validate environment variables
    if (!process.env.MAIL || !process.env.MAIL_PASSWORD) {
        throw new Error('Email configuration is missing. Set MAIL and MAIL_PASSWORD in environment variables.');
    }

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.MAIL,
            pass: process.env.MAIL_PASSWORD,
        },
        pool: {
            maxConnections: 5,
            maxMessages: Infinity,
            rateDelta: 2000,
            rateLimit: 5,
        },
    });

    return transporter;
}

/**
 * Get transporter instance
 */
function getTransporter() {
    if (!transporter) {
        initializeTransporter();
    }
    return transporter;
}

/**
 * Send verification email
 * @param {string} email - Recipient email
 * @param {number} userId - User ID
 * @returns {Promise<void>}
 */
async function sendVerificationEmail(email, userId) {
    try {
        if (!email) {
            throw new Error('Email is required');
        }

        // Generate verification token
        const crypto = require('crypto');
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Store token in Redis with 24-hour expiry
        await Cache.set(`verify_token:${verificationToken}`, email, 86400);

        const mailTransporter = getTransporter();
        const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/user/verify-email/${verificationToken}`;

        const mailOptions = {
            from: `"FOODIO" <${process.env.MAIL}>`,
            to: email,
            subject: 'Verify Your FOODIO Account',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome to FOODIO!</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Thank you for signing up. Please verify your email address to activate your account.
                    </p>
                    <p style="margin: 30px 0;">
                        <a href="${verificationLink}" 
                           style="background-color: #FF6B35; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Verify Email
                        </a>
                    </p>
                    <p style="color: #999; font-size: 12px;">
                        Or copy this link: <br>
                        <a href="${verificationLink}">${verificationLink}</a>
                    </p>
                    <p style="color: #999; font-size: 12px; margin-top: 30px;">
                        This link will expire in 24 hours.
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 11px;">
                        If you didn't create this account, please ignore this email.
                    </p>
                </div>
            `,
        };

        await mailTransporter.sendMail(mailOptions);
        console.log(`[MailerService] Verification email sent to ${email}`);
    } catch (error) {
        console.error('[MailerService.sendVerificationEmail] Error:', error);
        throw new Error('Failed to send verification email');
    }
}

/**
 * Send OTP email for password reset
 * @param {string} email - Recipient email
 * @param {string} otp - One-time password
 * @returns {Promise<void>}
 */
async function sendOtpEmail(email, otp) {
    try {
        if (!email || !otp) {
            throw new Error('Email and OTP are required');
        }

        return await sendMail({
            to: email,
            subject: 'FOODIO Password Reset - OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p style="color: #666; line-height: 1.6;">
                        We received a request to reset your FOODIO account password.
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        Use this One-Time Password (OTP) to reset your password:</p>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; 
                                text-align: center; margin: 20px 0;">
                        <h3 style="color: #FF6B35; letter-spacing: 2px; margin: 0; font-size: 24px;">
                            ${otp}
                        </h3>
                    </div>
                    <p style="color: #666; line-height: 1.6;">
                        This OTP is valid for <strong>10 minutes</strong> only.
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                        If you didn't request a password reset, please ignore this email or 
                        <a href="mailto:${process.env.MAIL}">contact support</a>.
                    </p>
                    <p style="color: #999; font-size: 11px;">
                        For security reasons, never share your OTP with anyone.
                    </p>
                </div>
            `,
        });
    } catch (error) {
        console.error('[MailerService.sendOtpEmail] Error:', error);
        throw new Error('Failed to send OTP email');
    }
}

async function sendMail({ to, subject, html, text }) {
    try {
        if (!to || !subject || (!html && !text)) {
            throw new Error('Email to, subject, and content are required');
        }

        const mailTransporter = getTransporter();
        const mailOptions = {
            from: `"FOODIO" <${process.env.MAIL}>`,
            to,
            subject,
            html,
            text,
        };

        await mailTransporter.sendMail(mailOptions);
        console.log(`[MailerService] Email sent to ${to} (${subject})`);
    } catch (error) {
        console.error('[MailerService.sendMail] Error:', error);
        throw new Error('Failed to send email');
    }
}

async function sendOrderCancellationEmail(email, orderId, cancelledBy) {
    try {
        if (!email || !orderId || !cancelledBy) {
            throw new Error('Email, orderId, and cancelledBy are required');
        }

        const subject = `Order Cancelled - #${orderId}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Order Cancelled</h2>
                <p style="color: #666; line-height: 1.6;">
                    Your order <strong>#${orderId}</strong> has been cancelled.
                </p>
                <p style="color: #666; line-height: 1.6;">
                    Cancellation initiated by <strong>${cancelledBy}</strong>.
                </p>
                <p style="color: #666; line-height: 1.6;">
                    If you have any questions, please contact support at <a href="mailto:${process.env.MAIL}">${process.env.MAIL}</a>.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 11px;">
                    FOODIO Order Management Team
                </p>
            </div>
        `;

        return await sendMail({ to: email, subject, html });
    } catch (error) {
        console.error('[MailerService.sendOrderCancellationEmail] Error:', error);
        throw new Error('Failed to send order cancellation email');
    }
}

async function sendDeliveryOtpNotification(email, orderId, otp) {
    try {
        if (!email || !orderId || !otp) {
            throw new Error('Email, orderId, and OTP are required');
        }

        const subject = `Delivery OTP for Order #${orderId}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Delivery Verification OTP</h2>
                <p style="color: #666; line-height: 1.6;">
                    Use the following OTP to complete delivery for order <strong>#${orderId}</strong>.
                </p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; 
                            text-align: center; margin: 20px 0;">
                    <h3 style="color: #FF6B35; letter-spacing: 2px; margin: 0; font-size: 24px;">
                        ${otp}
                    </h3>
                </div>
                <p style="color: #666; line-height: 1.6;">
                    This OTP will expire in 20 minutes.
                </p>
                <p style="color: #999; font-size: 12px;">
                    Do not share this OTP with anyone else.
                </p>
            </div>
        `;

        return await sendMail({ to: email, subject, html });
    } catch (error) {
        console.error('[MailerService.sendDeliveryOtpNotification] Error:', error);
        throw new Error('Failed to send delivery OTP email');
    }
}

/**
 * Send welcome email
 * @param {string} email - Recipient email
 * @param {string} name - User name
 * @returns {Promise<void>}
 */
async function sendWelcomeEmail(email, name) {
    try {
        if (!email || !name) {
            throw new Error('Email and name are required');
        }

        const mailTransporter = getTransporter();

        const mailOptions = {
            from: `"FOODIO" <${process.env.MAIL}>`,
            to: email,
            subject: 'Welcome to FOODIO!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome to FOODIO, ${name}!</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Your account is now active. Start exploring amazing food options in your area.
                    </p>
                    <p style="margin: 20px 0;">
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}" 
                           style="background-color: #FF6B35; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Explore Now
                        </a>
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 14px;">
                        <strong>Quick Tips:</strong><br>
                        • Browse restaurants and menus<br>
                        • Add items to your cart<br>
                        • Track your orders<br>
                        • Save your favorite items
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 11px;">
                        Questions? Email us at ${process.env.MAIL}
                    </p>
                </div>
            `,
        };

        await mailTransporter.sendMail(mailOptions);
        console.log(`[MailerService] Welcome email sent to ${email}`);
    } catch (error) {
        console.error('[MailerService.sendWelcomeEmail] Error:', error);
        throw new Error('Failed to send welcome email');
    }
}

/**
 * Send account deletion confirmation email
 * @param {string} email - Recipient email
 * @param {string} name - User name
 * @returns {Promise<void>}
 */
async function sendAccountDeletionEmail(email, name) {
    try {
        if (!email || !name) {
            throw new Error('Email and name are required');
        }

        const mailTransporter = getTransporter();

        const mailOptions = {
            from: `"FOODIO" <${process.env.MAIL}>`,
            to: email,
            subject: 'FOODIO Account Deleted',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Account Deletion Confirmation</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Hello ${name},
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        Your FOODIO account has been successfully deleted. All associated data has been removed from our system.
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        If you change your mind or have any questions, feel free to reach out to us.
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 11px;">
                        Thank you for using FOODIO!
                    </p>
                </div>
            `,
        };

        await mailTransporter.sendMail(mailOptions);
        console.log(`[MailerService] Account deletion email sent to ${email}`);
    } catch (error) {
        console.error('[MailerService.sendAccountDeletionEmail] Error:', error);
        throw new Error('Failed to send account deletion email');
    }
}

/**
 * Verify transporter connection
 * @returns {Promise<boolean>} Connection status
 */
async function verifyConnection() {
    try {
        const mailTransporter = getTransporter();
        await mailTransporter.verify();
        console.log('[MailerService] Email transporter verified successfully');
        return true;
    } catch (error) {
        console.error('[MailerService] Email transporter verification failed:', error);
        return false;
    }
}

module.exports = {
    initializeTransporter,
    getTransporter,
    sendVerificationEmail,
    sendOtpEmail,
    sendMail,
    sendOrderCancellationEmail,
    sendDeliveryOtpNotification,
    sendWelcomeEmail,
    sendAccountDeletionEmail,
    verifyConnection,
};
