const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../db');
const { wrap, auth, validate } = require('../middleware');
const { err } = require('../utils');
const DUMMY = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.5l6o5r1p5v3s0l9o8b3yR5Q7mQ2e';

router.post('/login', validate(z.object({ userId: z.string().min(3).max(30), password: z.string().min(1).max(100) })),
  wrap(async (req, res) => {
    const { userId, password } = req.body;
    const [[u]] = await db.query('SELECT * FROM users WHERE user_id=?', [userId.trim().toUpperCase()]);
    const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY);
    if (!u || !ok || !u.is_active) throw err(401, 'Invalid credentials');
    const token = jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '8h' });
    res.json({ token, user: { id: u.id, userId: u.user_id, name: u.name, role: u.role, mustChangePassword: !!u.must_change_password } });
  }));

router.get('/me', auth, (req, res) => res.json({
  id: req.user.id, userId: req.user.user_id, name: req.user.name, role: req.user.role,
  mustChangePassword: !!req.user.must_change_password }));

router.post('/change-password', auth,
  validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) })),
  wrap(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const [[u]] = await db.query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
    if (!(await bcrypt.compare(currentPassword, u.password_hash))) throw err(400, 'Current password is incorrect');
    if (newPassword === currentPassword) throw err(400, 'New password must be different');
    await db.query('UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?',
      [await bcrypt.hash(newPassword, 10), req.user.id]);
    res.json({ message: 'Password updated' });
  }));
module.exports = router;
