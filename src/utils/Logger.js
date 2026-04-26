const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const LogEventBus = require('./LogEventBus');

// Create logs directory if it doesn't exist
const logsDir = config.logging.dir;
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
    TRACE: 'TRACE',
};

const LOG_LEVEL_PRIORITY = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4,
};

class Logger {
    constructor(context = 'APP') {
        this.context = context;
        this.currentLevel = LOG_LEVEL_PRIORITY[config.logging.level] ?? LOG_LEVEL_PRIORITY.INFO;
    }

    /**
     * Format log message with timestamp and context
     */
    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` | ${typeof data === 'object' ? JSON.stringify(data) : data}` : '';
        return `[${timestamp}] [${this.context}] [${level}] ${message}${dataStr}`;
    }

    /**
     * Write log to file
     */
    writeToFile(level, message, data = null) {
        const formatted = this.formatMessage(level, message, data);
        const logFile = path.join(logsDir, `${level.toLowerCase()}.log`);
        const allLogsFile = path.join(logsDir, 'all.log');

        fs.appendFileSync(logFile, formatted + '\n', { encoding: 'utf8' });
        fs.appendFileSync(allLogsFile, formatted + '\n', { encoding: 'utf8' });
    }

    /**
     * Write log to console
     */
    writeToConsole(level, message, data = null) {
        const formatted = this.formatMessage(level, message, data);
        const colors = {
            ERROR: '\x1b[31m', // Red
            WARN: '\x1b[33m', // Yellow
            INFO: '\x1b[36m', // Cyan
            DEBUG: '\x1b[35m', // Magenta
            TRACE: '\x1b[90m', // Gray
        };
        const reset = '\x1b[0m'; 

        if (!config.app.isProduction) {
            console.log(`${colors[level]}${formatted}${reset}`);
        } else {
            console.log(formatted);
        }
    }

    /**
     * Log message
     */
    log(level, message, data = null) {
        const levelPriority = LOG_LEVEL_PRIORITY[level] ?? LOG_LEVEL_PRIORITY.INFO;

        if (levelPriority <= this.currentLevel) {
            this.writeToConsole(level, message, data);
            if (config.app.isProduction) {
                this.writeToFile(level, message, data);
            }
        }

        // Always push to the in-memory bus for real-time SSE streaming
        // (regardless of log level filter — admins should see everything)
        LogEventBus.push(level, this.context, message, data);
    }

    error(message, data = null) {
        this.log(LOG_LEVELS.ERROR, message, data);
    }

    warn(message, data = null) {
        this.log(LOG_LEVELS.WARN, message, data);
    }

    info(message, data = null) {
        this.log(LOG_LEVELS.INFO, message, data);
    }

    debug(message, data = null) {
        this.log(LOG_LEVELS.DEBUG, message, data);
    }

    trace(message, data = null) {
        this.log(LOG_LEVELS.TRACE, message, data);
    }
}

module.exports = Logger;
