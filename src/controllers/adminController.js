/**
 * Admin Controller
 * Mengelola pengguna, kelas/mata kuliah, audit logs, dan data akademik sintetis
 * Mendemonstrasikan target Skenario 8 (Privilege Escalation)
 */

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { getRecentLogs, logActivity } = require('../services/auditService');

/**
 * Tampilkan Dashboard Admin
 */
async function showDashboard(req, res) {
  try {
    const userCount = (await db.query('SELECT COUNT(*) as count FROM users'))[0].count;
    const studentCount = (await db.query('SELECT COUNT(*) as count FROM students'))[0].count;
    const lecturerCount = (await db.query('SELECT COUNT(*) as count FROM lecturers'))[0].count;
    const courseCount = (await db.query('SELECT COUNT(*) as count FROM courses'))[0].count;
    const logs = await getRecentLogs(10);

    res.render('admin/dashboard', {
      title: 'Dashboard Administrator - Portal Kampus Lab',
      stats: { userCount, studentCount, lecturerCount, courseCount },
      recentLogs: logs,
      labMode: req.labMode
    });
  } catch (err) {
    console.error('[ADMIN_DASHBOARD_ERROR]', err);
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * Tampilkan Kelola Pengguna
 */
async function showUsers(req, res) {
  try {
    const users = await db.query(
      `SELECT u.*, s.nim, s.program_study, l.nidn, l.department 
       FROM users u 
       LEFT JOIN students s ON u.id = s.user_id 
       LEFT JOIN lecturers l ON u.id = l.user_id 
       ORDER BY u.created_at DESC`
    );

    res.render('admin/users', {
      title: 'Manajemen Pengguna - Portal Kampus Lab',
      users,
      success: req.query.success || null,
      error: req.query.error || null,
      labMode: req.labMode
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * API Kelola Pengguna (Target Pengujian Skenario 8: Privilege Escalation)
 */
async function getUsersApi(req, res) {
  try {
    const users = await db.query(
      `SELECT id, username, email, role, full_name, session_version, created_at FROM users ORDER BY id ASC`
    );

    return res.json({
      success: true,
      users,
      mode: req.labMode,
      caller: req.session.user ? req.session.user.username : 'anonymous',
      callerRole: req.session.user ? req.session.user.role : 'none',
      notice: req.labMode === 'vulnerable' 
        ? 'PERINGATAN LAB: Endpoint ini diakses tanpa otorisasi backend ketat (Privilege Escalation Vulnerable).' 
        : 'AMAN: Endpoint dilindungi otorisasi role admin di backend.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Tambah Akun Pengguna Baru
 */
async function createUser(req, res) {
  const { username, email, password, role, full_name, identifier, detail_field } = req.body;
  const adminUser = req.session.user;

  if (!username || !email || !password || !role || !full_name) {
    const err = 'Seluruh data wajib diisi.';
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(400).json({ success: false, error: err });
    return res.redirect('/admin/users?error=' + encodeURIComponent(err));
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, session_version) 
       VALUES (?, ?, ?, ?, ?, 1)`,
      [username.trim(), email.trim(), hash, role, full_name.trim()]
    );

    const newUserId = result.insertId;

    if (role === 'student') {
      const nim = identifier || `2024${Math.floor(10000 + Math.random() * 90000)}`;
      const prodi = detail_field || 'Teknik Informatika';
      await db.query(`INSERT INTO students (user_id, nim, program_study, semester) VALUES (?, ?, ?, 1)`, [newUserId, nim, prodi]);
    } else if (role === 'lecturer') {
      const nidn = identifier || `04${Math.floor(10000000 + Math.random() * 90000000)}`;
      const dept = detail_field || 'Teknik Informatika';
      await db.query(`INSERT INTO lecturers (user_id, nidn, department, title) VALUES (?, ?, ?, 'Dosen Tetap')`, [newUserId, nidn, dept]);
    }

    logActivity({
      userId: adminUser?.id || null,
      action: 'CREATE_USER',
      details: `Membuat akun baru: [${username}] dengan role [${role}].`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success',
      mode: req.labMode
    });

    const msg = `Pengguna ${username} (${role}) berhasil dibuat.`;
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true, message: msg });
    return res.redirect('/admin/users?success=' + encodeURIComponent(msg));
  } catch (err) {
    console.error('[CREATE_USER_ERROR]', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(500).json({ success: false, error: err.message });
    return res.redirect('/admin/users?error=' + encodeURIComponent(err.message));
  }
}

/**
 * Tampilkan Kelola Kelas / Mata Kuliah
 */
async function showCourses(req, res) {
  try {
    const courses = await db.query(
      `SELECT c.*, u.full_name as lecturer_name 
       FROM courses c 
       JOIN lecturers l ON c.lecturer_id = l.id 
       JOIN users u ON l.user_id = u.id 
       ORDER BY c.code ASC`
    );

    const lecturers = await db.query(
      `SELECT l.id as lecturer_id, u.full_name 
       FROM lecturers l 
       JOIN users u ON l.user_id = u.id`
    );

    res.render('admin/courses', {
      title: 'Manajemen Mata Kuliah - Portal Kampus Lab',
      courses,
      lecturers,
      success: req.query.success || null,
      error: req.query.error || null,
      labMode: req.labMode
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * Tambah Mata Kuliah Baru
 */
async function createCourse(req, res) {
  const { code, name, credits, lecturer_id, semester, description } = req.body;

  try {
    await db.query(
      `INSERT INTO courses (code, name, credits, lecturer_id, semester, description) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code.trim().toUpperCase(), name.trim(), parseInt(credits, 10), parseInt(lecturer_id, 10), parseInt(semester, 10), description]
    );

    res.redirect('/admin/courses?success=Mata+kuliah+berhasil+ditambahkan');
  } catch (err) {
    res.redirect('/admin/courses?error=' + encodeURIComponent(err.message));
  }
}

/**
 * Tampilkan Log Audit Sistem
 */
async function showAuditLogs(req, res) {
  try {
    const logs = await getRecentLogs(100);
    res.render('admin/audit_logs', {
      title: 'Log Aktivitas Keamanan - Portal Kampus Lab',
      logs,
      labMode: req.labMode
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

module.exports = {
  showDashboard,
  showUsers,
  getUsersApi,
  createUser,
  showCourses,
  createCourse,
  showAuditLogs
};
