const mysql = require('mysql2/promise');
const config = require('../config/config');
const Logger = require('./Logger');

const logger = new Logger('Database');

let pool = null;

async function initializePool() {
    // Prevent multiple initializations (Singleton pattern)
    if (pool) {
        return pool;
    }

    try {
        pool = mysql.createPool({
            host: config.database.host,
            user: config.database.user,
            password: config.database.password,
            database: config.database.database,
            port: config.database.port,
            waitForConnections: true,
            connectionLimit: 3, // Reduced from 5 to avoid hitting filess.io hard cap during parallel dashboard calls
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
            connectTimeout: 20000,
            charset: config.database.charset,
            // Optimized for remote/limited DBs like filess.io
            maxIdle: 10,
            idleTimeout: 30000, // Close idle connections after 30s
            dateStrings: true, // Return dates as strings to avoid timezone confusion
        });

        // Add pool error listener to handle unexpected connection closures
        pool.on('error', (err) => {
            logger.error('Unexpected error on idle database connection', { 
                error: err.message, 
                code: err.code 
            });
            if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
                pool = null; // Mark pool for re-initialization on next query
            }
        });

        // Test connection
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();

        logger.info('Database connection pool initialized successfully', {
            host: config.database.host,
            poolSize: 5,
        });

        return pool;
    } catch (error) {
        logger.error('Failed to initialize database connection pool', {
            error: error.message,
            code: error.code,
        });
        throw error;
    }
}

async function getConnection() {
    if (!pool) {
        await initializePool();
    }

    try {
        return await pool.getConnection();
    } catch (error) {
        logger.error('Failed to get database connection', { error: error.message });
        throw error;
    }
}

/**
 * Executes a query using pool.query() directly.
 * This automatically handles connection acquisition and release.
 */
async function query(sql, values = []) {
    if (!pool) {
        await initializePool();
    }

    // Monitor pool status (only in development)
    if (process.env.NODE_ENV !== 'production' && pool.pool) {
        const poolInfo = {
            all: pool.pool._allConnections?.length || 0,
            free: pool.pool._freeConnections?.length || 0,
            queued: pool.pool._connectionQueue?.length || 0
        };
        logger.debug('Pool status before query', poolInfo);
    }

    try {
        // pool.query automatically handles acquiring and releasing connections
        // and is more flexible than execute() for varied parameter types
        const [results] = await pool.query(sql, values);
        return results;
    } catch (error) {
        logger.error('Database query error', {
            sql: sql.substring(0, 200),
            error: error.message,
            code: error.code,
        });
        throw error;
    }
}

async function queryOne(sql, values = []) {
    const results = await query(sql, values);
    return results.length > 0 ? results[0] : null;
}

async function beginTransaction() {
    const connection = await getConnection();

    try {
        await connection.beginTransaction();
        return connection;
    } catch (error) {
        connection.release();
        logger.error('Failed to begin transaction', { error: error.message });
        throw error;
    }
}

async function commitTransaction(connection) {
    try {
        if (connection) {
            await connection.commit();
        }
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        logger.error('Failed to commit transaction', { error: error.message });
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

async function rollbackTransaction(connection) {
    try {
        if (connection) {
            await connection.rollback();
        }
    } catch (error) {
        logger.error('Failed to rollback transaction', { error: error.message });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('Database connection pool closed');
    }
}

module.exports = {
    initializePool,
    getConnection,
    query,
    queryOne,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    closePool,
};