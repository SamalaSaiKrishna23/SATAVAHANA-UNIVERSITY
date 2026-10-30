require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Set JWT_SECRET (32+ chars) in .env'); process.exit(1);
}
const app = express();
app.set('trust proxy', 1);
app.use(helmet(), cors({ origin: process.env.CLIENT_URL || 'https://satavahana-university.vercel.app' }), express.json({ limit: '100kb' }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Too many login attempts. Try again later.' } }));
app.get('/', (req, res) => {
  res.send('Satavahana University Backend is running!');
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/student', require('./routes/student'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
const dist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
app.use((e, req, res, next) => { // eslint-disable-line
  if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Duplicate entry' });
  if (e.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'Record is in use by other data' });
  if (e.status) return res.status(e.status).json({ error: e.message });
  console.error(e); res.status(500).json({ error: 'Server error' });
});
const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
