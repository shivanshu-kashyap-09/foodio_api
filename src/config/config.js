const path = require('path');
require('dotenv').config({ override: process.env.NODE_ENV !== 'production' });

// Validate required environment variables
const requiredEnvVars = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'MAIL',
    'MAIL_PASSWORD',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

const config = {
    // Application
    app: {
        name: 'FOODIO API',
        version: '1.0.0',
        env: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT, 10) || 3000,
        url: process.env.APP_URL || 'http://localhost:3000',
        isProduction: process.env.NODE_ENV === 'production',
    },

    // Database
    database: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'foodio',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        waitForConnections: true,
        connectTimeout: 10000,
    acquireTimeout: 10000,
        connectionLimit: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelayMs: 0,
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
    },

    // Redis
    redis: {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB, 10) || 0,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        enableReadyCheck: true,
        enableOfflineQueue: true,
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRY || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
        algorithm: 'HS256',
    },

    // Email
    email: {
        service: 'gmail',
        from: process.env.MAIL,
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
    },

    // File Upload
    upload: {
        uploadDir: path.join(__dirname, '../../uploads'),
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
        allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,gif').split(','),
    },

    // CORS
    cors: {
        origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    },

    // Rate Limiting
    rateLimit: {
        login: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 10,
            message: 'Too many login attempts. Please try again later.',
        },
        otp: {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 5,
            message: 'Too many OTP requests. Please try again later.',
        },
        general: {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 3000,
            message: 'Too many requests. Please try again later.',
        },
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug'),
        format: process.env.LOG_FORMAT || 'combined',
        dir: path.join(__dirname, '../../logs'),
    },

    // Payments
    payments: {
        razorpay: {
            keyId: process.env.RAZORPAY_KEY_ID,
            keySecret: process.env.RAZORPAY_KEY_SECRET,
        },
    },

    // OAuth
    oauth: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackUrl: process.env.GOOGLE_CALLBACK_URL || `${process.env.APP_URL}/auth/google/callback`,
        },
    },

    // Pagination
    pagination: {
        defaultLimit: 10,
        maxLimit: 100,
        defaultPage: 1,
    },

    // Cache
    cache: {
        userProfile: 3600, // 1 hour
        restaurantList: 1800, // 30 minutes
        menuItems: 1800, // 30 minutes
        orders: 600, // 10 minutes
    },

    // Validation
    validation: {
        minPasswordLength: 8,
        maxNameLength: 100,
        minPhoneLength: 10,
    },
};

// Validate critical config values
if (!config.jwt.secret || config.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

if (config.app.isProduction) {
    if (!config.email.auth.user || !config.email.auth.pass) {
        throw new Error('Email credentials required in production');
    }
    if (config.cors.origin.length === 1 && config.cors.origin[0] === 'http://localhost:3000') {
        console.warn('⚠️  CORS is set to localhost. Update ALLOWED_ORIGINS for production.');
    }
}
module.exports = config;
