const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

let pool;
let hasLoggedFirstConnection = false;

function getPool() {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString || !connectionString.trim()) {
    console.warn('DATABASE_URL is not set. Neon PostgreSQL connection is not configured yet.');
    return null;
  }

  const isLocalConnection = /localhost|127\.0\.0\.1/.test(connectionString);

  pool = new Pool({
    connectionString,
    ssl: isLocalConnection ? false : { rejectUnauthorized: false }
  });

  pool.on('error', (error) => {
    console.error('Unexpected Neon PostgreSQL pool error:', error.message);
  });

  return pool;
}

async function query(sql, params = []) {
  const activePool = getPool();

  if (!activePool) {
    throw new Error('DATABASE_URL is not configured. Please update backend/.env.');
  }

  let client;

  try {
    client = await activePool.connect();

    if (!hasLoggedFirstConnection) {
      console.log('Connected to Neon PostgreSQL successfully');
      hasLoggedFirstConnection = true;
    }

    return await client.query(sql, params);
  } catch (error) {
    console.error('Neon PostgreSQL query error:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = undefined;
    hasLoggedFirstConnection = false;
  }
}

module.exports = {
  query,
  close
};
