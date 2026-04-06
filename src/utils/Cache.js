const Redis = require('ioredis');
const config = require('../config/config');
const Logger = require('./Logger');

const logger = new Logger('ioredis');

let client = null;

/**
 * Initialize Redis client
 */
async function initializeRedis() {
    try {
        client = new Redis(config.redis.url, {
            maxRetriesPerRequest: null,
            retryStrategy: (times) => Math.min(times * 50, 2000),
        });

        // Events
        client.on('connect', () => {
            logger.info('✅ Redis client connected');
        });

        client.on('error', (err) => {
            logger.error('❌ Redis client error', { error: err.message });
        });

        client.on('reconnecting', () => {
            logger.warn('⚠️ Redis reconnecting...');
        });

        client.on('ready', () => {
            logger.info('🚀 Redis is ready to use');
        });

        return client;
    } catch (error) {
        logger.error('Failed to initialize Redis', { error: error.message });
        throw error;
    }
}

/**
 * Check Redis connection
 */
async function ping() {
    try {
        if (!client) throw new Error('Redis not initialized');
        const result = await client.ping();
        return result === 'PONG';
    } catch (error) {
        logger.error('Redis ping failed', { error: error.message });
        return false;
    }
}

/**
 * Get value
 */
async function get(key) {
    try {
        if (!client) throw new Error('Redis not initialized');
        return await client.get(key);
    } catch (error) {
        logger.error('Redis GET error', { key, error: error.message });
        return null;
    }
}

/**
 * Set value
 */
async function set(key, value, expirySeconds = null) {
    try {
        if (!client) throw new Error('Redis not initialized');

        const strValue = typeof value === 'object'
            ? JSON.stringify(value)
            : value;

        if (expirySeconds) {
            await client.set(key, strValue, 'EX', expirySeconds);
        } else {
            await client.set(key, strValue);
        }

        return true;
    } catch (error) {
        logger.error('Redis SET error', { key, error: error.message });
        return false;
    }
}

/**
 * Delete key
 */
async function del(key) {
    try {
        if (!client) throw new Error('Redis not initialized');
        await client.del(key);
        return true;
    } catch (error) {
        logger.error('Redis DEL error', { key, error: error.message });
        return false;
    }
}

/**
 * Check existence
 */
async function exists(key) {
    try {
        if (!client) throw new Error('Redis not initialized');
        return (await client.exists(key)) === 1;
    } catch (error) {
        logger.error('Redis EXISTS error', { key, error: error.message });
        return false;
    }
}

/**
 * TTL
 */
async function ttl(key) {
    try {
        if (!client) throw new Error('Redis not initialized');
        return await client.ttl(key);
    } catch (error) {
        logger.error('Redis TTL error', { key, error: error.message });
        return -2;
    }
}

/**
 * Expire key
 */
async function expire(key, seconds) {
    try {
        if (!client) throw new Error('Redis not initialized');
        return await client.expire(key, seconds);
    } catch (error) {
        logger.error('Redis EXPIRE error', { key, error: error.message });
        return false;
    }
}

/**
 * Get keys (⚠️ avoid in production for large datasets)
 */
async function keys(pattern) {
    try {
        if (!client) throw new Error('Redis not initialized');
        return await client.keys(pattern);
    } catch (error) {
        logger.error('Redis KEYS error', { pattern, error: error.message });
        return [];
    }
}

/**
 * Flush all cache
 */
async function flushAll() {
    try {
        if (!client) throw new Error('Redis not initialized');
        await client.flushall();
        logger.info('🧹 Redis cache flushed');
        return true;
    } catch (error) {
        logger.error('Redis FLUSHALL error', { error: error.message });
        return false;
    }
}

/**
 * Close connection
 */
function closeConnection() {
    if (client) {
        client.quit();
        logger.info('🔌 Redis connection closed');
        client = null;
    }
}

module.exports = {
    initializeRedis,
    ping,
    get,
    set,
    del,
    exists,
    ttl,
    expire,
    keys,
    flushAll,
    closeConnection,
};