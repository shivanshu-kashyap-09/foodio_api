require('dotenv').config();
const mysql = require('mysql2');
const fs = require('fs');

const connection = mysql.createConnection({
  host: process.env.HOST_NAME,
  user: process.env.USER,
  password: process.env.PASSWORD,
  multipleStatements: true
});
connection.connect((err) => {
  if (err) {
    console.error("Connection error:", err);
    return;
  }
  console.log("Connected to MySQL server");
  console.log('Connected as ID ' + connection.threadId);
  const sqlFile = fs.readFileSync("foodio.sql", "utf8");

  connection.query(sqlFile, (err) => {
    if (err) {
      console.error("Error executing SQL file:", err);
    } else {
      console.log("Database schema imported successfully");
    }
  });
});

module.exports = connection;
