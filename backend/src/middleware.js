const jwt = require('jsonwebtoken');
const db = require('./db');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const auth = wrap(async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  let p;
  try { p = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const [[u]] = await db.query(
    'SELECT id, user_id, name, role, is_active, must_change_password FROM users WHERE id=?', [p.id]);
  if (!u || !u.is_active) return res.status(401).json({ error: 'Account unavailable' });
  if (u.must_change_password && !req.originalUrl.startsWith('/api/auth/'))
    return res.status(403).json({ error: 'Password change required', code: 'MUST_CHANGE_PASSWORD' });
  req.user = u; next();
});
const role = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden' });
const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return res.status(400).json({
    error: 'Validation failed', details: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
  req.body = r.data; next();
};
module.exports = { wrap, auth, role, validate };
