const mysql = require('mysql2/promise');

// One shared connection pool for the whole API
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+08:00',   // store and read DATETIME values as Malaysia time
  decimalNumbers: true, // return DECIMAL columns (prices) as numbers, not strings
});

module.exports = pool;
