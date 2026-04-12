const express = require('express');
const cors = require('cors'); // CORS middleware
const helmet = require('helmet'); // Security headers
const morgan = require('morgan'); // Logging middleware
const rateLimit = require('express-rate-limit'); // Rate limiting middleware
const trimRequest = require('trim-request'); // Middleware to trim request data 
const http = require('http');
const socketIO = require('socket.io');
require("./src/cron/orderCron");

const config = require('./src/config/config');
const Logger = require('./src/utils/Logger');
const Database = require('./src/utils/Database');
const Cache = require('./src/utils/Cache');
const WebSocketManager = require('./src/utils/WebSocketManager');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./src/config/swaggerDoc');
const swaggerFile = require("./src/config/swagger-output.json");
const { errorHandler, notFoundHandler } = require('./src/middleware/ErrorHandler');

const logger = new Logger('Server');

const app = express();

async function healthChecks() {
    logger.info('Running health checks...');
    try {
        await Database.initializePool();
        logger.info('✅ Database connection successful');
    } catch (error) {
        logger.error('❌ Database connection failed', { error: error.message });
        process.exit(1);
    }

    try {
        await Cache.initializeRedis();
        const isPingOk = await Cache.ping();
        if (isPingOk) {
            logger.info('✅ Redis connection successful');
        } else {
            throw new Error('Redis ping failed');
        }
    } catch (error) {
        logger.error('❌ Redis connection failed', { error: error.message });
        logger.warn('⚠️  Redis is optional but recommended for production');
    }
}

app.use(helmet());

app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
}));

if (!config.app.isProduction) {
    app.use(morgan('dev'));
} else {
    morgan.token('body', (req) => JSON.stringify(req.body));
    app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms'));
}

// Trim request data
// app.use(trimRequest.all()); // Temporarily disabled due to compatibility issues

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


app.use('/uploads', express.static('uploads'));

const generalLimiter = rateLimit({
    windowMs: config.rateLimit.general.windowMs,
    max: config.rateLimit.general.maxRequests,
    message: config.rateLimit.general.message,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
});

app.use(generalLimiter);

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: config.app.env,
    });
});

app.get('/api/version', (req, res) => {
    res.status(200).json({
        success: true,
        version: config.app.version,
        name: config.app.name,
    });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, { explorer: true }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile));
app.get('/api/docs.json', (req, res) => res.status(200).json(swaggerDocument));

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to FOODIO API',
        version: config.app.version,
        documentation: `${config.app.url}/api-docs`,
    });
});

app.use('/api/user', require('./src/routes/user/AuthRoute'));
app.use('/api/user/cart', require('./src/routes/user/cartRoute'));
app.use('/api/user/wishlist', require('./src/routes/user/whishlist'));
app.use('/api/user/orders', require('./src/routes/user/orderRoute'));
app.use('/api/contact', require('./src/routes/user/contactRoute'));

// Advanced order tracking and analytics routes
app.use('/api/orders', require('./src/routes/tracking/orderTrackingRoute'));
app.use('/api/razorpay', require('./src/routes/user/razorpay'));

// AI-powered food recommendation chatbot routes
app.use('/api/chatbot', require('./src/routes/chatbot/chatbotRoute'));

// Global search and filter routes
app.use('/api/search', require('./src/routes/search/searchRoute'));

app.use('/api/restaurants/veg', require('./src/routes/restaurant/vegRestaurantRoute'));
app.use('/api/restaurants/nonveg', require('./src/routes/restaurant/nonVegRestaurantRoute'));
app.use('/api/restaurants/southindian', require('./src/routes/restaurant/southRestaurant'));

app.use('/api/menus/veg', require('./src/routes/menu/vegMenuRoute'));
app.use('/api/menus/nonveg', require('./src/routes/menu/nonVegMenuRoute'));
app.use('/api/menus/southindian', require('./src/routes/menu/southIndianMenu'));

app.use('/api/thali', require('./src/routes/thali/thali'));
app.use('/api/thali/dishes', require('./src/routes/thali/thaliDish'));

// --- EXTENSION: SaaS & AI MODULES ---
app.use('/api/admin', require('./src/routes/admin/adminRoute'));
app.use('/api/restaurant/dashboard', require('./src/routes/restaurant/dashboardRoute'));
app.use('/api/delivery', require('./src/routes/delivery/deliveryRoute'));
app.use('/api/delivery/borzo', require('./src/routes/delivery/borzoRoute'));
app.use('/api/ai', require('./src/routes/ai/aiRoute'));


app.use(notFoundHandler);

app.use(errorHandler);

async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    server.close(() => {
        logger.info('Server closed');
    });

    await Database.closePool();
    Cache.closeConnection();

    process.exit(0);
}

let server;

async function startServer() {
    try {
        await healthChecks();

        // Create HTTP server with Socket.io
        server = http.createServer(app);

        const io = socketIO(server, {
            cors: {
                origin: config.cors.origin,
                credentials: config.cors.credentials,
                methods: config.cors.methods,
            },
            transports: ['websocket', 'polling'],
        });

        // WebSocket authentication middleware
        io.use((socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                const userId = socket.handshake.auth.userId;
                const orderId = socket.handshake.auth.orderId;

                if (!token || !userId) {
                    return next(new Error('Authentication failed'));
                }

                socket.userId = userId;
                socket.orderId = orderId;
                next();
            } catch (error) {
                logger.error('WebSocket auth error', { error: error.message });
                next(new Error('Authentication error'));
            }
        });

        // WebSocket connection handler
        io.on('connection', (socket) => {
            logger.info('WebSocket client connected', {
                socketId: socket.id,
                userId: socket.userId,
                orderId: socket.orderId,
            });

            // Initialize WebSocket manager
            WebSocketManager.initialize(socket, {
                userId: socket.userId,
                orderId: socket.orderId,
            });

            // Handle order tracking subscription
            socket.on('order:subscribe', (data) => {
                const { orderId } = data;
                socket.join(`order:${orderId}`);
                logger.info('User subscribed to order tracking', {
                    socketId: socket.id,
                    orderId,
                });
                socket.emit('order:subscribed', { orderId, success: true });
            });

            // Handle delivery location updates
            socket.on('delivery:location_update', (data) => {
                const { orderId, latitude, longitude, accuracy, speed } = data;

                // Broadcast to order room
                io.to(`order:${orderId}`).emit('delivery:location_updated', {
                    orderId,
                    latitude,
                    longitude,
                    accuracy,
                    speed,
                    timestamp: new Date(),
                });

                logger.debug('Delivery location update', { orderId, socketId: socket.id });
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                logger.info('WebSocket client disconnected', {
                    socketId: socket.id,
                    userId: socket.userId,
                });
            });

            // Handle errors
            socket.on('error', (error) => {
                logger.error('WebSocket error', {
                    socketId: socket.id,
                    error: error.message,
                });
            });
        });

        // Register IO instance for broadcasting
        WebSocketManager.registerIO('default', io);

        server.listen(config.app.port, () => {
            logger.info(`🚀 ${config.app.name} is running on port ${config.app.port}`);
            logger.info(`📝 Environment: ${config.app.env}`);
            logger.info(`🔄 WebSocket server initialized`);
            logger.info(`🔐 CORS enabled for: ${config.cors.origin.join(', ')}`);
            logger.info(`📝 Swagger docs available at: ${config.app.url}/api-docs`);
        });

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Handle nodemon restarts

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
            process.exit(1);
        });

        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled Rejection', { reason: reason.toString() });
        });

    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };