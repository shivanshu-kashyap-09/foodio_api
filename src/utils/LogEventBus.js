const { EventEmitter } = require('events');

/**
 * LogEventBus — singleton in-process event bus for real-time log streaming.
 * The Logger class emits every log entry here so SSE clients can subscribe.
 */
class LogEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(200); // allow many concurrent SSE connections
        /** @type {Array<{id:number,timestamp:string,level:string,context:string,message:string,data:string|null}>} */
        this._buffer = [];
        this._maxBuffer = 500; // keep last 500 entries in memory
        this._seq = 0;
    }

    /**
     * Called by Logger for every log entry.
     * @param {string} level
     * @param {string} context
     * @param {string} message
     * @param {any}    data
     */
    push(level, context, message, data = null) {
        const entry = {
            id: ++this._seq,
            timestamp: new Date().toISOString(),
            level,
            context,
            message,
            data: data ? (typeof data === 'object' ? JSON.stringify(data) : String(data)) : null,
        };

        // Keep ring-buffer
        this._buffer.push(entry);
        if (this._buffer.length > this._maxBuffer) {
            this._buffer.shift();
        }

        this.emit('log', entry);
    }

    /**
     * Return the last `n` buffered log entries (newest-last).
     * @param {number} n
     */
    recent(n = 100) {
        return this._buffer.slice(-n);
    }
}

module.exports = new LogEventBus();
