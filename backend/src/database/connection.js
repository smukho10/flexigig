const pg = require("pg");
require("dotenv").config();

const client = new pg.Client({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT) || 5432,

  // Required for Render managed Postgres (SSL/TLS)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

client
  .connect()
  .then(() => console.log("Connected to Postgres ✅"))
  .catch((e) => console.log(`Error connecting to Postgres server:\n${e}`));

module.exports = client;

// const pg = require("pg");
// require("dotenv").config();

// const client = new pg.Client({
//   host: process.env.PGHOST || "localhost",
//   database: process.env.PGDATABASE || "flexygig_web",
//   user: process.env.PGUSER || "postgres",
//   password: process.env.PGPASSWORD || "",
//   port: Number(process.env.PGPORT) || 5432,

//   // 🔧 LOCAL DEVELOPMENT FIX
//   // Disable SSL for local Postgres (cloud DBs require SSL, local does not)
//   ssl: false,
// });

// client
//   .connect()
//   .then(() => console.log("✅ Connected to Postgres"))
//   .catch((e) => console.error("❌ Error connecting to Postgres:\n", e));

// module.exports = client;
