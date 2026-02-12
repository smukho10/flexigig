const pg = require("pg");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const client = process.env.DATABASE_URL
  ? new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    })
  : new pg.Client({
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      port: Number(process.env.PGPORT) || 5432,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    });

client
  .connect()
  .then(() => console.log("Connected to Postgres ✅"))
  .catch((e) => console.log(`Error connecting to Postgres server:\n${e}`));

module.exports = client;
