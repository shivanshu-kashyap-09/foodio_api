const mysql = require('mysql2/promise');
const config = require('../config/config');
const Logger = require('./Logger');

const logger = new Logger('Database');

let pool = null;


async function initializePool() {
    try {
        pool = mysql.createPool({
            host: config.database.host,
            user: config.database.user,
            password: config.database.password,
            database: config.database.database,
            port: config.database.port,
            waitForConnections: config.database.waitForConnections,
            connectionLimit: config.database.connectionLimit,
            queueLimit: config.database.queueLimit,
            enableKeepAlive: config.database.enableKeepAlive,
            charset: config.database.charset,
        });

        // Test connection
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();

        logger.info('Database connection pool initialized successfully', {
            host: config.database.host,
            database: config.database.database,
            poolSize: config.database.connectionLimit,
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
        throw new Error('Database pool not initialized');
    }

    try {
        return await pool.getConnection();
    } catch (error) {
        logger.error('Failed to get database connection', { error: error.message });
        throw error;
    }
}

async function query(sql, values = []) {
    const connection = await getConnection();

    try {
        const [results] = await connection.execute(sql, values);
        return results;
    } catch (error) {
        logger.error('Database query error', {
            sql: sql.substring(0, 200),
            error: error.message,
            code: error.code,
        });
        throw error;
    } finally {
        connection.release();
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
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        logger.error('Failed to commit transaction', { error: error.message });
        throw error;
    } finally {
        connection.release();
    }
}

async function rollbackTransaction(connection) {
    try {
        await connection.rollback();
    } catch (error) {
        logger.error('Failed to rollback transaction', { error: error.message });
    } finally {
        connection.release();
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