require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');
const { nextUserId, fmt } = require('./utils');

(async () => {
  const [[{ c }]] = await db.query('SELECT COUNT(*) c FROM users');
  if (c) { console.log('Database not empty. Re-run sql/schema.sql first.'); process.exit(1); }
  const pw = await bcrypt.hash(process.env.SEED_PASSWORD || 'Welcome@123', 10);
  const D = {};
  for (const [code, name] of [['CSE', 'Computer Science & Engineering'], ['ECE', 'Electronics & Communication Engineering'],
    ['EEE', 'Electrical & Electronics Engineering'], ['MECH', 'Mechanical Engineering'], ['CIVIL', 'Civil Engineering']]) {
    D[code] = (await db.query('INSERT INTO departments(code,name) VALUES(?,?)', [code, name]))[0].insertId;
  }
  await db.query("INSERT INTO users(user_id,name,email,password_hash,role) VALUES('ADMIN001','System Admin','admin@college.edu',?,'admin')",
    [await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@123', 10)]);
  const mkUser = async (prefix, dept, name, r) => (await db.query('INSERT INTO users(user_id,name,password_hash,role) VALUES(?,?,?,?)',
    [await nextUserId(db, prefix, dept), name, pw, r]))[0].insertId;

  const F = [];
  for (const [dept, name, des] of [['CSE', 'Dr. Anita Rao', 'Professor'], ['CSE', 'Prof. Vikram Shah', 'Asst. Professor'], ['ECE', 'Dr. Meera Nair', 'Professor']]) {
    const uid = await mkUser('FAC', dept, name, 'faculty');
    F.push((await db.query('INSERT INTO faculty(user_id,department_id,designation) VALUES(?,?,?)', [uid, D[dept], des]))[0].insertId);
  }
  const S = {};
  for (const [code, name, dept] of [['CS201', 'Data Structures', 'CSE'], ['CS202', 'Database Systems', 'CSE'], ['CS203', 'Operating Systems', 'CSE'],
    ['EC201', 'Signals & Systems', 'ECE'], ['EC202', 'Digital Electronics', 'ECE']]) {
    S[code] = (await db.query('INSERT INTO subjects(code,name,department_id,year,semester) VALUES(?,?,?,2,3)', [code, name, D[dept]]))[0].insertId;
  }
  const A = [];
  for (const [fi, code, dept] of [[0, 'CS201', 'CSE'], [0, 'CS202', 'CSE'], [1, 'CS203', 'CSE'], [2, 'EC201', 'ECE'], [2, 'EC202', 'ECE']]) {
    A.push({ dept, subject: S[code], faculty: F[fi],
      id: (await db.query('INSERT INTO class_assignments(faculty_id,subject_id,department_id,year,section) VALUES(?,?,?,2,"A")', [F[fi], S[code], D[dept]]))[0].insertId });
  }
  const names = ['Aarav Mehta', 'Diya Sharma', 'Rohan Iyer', 'Sneha Pillai', 'Karthik Reddy', 'Priya Nair', 'Arjun Das', 'Ishita Gupta',
    'Vivek Kumar', 'Ananya Singh', 'Rahul Verma', 'Neha Joshi', 'Aditya Rao', 'Kavya Menon', 'Siddharth Patel', 'Pooja Bhat',
    'Manish Yadav', 'Lakshmi Devi', 'Faizan Khan', 'Tanvi Kulkarni'];
  const students = [];
  for (let i = 0; i < 20; i++) {
    const dept = i < 12 ? 'CSE' : 'ECE', uid = await mkUser('STU', dept, names[i], 'student');
    const id = (await db.query('INSERT INTO students(user_id,department_id,year,semester,section,roll_no) VALUES(?,?,2,3,"A",?)',
      [uid, D[dept], `R${String(i + 1).padStart(3, '0')}`]))[0].insertId;
    students.push({ id, dept, low: i % 5 === 0 });
  }
  const rows = [];
  for (let d = 1; d <= 21; d++) {
    const dt = new Date(); dt.setDate(dt.getDate() - d);
    if ([0, 6].includes(dt.getDay())) continue;
    A.forEach((a, ai) => students.filter((s) => s.dept === a.dept).forEach((s) => {
      const r = Math.random(), pPresent = s.low ? 0.55 : 0.88;
      rows.push([s.id, a.subject, fmt(dt), ai + 1, r < pPresent ? 'Present' : r < pPresent + 0.08 ? 'Leave' : 'Absent', a.faculty]);
    }));
  }
  await db.query('INSERT INTO attendance(student_id,subject_id,date,period,status,marked_by) VALUES ?', [rows]);
  console.log(`Seeded. Admin: ADMIN001 / ${process.env.SEED_ADMIN_PASSWORD || 'Admin@123'}`);
  console.log(`Faculty & students use ${process.env.SEED_PASSWORD || 'Welcome@123'}. Run: SELECT user_id,name FROM users; (all must change password on first login)`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
