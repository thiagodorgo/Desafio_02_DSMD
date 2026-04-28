const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL não definida.');
}

const pool = new Pool({ connectionString });

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(12,2) NOT NULL,
      customer_email TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function createPendingTransaction({ amount, customerEmail }) {
  const result = await pool.query(
    `INSERT INTO transactions (amount, customer_email, status)
     VALUES ($1, $2, 'PENDING')
     RETURNING id, amount, customer_email, status, created_at, updated_at`,
    [amount, customerEmail],
  );
  return result.rows[0];
}

async function updateTransactionStatus({ transactionId, status }) {
  const result = await pool.query(
    `UPDATE transactions
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, amount, customer_email, status, created_at, updated_at`,
    [transactionId, status],
  );
  return result.rows[0];
}

async function getTransactionById(transactionId) {
  const result = await pool.query(
    `SELECT id, amount, customer_email, status, created_at, updated_at
     FROM transactions
     WHERE id = $1`,
    [transactionId],
  );
  return result.rows[0] || null;
}

module.exports = {
  ensureSchema,
  createPendingTransaction,
  updateTransactionStatus,
  getTransactionById,
};
