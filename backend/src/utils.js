const crypto = require('crypto');
const db = require('./db');
const err = (status, message) => Object.assign(new Error(message), { status });
async function tx(fn) {
  const c = await db.getConnection();
  try { await c.beginTransaction(); const r = await fn(c); await c.commit(); return r; }
  catch (e) { await c.rollback(); throw e; }
  finally { c.release(); }
}
// e.g. STU2026CSE001
async function nextUserId(conn, prefix, deptCode) {
  const base = `${prefix}${new Date().getFullYear()}${deptCode}`;
  const [[r]] = await conn.query(
    'SELECT MAX(CAST(SUBSTRING(user_id, ?) AS UNSIGNED)) m FROM users WHERE user_id LIKE ?',
    [base.length + 1, base + '%']);
  return base + String((r.m || 0) + 1).padStart(3, '0');
}
const genPassword = () => crypto.randomBytes(6).toString('base64url');
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => fmt(new Date());
const THRESHOLD = Number(process.env.ATTENDANCE_THRESHOLD || 75);
module.exports = { err, tx, nextUserId, genPassword, fmt, today, THRESHOLD };
