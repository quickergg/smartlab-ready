const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: '+08:00',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Verify pool connectivity on startup
db.query('SELECT 1', (err) => {
  if (err) {
    console.error("DB pool connection failed:", err.message);
  } else {
    console.log("MySQL pool ready:", process.env.DB_NAME);
  }
});

module.exports = db;
