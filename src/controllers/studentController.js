/**
 * Student Controller
 * Mengelola fitur mahasiswa: Profil, Nilai (Skenario 3: IDOR), dan Pengumpulan Tugas (Skenario 6: File Upload)
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/database');
const { logActivity } = require('../services/auditService');

/**
 * Tampilkan Dashboard Mahasiswa
 */
async function showDashboard(req, res) {
  const user = req.session.user;

  try {
    const studentData = await db.query(
      `SELECT s.*, u.full_name, u.email, u.username, l.nidn as advisor_nidn, lu.full_name as advisor_name 
       FROM students s 
       JOIN users u ON s.user_id = u.id 
       LEFT JOIN lecturers l ON s.academic_advisor_id = l.id 
       LEFT JOIN users lu ON l.user_id = lu.id 
       WHERE s.user_id = ?`,
      [user.id]
    );

    const student = studentData[0] || null;

    // Ambil mata kuliah yang diambil
    const enrollments = await db.query(
      `SELECT e.*, c.code, c.name as course_name, c.credits, c.semester as course_semester, 
              u.full_name as lecturer_name, g.letter_grade, g.final_score 
       FROM enrollments e 
       JOIN courses c ON e.course_id = c.id 
       JOIN lecturers l ON c.lecturer_id = l.id 
       JOIN users u ON l.user_id = u.id 
       LEFT JOIN grades g ON e.id = g.enrollment_id 
       WHERE e.student_id = ?`,
      [student ? student.id : 0]
    );

    // Ambil tugas yang belum dikumpulkan
    const assignments = await db.query(
      `SELECT a.*, c.name as course_name, c.code as course_code, 
              sub.id as submission_id, sub.submitted_at 
       FROM assignments a 
       JOIN courses c ON a.course_id = c.id 
       JOIN enrollments e ON c.id = e.course_id 
       LEFT JOIN submissions sub ON a.id = sub.assignment_id AND sub.student_id = e.student_id 
       WHERE e.student_id = ? 
       ORDER BY a.due_date ASC`,
      [student ? student.id : 0]
    );

    res.render('student/dashboard', {
      title: 'Dashboard Mahasiswa - Portal Kampus Lab',
      student,
      enrollments,
      assignments,
      labMode: req.labMode
    });
  } catch (err) {
    console.error('[STUDENT_DASHBOARD_ERROR]', err);
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * Tampilkan Halaman Profil
 */
async function showProfile(req, res) {
  const user = req.session.user;

  try {
    const studentData = await db.query(
      `SELECT s.*, u.full_name, u.email, u.username, u.role, u.session_version,
              lu.full_name as advisor_name 
       FROM users u 
       LEFT JOIN students s ON s.user_id = u.id 
       LEFT JOIN lecturers l ON s.academic_advisor_id = l.id 
       LEFT JOIN users lu ON l.user_id = lu.id 
       WHERE u.id = ?`,
      [user.id]
    );

    res.render('profile', {
      title: 'Profil Pengguna - Portal Kampus Lab',
      profileUser: studentData[0] || user,
      success: req.query.success || null,
      error: req.query.error || null,
      labMode: req.labMode
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * Tampilkan Halaman Nilai Mahasiswa
 */
async function showGrades(req, res) {
  const user = req.session.user;
  const currentStudentId = user.student_id || 1;

  try {
    const grades = await db.query(
      `SELECT g.*, c.code, c.name as course_name, c.credits, 
              u.full_name as lecturer_name 
       FROM grades g 
       JOIN courses c ON g.course_id = c.id 
       JOIN lecturers l ON c.lecturer_id = l.id 
       JOIN users u ON l.user_id = u.id 
       WHERE g.student_id = ?`,
      [currentStudentId]
    );

    res.render('student/grades', {
      title: 'Daftar Nilai Akademik - Portal Kampus Lab',
      grades,
      currentStudentId,
      labMode: req.labMode
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * API Nilai Mahasiswa
 * SKENARIO 3: Insecure Direct Object Reference (IDOR)
 */
async function getGradesApi(req, res) {
  const isVulnerable = req.labMode === 'vulnerable';
  const targetStudentId = parseInt(req.params.studentId || req.query.student_id, 10);
  const loggedInUser = req.session.user;

  if (isNaN(targetStudentId)) {
    return res.status(400).json({ success: false, error: 'ID Mahasiswa tidak valid.' });
  }

  // DI MODE AMAN: Wajib verifikasi kepemilikan objek (Object Ownership Check)
  if (!isVulnerable) {
    // Jika role student, hanya boleh mengakses student_id miliknya sendiri
    if (loggedInUser.role === 'student' && loggedInUser.student_id !== targetStudentId) {
      logActivity({
        userId: loggedInUser.id,
        action: 'IDOR_BLOCKED',
        details: `Mahasiswa [${loggedInUser.username} (ID: ${loggedInUser.student_id})] diblokir saat mencoba mengakses nilai Mahasiswa [ID: ${targetStudentId}].`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'blocked',
        mode: 'secure'
      });

      return res.status(403).json({
        success: false,
        error: 'Akses ditolak: Anda tidak memiliki wewenang untuk melihat data akademik mahasiswa lain.',
        mode: 'secure'
      });
    }
  } else {
    // DI MODE RENTAN: Tidak ada pengecekan kepemilikan data!
    // Mahasiswa A dapat membaca transkrip nilai Mahasiswa B cukup dengan mengubah parameter URL.
    logActivity({
      userId: loggedInUser.id,
      action: 'IDOR_ACCESSED_VULNERABLE',
      details: `Mahasiswa [${loggedInUser.username}] mengakses nilai Mahasiswa [ID: ${targetStudentId}] di Mode RENTAN.`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success',
      mode: 'vulnerable'
    });
  }

  try {
    const studentInfo = await db.query(
      `SELECT s.id as student_id, s.nim, s.program_study, u.full_name, u.email 
       FROM students s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.id = ?`,
      [targetStudentId]
    );

    if (!studentInfo.length) {
      return res.status(404).json({ success: false, error: 'Data mahasiswa tidak ditemukan.' });
    }

    const grades = await db.query(
      `SELECT g.*, c.code, c.name as course_name, c.credits, u.full_name as lecturer_name 
       FROM grades g 
       JOIN courses c ON g.course_id = c.id 
       JOIN lecturers l ON c.lecturer_id = l.id 
       JOIN users u ON l.user_id = u.id 
       WHERE g.student_id = ?`,
      [targetStudentId]
    );

    return res.json({
      success: true,
      student: studentInfo[0],
      grades,
      mode: req.labMode,
      notice: isVulnerable ? 'PERINGATAN LAB: Data ini diakses tanpa pemeriksaan otorisasi kepemilikan IDOR!' : 'AMAN: Data diverifikasi sesuai hak akses subjek.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Tampilkan Halaman Tugas
 */
async function showAssignments(req, res) {
  const user = req.session.user;
  const studentId = user.student_id || 1;

  try {
    const assignments = await db.query(
      `SELECT a.*, c.code, c.name as course_name, 
              s.id as submission_id, s.original_filename, s.file_size, s.submitted_at 
       FROM assignments a 
       JOIN courses c ON a.course_id = c.id 
       JOIN enrollments e ON c.id = e.course_id 
       LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = e.student_id 
       WHERE e.student_id = ? 
       ORDER BY a.due_date ASC`,
      [studentId]
    );

    res.render('student/assignments', {
      title: 'Pengumpulan Tugas - Portal Kampus Lab',
      assignments,
      success: req.query.success || null,
      error: req.query.error || null,
      labMode: req.labMode
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * Proses Unggah Tugas
 * SKENARIO 6: Weak File Upload Validation
 */
async function uploadAssignment(req, res) {
  const isVulnerable = req.labMode === 'vulnerable';
  const user = req.session.user;
  const studentId = user.student_id || 1;
  const assignmentId = parseInt(req.body.assignment_id, 10);
  const notes = req.body.notes || '';
  const file = req.file;

  if (!file) {
    const err = 'Harap pilih berkas yang akan diunggah.';
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(400).json({ success: false, error: err });
    return res.redirect('/student/assignments?error=' + encodeURIComponent(err));
  }

  const uploadDir = process.env.VERCEL
    ? path.join('/tmp', 'uploads')
    : path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const originalName = file.originalname;
  const ext = path.extname(originalName).toLowerCase();

  // DI MODE AMAN: Validasi Server-Side Ketat
  if (!isVulnerable) {
    const allowedExtensions = ['.pdf', '.docx', '.zip'];
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/x-zip-compressed'
    ];
    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

    // 1. Cek ukuran file
    if (file.size > maxSizeBytes) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      const err = 'Ukuran berkas melebihi batas maksimum 5 MB.';
      logActivity({
        userId: user.id,
        action: 'FILE_UPLOAD_BLOCKED',
        details: `Berkas ditolak: Ukuran ${file.size} bytes melebihi batas.`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'blocked',
        mode: 'secure'
      });
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(400).json({ success: false, error: err });
      return res.redirect('/student/assignments?error=' + encodeURIComponent(err));
    }

    // 2. Cek ekstensi whitelist
    if (!allowedExtensions.includes(ext)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      const err = `Format berkas [${ext}] tidak diizinkan. Hanya berkas PDF, DOCX, dan ZIP yang diperbolehkan.`;
      logActivity({
        userId: user.id,
        action: 'FILE_UPLOAD_BLOCKED',
        details: `Berkas ditolak: Ekstensi berbahaya [${ext}] terdeteksi di Mode AMAN.`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'blocked',
        mode: 'secure'
      });
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(400).json({ success: false, error: err });
      return res.redirect('/student/assignments?error=' + encodeURIComponent(err));
    }

    // 3. Simpan dengan nama acak aman (UUID) agar tidak terjadi Path Traversal / Direct Execution
    const safeStoredName = `sub_${assignmentId}_${studentId}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    const targetPath = path.join(uploadDir, safeStoredName);

    fs.renameSync(file.path, targetPath);

    await db.query(
      `INSERT INTO submissions (assignment_id, student_id, original_filename, stored_filename, file_path, file_size, mime_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [assignmentId, studentId, originalName, safeStoredName, `uploads/${safeStoredName}`, file.size, file.mimetype, notes]
    );

    logActivity({
      userId: user.id,
      action: 'FILE_UPLOAD_SUCCESS',
      details: `Berkas sah [${originalName}] disimpan secara aman sebagai [${safeStoredName}].`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success',
      mode: 'secure'
    });

    const msg = 'Tugas berhasil diunggah dengan validasi keamanan ketat.';
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true, message: msg, filename: safeStoredName });
    return res.redirect('/student/assignments?success=' + encodeURIComponent(msg));
  } else {
    // DI MODE RENTAN: File upload lemah!
    // Menerima file apapun (termasuk .php, .html, .exe, .sh) dan menyimpan dengan nama file asli!
    const vulnerableStoredName = `vuln_${originalName}`;
    const targetPath = path.join(uploadDir, vulnerableStoredName);

    fs.renameSync(file.path, targetPath);

    await db.query(
      `INSERT INTO submissions (assignment_id, student_id, original_filename, stored_filename, file_path, file_size, mime_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [assignmentId, studentId, originalName, vulnerableStoredName, `uploads/${vulnerableStoredName}`, file.size, file.mimetype, notes]
    );

    logActivity({
      userId: user.id,
      action: 'FILE_UPLOAD_VULNERABLE',
      details: `Berkas [${originalName}] diterima di Mode RENTAN tanpa validasi ekstensi server-side!`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success',
      mode: 'vulnerable'
    });

    const msg = `Berkas "${originalName}" berhasil diunggah (PERINGATAN LAB: Ekstensi tidak divalidasi di Mode RENTAN).`;
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true, message: msg, filename: vulnerableStoredName, warning: 'Rentan terhadap file upload berbahaya' });
    return res.redirect('/student/assignments?success=' + encodeURIComponent(msg));
  }
}

module.exports = {
  showDashboard,
  showProfile,
  showGrades,
  getGradesApi,
  showAssignments,
  uploadAssignment
};
