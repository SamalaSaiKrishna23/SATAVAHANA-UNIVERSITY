const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const { wrap, auth, role, validate } = require('../middleware');
const { err, tx, nextUserId, genPassword } = require('../utils');
router.use(auth, role('admin'));

const PCT = (a = 'a') => `ROUND(100*SUM(${a}.status='Present')/COUNT(*),1)`;
async function createUser(c, { prefix, deptId, name, email, role: r }) {
  const [[d]] = await c.query('SELECT code FROM departments WHERE id=?', [deptId]);
  if (!d) throw err(400, 'Invalid department');
  const userId = await nextUserId(c, prefix, d.code), password = genPassword();
  const [x] = await c.query('INSERT INTO users(user_id,name,email,password_hash,role) VALUES(?,?,?,?,?)',
    [userId, name, email ?? null, await bcrypt.hash(password, 10), r]);
  return { pk: x.insertId, userId, password };
}

// ---------- Departments ----------
router.get('/departments', wrap(async (req, res) => res.json((await db.query('SELECT id, code, name FROM departments ORDER BY code'))[0])));
router.post('/departments', validate(z.object({ code: z.string().min(2).max(10).transform((s) => s.toUpperCase()), name: z.string().min(2).max(100) })),
  wrap(async (req, res) => {
    const [r] = await db.query('INSERT INTO departments(code,name) VALUES(?,?)', [req.body.code, req.body.name]);
    res.status(201).json({ id: r.insertId, ...req.body });
  }));
router.delete('/departments/:id', wrap(async (req, res) => { await db.query('DELETE FROM departments WHERE id=?', [req.params.id]); res.json({ message: 'Deleted' }); }));

// ---------- Students ----------
const stuSchema = z.object({
  name: z.string().min(2).max(100), email: z.string().email().nullish(),
  departmentId: z.number().int(), year: z.number().int().min(1).max(4), semester: z.number().int().min(1).max(8),
  section: z.string().min(1).max(5), rollNo: z.string().max(30).nullish() });
router.get('/students', wrap(async (req, res) => {
  const { departmentId, year, section, q } = req.query, w = [], p = [];
  if (departmentId) { w.push('s.department_id=?'); p.push(departmentId); }
  if (year) { w.push('s.year=?'); p.push(year); }
  if (section) { w.push('s.section=?'); p.push(section); }
  if (q) { w.push('(u.name LIKE ? OR u.user_id LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  const [rows] = await db.query(`SELECT s.id, u.id userPk, u.user_id userId, u.name, u.email, u.is_active isActive,
    d.code department, s.department_id departmentId, s.year, s.semester, s.section, s.roll_no rollNo
    FROM students s JOIN users u ON u.id=s.user_id JOIN departments d ON d.id=s.department_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY u.user_id`, p);
  res.json(rows);
}));
router.post('/students', validate(stuSchema), wrap(async (req, res) => {
  const b = req.body;
  const out = await tx(async (c) => {
    const u = await createUser(c, { prefix: 'STU', deptId: b.departmentId, name: b.name, email: b.email, role: 'student' });
    const [r] = await c.query('INSERT INTO students(user_id,department_id,year,semester,section,roll_no) VALUES(?,?,?,?,?,?)',
      [u.pk, b.departmentId, b.year, b.semester, b.section.toUpperCase(), b.rollNo ?? null]);
    return { id: r.insertId, userId: u.userId, initialPassword: u.password };
  });
  res.status(201).json(out); // initialPassword is shown only once
}));
router.put('/students/:id', validate(stuSchema), wrap(async (req, res) => {
  const b = req.body;
  await tx(async (c) => {
    const [[s]] = await c.query('SELECT user_id FROM students WHERE id=?', [req.params.id]);
    if (!s) throw err(404, 'Student not found');
    await c.query('UPDATE users SET name=?, email=? WHERE id=?', [b.name, b.email ?? null, s.user_id]);
    await c.query('UPDATE students SET department_id=?, year=?, semester=?, section=?, roll_no=? WHERE id=?',
      [b.departmentId, b.year, b.semester, b.section.toUpperCase(), b.rollNo ?? null, req.params.id]);
  });
  res.json({ message: 'Updated' });
}));

// ---------- Faculty ----------
const facSchema = z.object({ name: z.string().min(2).max(100), email: z.string().email().nullish(),
  departmentId: z.number().int(), designation: z.string().max(60).nullish() });
router.get('/faculty', wrap(async (req, res) => {
  const [rows] = await db.query(`SELECT f.id, u.id userPk, u.user_id userId, u.name, u.email, u.is_active isActive,
    d.code department, f.department_id departmentId, f.designation
    FROM faculty f JOIN users u ON u.id=f.user_id JOIN departments d ON d.id=f.department_id ORDER BY u.user_id`);
  res.json(rows);
}));
router.post('/faculty', validate(facSchema), wrap(async (req, res) => {
  const b = req.body;
  const out = await tx(async (c) => {
    const u = await createUser(c, { prefix: 'FAC', deptId: b.departmentId, name: b.name, email: b.email, role: 'faculty' });
    const [r] = await c.query('INSERT INTO faculty(user_id,department_id,designation) VALUES(?,?,?)', [u.pk, b.departmentId, b.designation ?? null]);
    return { id: r.insertId, userId: u.userId, initialPassword: u.password };
  });
  res.status(201).json(out);
}));
router.put('/faculty/:id', validate(facSchema), wrap(async (req, res) => {
  const b = req.body;
  await tx(async (c) => {
    const [[f]] = await c.query('SELECT user_id FROM faculty WHERE id=?', [req.params.id]);
    if (!f) throw err(404, 'Faculty not found');
    await c.query('UPDATE users SET name=?, email=? WHERE id=?', [b.name, b.email ?? null, f.user_id]);
    await c.query('UPDATE faculty SET department_id=?, designation=? WHERE id=?', [b.departmentId, b.designation ?? null, req.params.id]);
  });
  res.json({ message: 'Updated' });
}));

// ---------- User actions (by users.id) ----------
router.patch('/users/:id/status', validate(z.object({ isActive: z.boolean() })), wrap(async (req, res) => {
  const [r] = await db.query("UPDATE users SET is_active=? WHERE id=? AND role<>'admin'", [req.body.isActive ? 1 : 0, req.params.id]);
  if (!r.affectedRows) throw err(404, 'User not found');
  res.json({ message: 'Status updated' });
}));
router.post('/users/:id/reset-password', wrap(async (req, res) => {
  const password = genPassword();
  const [r] = await db.query("UPDATE users SET password_hash=?, must_change_password=1 WHERE id=? AND role<>'admin'",
    [await bcrypt.hash(password, 10), req.params.id]);
  if (!r.affectedRows) throw err(404, 'User not found');
  res.json({ newPassword: password });
}));
router.delete('/users/:id', wrap(async (req, res) => {
  const [r] = await db.query("DELETE FROM users WHERE id=? AND role<>'admin'", [req.params.id]);
  if (!r.affectedRows) throw err(404, 'User not found');
  res.json({ message: 'Deleted' });
}));

// ---------- Subjects ----------
router.get('/subjects', wrap(async (req, res) => {
  const p = [], w = req.query.departmentId ? (p.push(req.query.departmentId), 'WHERE s.department_id=?') : '';
  res.json((await db.query(`SELECT s.id, s.code, s.name, s.year, s.semester, s.department_id departmentId, d.code department
    FROM subjects s JOIN departments d ON d.id=s.department_id ${w} ORDER BY d.code, s.year, s.code`, p))[0]);
}));
router.post('/subjects', validate(z.object({ code: z.string().min(2).max(20), name: z.string().min(2).max(100),
  departmentId: z.number().int(), year: z.number().int().min(1).max(4), semester: z.number().int().min(1).max(8) })),
  wrap(async (req, res) => {
    const b = req.body;
    const [r] = await db.query('INSERT INTO subjects(code,name,department_id,year,semester) VALUES(?,?,?,?,?)',
      [b.code.toUpperCase(), b.name, b.departmentId, b.year, b.semester]);
    res.status(201).json({ id: r.insertId });
  }));
router.delete('/subjects/:id', wrap(async (req, res) => { await db.query('DELETE FROM subjects WHERE id=?', [req.params.id]); res.json({ message: 'Deleted' }); }));

// ---------- Class assignments (faculty -> subject + section; dept/year come from the subject) ----------
router.get('/assignments', wrap(async (req, res) => res.json((await db.query(`SELECT ca.id, ca.section, ca.year, d.code department,
  sub.code subjectCode, sub.name subjectName, u.name facultyName, u.user_id facultyUserId, ca.faculty_id facultyId
  FROM class_assignments ca JOIN subjects sub ON sub.id=ca.subject_id JOIN departments d ON d.id=ca.department_id
  JOIN faculty f ON f.id=ca.faculty_id JOIN users u ON u.id=f.user_id ORDER BY d.code, ca.year, ca.section`))[0])));
router.post('/assignments', validate(z.object({ facultyId: z.number().int(), subjectId: z.number().int(), section: z.string().min(1).max(5) })),
  wrap(async (req, res) => {
    const [[s]] = await db.query('SELECT department_id, year FROM subjects WHERE id=?', [req.body.subjectId]);
    if (!s) throw err(400, 'Invalid subject');
    const [r] = await db.query('INSERT INTO class_assignments(faculty_id,subject_id,department_id,year,section) VALUES(?,?,?,?,?)',
      [req.body.facultyId, req.body.subjectId, s.department_id, s.year, req.body.section.toUpperCase()]);
    res.status(201).json({ id: r.insertId });
  }));
router.delete('/assignments/:id', wrap(async (req, res) => { await db.query('DELETE FROM class_assignments WHERE id=?', [req.params.id]); res.json({ message: 'Deleted' }); }));

// ---------- Dashboard ----------
router.get('/dashboard', wrap(async (req, res) => {
  const q = async (sql) => (await db.query(sql))[0];
  const [[totals]] = await db.query(`SELECT
    (SELECT COUNT(*) FROM students s JOIN users u ON u.id=s.user_id WHERE u.is_active) students,
    (SELECT COUNT(*) FROM faculty f JOIN users u ON u.id=f.user_id WHERE u.is_active) faculty,
    (SELECT ROUND(100*SUM(status='Present')/COUNT(*),1) FROM attendance) overallPct`);
  const [byDept, below, daily, weekly, monthly, notMarked] = await Promise.all([
    q(`SELECT d.code, d.name,
        (SELECT COUNT(*) FROM students s WHERE s.department_id=d.id) students,
        (SELECT COUNT(*) FROM faculty f WHERE f.department_id=d.id) faculty,
        (SELECT ${PCT('a')} FROM attendance a JOIN students s ON s.id=a.student_id WHERE s.department_id=d.id) attendancePct
       FROM departments d ORDER BY d.code`),
    q(`SELECT s.id, u.user_id userId, u.name, d.code department, s.year, s.section, ${PCT('a')} pct
       FROM attendance a JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id JOIN departments d ON d.id=s.department_id
       GROUP BY s.id, u.user_id, u.name, d.code, s.year, s.section HAVING pct < ${Number(process.env.ATTENDANCE_THRESHOLD || 75)}
       ORDER BY pct LIMIT 100`),
    q(`SELECT date, ${PCT('a')} pct FROM attendance a WHERE date >= CURDATE() - INTERVAL 30 DAY GROUP BY date ORDER BY date`),
    q(`SELECT YEARWEEK(date,1) week, MIN(date) startDate, ${PCT('a')} pct FROM attendance a
       WHERE date >= CURDATE() - INTERVAL 12 WEEK GROUP BY YEARWEEK(date,1) ORDER BY week`),
    q(`SELECT DATE_FORMAT(date,'%Y-%m') month, ${PCT('a')} pct FROM attendance a
       WHERE date >= CURDATE() - INTERVAL 12 MONTH GROUP BY DATE_FORMAT(date,'%Y-%m') ORDER BY month`),
    q(`SELECT f.id, u.name, u.user_id userId FROM faculty f JOIN users u ON u.id=f.user_id
       WHERE u.is_active AND EXISTS (SELECT 1 FROM class_assignments ca WHERE ca.faculty_id=f.id)
       AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.marked_by=f.id AND a.date=CURDATE())`),
  ]);
  res.json({ totals, byDept, belowThreshold: below, trends: { daily, weekly, monthly }, facultyNotMarkedToday: notMarked });
}));

// ---------- CSV export (opens in Excel) ----------
router.get('/export/attendance', wrap(async (req, res) => {
  const { from, to, departmentId } = req.query, w = [], p = [];
  if (from) { w.push('a.date>=?'); p.push(from); }
  if (to) { w.push('a.date<=?'); p.push(to); }
  if (departmentId) { w.push('s.department_id=?'); p.push(departmentId); }
  const [rows] = await db.query(`SELECT a.date, a.period, u.user_id, u.name, d.code dept, s.year, s.section, sub.code subject, a.status
    FROM attendance a JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id JOIN departments d ON d.id=s.department_id
    JOIN subjects sub ON sub.id=a.subject_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY a.date, d.code, u.user_id LIMIT 200000`, p);
  const esc = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const head = ['Date', 'Period', 'UserID', 'Name', 'Dept', 'Year', 'Section', 'Subject', 'Status'];
  const csv = [head.join(','), ...rows.map((r) => Object.values(r).map(esc).join(','))].join('\n');
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="attendance.csv"' }).send(csv);
}));
module.exports = router;
