const router = require('express').Router();
const { z } = require('zod');
const db = require('../db');
const { wrap, auth, role, validate } = require('../middleware');
const { err, tx, today, THRESHOLD } = require('../utils');

router.use(auth, role('faculty'), wrap(async (req, res, next) => {
  const [[f]] = await db.query('SELECT id FROM faculty WHERE user_id=?', [req.user.id]);
  if (!f) throw err(403, 'No faculty profile');
  req.fid = f.id; next();
}));
async function getAssignment(fid, id) {
  const [[a]] = await db.query('SELECT * FROM class_assignments WHERE id=? AND faculty_id=?', [Number(id), fid]);
  if (!a) throw err(403, 'Not your class');
  return a;
}
const rosterSql = `FROM students s JOIN users u ON u.id=s.user_id WHERE u.is_active AND s.department_id=? AND s.year=? AND s.section=?`;

router.get('/classes', wrap(async (req, res) => {
  const [rows] = await db.query(`SELECT ca.id, ca.section, ca.year, d.code department, sub.id subjectId, sub.code subjectCode, sub.name subjectName,
    (SELECT COUNT(*) ${rosterSql.replace('s.department_id=?', 's.department_id=ca.department_id').replace('s.year=?', 's.year=ca.year').replace('s.section=?', 's.section=ca.section')}) studentCount
    FROM class_assignments ca JOIN subjects sub ON sub.id=ca.subject_id JOIN departments d ON d.id=ca.department_id
    WHERE ca.faculty_id=? ORDER BY d.code, ca.year, sub.code`, [req.fid]);
  res.json(rows);
}));

router.get('/roster', wrap(async (req, res) => {
  const a = await getAssignment(req.fid, req.query.assignmentId);
  const [rows] = await db.query(`SELECT s.id studentId, u.user_id userId, u.name, s.roll_no rollNo, att.status
    FROM students s JOIN users u ON u.id=s.user_id
    LEFT JOIN attendance att ON att.student_id=s.id AND att.subject_id=? AND att.date=? AND att.period=?
    WHERE u.is_active AND s.department_id=? AND s.year=? AND s.section=? ORDER BY s.roll_no, u.user_id`,
    [a.subject_id, req.query.date || today(), Number(req.query.period || 1), a.department_id, a.year, a.section]);
  res.json(rows);
}));

router.post('/attendance', validate(z.object({
  assignmentId: z.number().int(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), period: z.number().int().min(1).max(10),
  records: z.array(z.object({ studentId: z.number().int(), status: z.enum(['Present', 'Absent', 'Leave']) })).min(1).max(300) })),
  wrap(async (req, res) => {
    const b = req.body;
    if (b.date > today()) throw err(400, 'Cannot mark attendance for a future date');
    const a = await getAssignment(req.fid, b.assignmentId);
    const [ids] = await db.query(`SELECT s.id ${rosterSql}`, [a.department_id, a.year, a.section]);
    const valid = new Set(ids.map((r) => r.id));
    if (b.records.some((r) => !valid.has(r.studentId))) throw err(400, 'Record contains a student outside this class');
    // Edits allowed only on the day attendance was first recorded
    const [[lock]] = await db.query('SELECT COUNT(*) c FROM attendance WHERE subject_id=? AND date=? AND period=? AND DATE(created_at) < CURDATE()',
      [a.subject_id, b.date, b.period]);
    if (lock.c > 0) throw err(403, 'This attendance is locked; it can only be edited on the day it was marked');
    await tx((c) => c.query(`INSERT INTO attendance(student_id, subject_id, date, period, status, marked_by) VALUES ?
      ON DUPLICATE KEY UPDATE status=VALUES(status), marked_by=VALUES(marked_by)`,
      [b.records.map((r) => [r.studentId, a.subject_id, b.date, b.period, r.status, req.fid])]));
    res.json({ message: 'Attendance saved', count: b.records.length });
  }));

router.get('/report', wrap(async (req, res) => {
  const a = await getAssignment(req.fid, req.query.assignmentId);
  const [rows] = await db.query(`SELECT s.id studentId, u.user_id userId, u.name,
    COALESCE(SUM(att.status='Present'),0) present, COALESCE(SUM(att.status='Absent'),0) absent, COALESCE(SUM(att.status='Leave'),0) leaveCount,
    COUNT(att.id) total, ROUND(100*SUM(att.status='Present')/NULLIF(COUNT(att.id),0),1) pct
    FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN attendance att ON att.student_id=s.id AND att.subject_id=?
    WHERE u.is_active AND s.department_id=? AND s.year=? AND s.section=? GROUP BY s.id, u.user_id, u.name ORDER BY u.user_id`,
    [a.subject_id, a.department_id, a.year, a.section]);
  res.json(req.query.lowOnly ? rows.filter((r) => r.pct !== null && r.pct < THRESHOLD) : rows);
}));
module.exports = router;
