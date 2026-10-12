/**
 * Main Express Application
 * Portal Kampus Fiktif untuk Praktikum Keamanan Web
 */

const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv');
dotenv.config();

const { labModeMiddleware, csrfMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const lecturerRoutes = require('./routes/lecturerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const discussionRoutes = require('./routes/discussionRoutes');
const labRoutes = require('./routes/labRoutes');
const apiRoutes = require('./routes/apiRoutes');
const studentController = require('./controllers/studentController');
const { isAuthenticated } = require('./middleware/auth');

const app = express();

// View Engine Setup (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Body Parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
const uploadsStaticDir = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsStaticDir));

// Session Configuration (Server-Side Session)
app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'kunci-rahasia-sesi-laboratorium-praktikum-keamanan-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Localhost development
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 jam
  }
}));

// Lab Mode & CSRF Middlewares
app.use(labModeMiddleware);
app.use(csrfMiddleware);

// Middleware untuk menyediakan data sesi dan user ke seluruh template EJS
app.use((req, res, next) => {
  res.locals.user = req.session ? req.session.user : null;
  res.locals.currentPath = req.path;
  next();
});

// Routing
app.use('/auth', authRoutes);
app.use('/student', studentRoutes);
app.use('/lecturer', lecturerRoutes);
app.use('/admin', adminRoutes);
app.use('/discussions', discussionRoutes);
app.use('/lab', labRoutes);
app.use('/api', apiRoutes);

// Shared Profile Route
app.get('/profile', isAuthenticated, studentController.showProfile);

// Root Route
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') return res.redirect('/admin/dashboard');
    if (req.session.user.role === 'lecturer') return res.redirect('/lecturer/dashboard');
    return res.redirect('/student/dashboard');
  }
  res.redirect('/lab');
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Halaman Tidak Ditemukan (404)',
    message: `Rute '${req.originalUrl}' tidak ditemukan pada sistem laboratorium.`,
    statusCode: 404
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[GLOBAL_ERROR]', err);
  const status = err.status || 500;
  res.status(status).render('error', {
    title: `Kesalahan Aplikasi (${status})`,
    message: err.message || 'Terjadi kesalahan sistem yang tidak diharapkan.',
    statusCode: status
  });
});

module.exports = app;
