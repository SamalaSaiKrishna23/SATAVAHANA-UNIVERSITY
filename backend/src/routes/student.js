const router = require('express').Router();
const db = require('../db');
const { wrap, auth, role } = require('../middleware');
const { err, THRESHOLD } = require('../utils');

router.use(auth, role('student'), wrap(async (req, res, next) => {
  const [[s]] = await db.query('SELECT id FROM students WHERE user_id=?', [req.user.id]);
  if (!s) throw err(403, 'No student profile');
  req.sid = s.id; next();
}));

router.get('/summary', wrap(async (req, res) => {
  const [subjects] = await db.query(`SELECT sub.id subjectId, sub.code, sub.name,
    SUM(a.status='Present') present, SUM(a.status='Absent') absent, SUM(a.status='Leave') leaveCount, COUNT(a.id) total,
    ROUND(100*SUM(a.status='Present')/COUNT(a.id),1) pct
    FROM attendance a JOIN subjects sub ON sub.id=a.subject_id WHERE a.student_id=? GROUP BY sub.id, sub.code, sub.name ORDER BY sub.code`, [req.sid]);
  const total = subjects.reduce((n, s) => n + s.total, 0), present = subjects.reduce((n, s) => n + Number(s.present), 0);
  const overallPct = total ? Math.round((1000 * present) / total) / 10 : null;
  res.json({ threshold: THRESHOLD, overallPct, overallWarning: overallPct !== null && overallPct < THRESHOLD,
    subjects: subjects.map((s) => ({ ...s, warning: s.pct < THRESHOLD })) });
}));

router.get('/calendar', wrap(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw err(400, 'month must be YYYY-MM');
  const [rows] = await db.query(`SELECT a.date, a.period, sub.code subject, a.status FROM attendance a JOIN subjects sub ON sub.id=a.subject_id
    WHERE a.student_id=? AND a.date >= ? AND a.date < DATE_ADD(?, INTERVAL 1 MONTH) ORDER BY a.date, a.period`,
    [req.sid, `${month}-01`, `${month}-01`]);
  res.json({ month, days: rows });
}));
module.exports = router;
