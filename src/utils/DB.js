const Database = require('./Database');

// Re-export methods to maintain compatibility with existing code
const DB = {
    query: (sql, values, callback) => {
        Database.query(sql, values)
            .then(results => callback(null, results))
            .catch(err => callback(err));
    },
    execute: (sql, values, callback) => {
        Database.query(sql, values)
            .then(results => callback(null, results))
            .catch(err => callback(err));
    }
};

module.exports = DB;