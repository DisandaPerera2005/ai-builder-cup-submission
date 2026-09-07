// PostgreSQL (Cloud SQL) connection for whatsapp_messages (fello-backend/db/schema.sql).

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

// RLS (db/migrations/003) requires app.org_id to be set on the SAME
// connection as the statement it scopes — so take a dedicated client and run
// both inside one transaction (set_config with is_local=true resets
// automatically at commit, leaking nothing back into the pool).
async function queryWithOrg(orgId, sql, params) {
  const p = getPool();
  if (!p) return null; // Cloud SQL not configured yet — degrade gracefully.
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function insertMessage({ orgId, eventId, groupJid, senderId, senderName, body, timestamp }) {
  await queryWithOrg(
    orgId,
    `INSERT INTO whatsapp_messages (org_id, event_id, group_jid, sender_id, sender_name, body, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [orgId, eventId, groupJid, senderId, senderName, body, timestamp]
  );
}

module.exports = { insertMessage, queryWithOrg, getPool };
