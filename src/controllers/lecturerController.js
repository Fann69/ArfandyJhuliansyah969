/**
 * Lecturer Controller
 * Mengelola kelas yang diampu, penilaian mahasiswa, dan peninjauan pengumpulan tugas
 */

const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { logActivity } = require('../services/auditService');

/**
 * Tampilkan Dashboard Dosen
 */
async function showDashboard(req, res) {
  const user = req.session.user;

  try {
    const lecturerData = await db.query(
      `SELECT l.*, u.full_name, u.email, u.username 
       FROM lecturers l 
       JOIN users u ON l.user_id = u.id 
       WHERE l.user_id = ?`,
      [user.id]
    );

    const lecturer = lecturerData[0] || null;

    // Ambil mata kuliah yang diampu
    const courses = await db.query(
      `SELECT c.*, COUNT(DISTINCT e.student_id) as total_students 
       FROM courses c 
       LEFT JOIN enrollments e ON c.id = e.course_id 
       WHERE c.lecturer_id = ? 
       GROUP BY c.id`,
      [lecturer ? lecturer.id : 0]
    );

    // Ambil rekap pengumpulan tugas terbaru
    const recentSubmissions = await db.query(
      `SELECT s.*, u.full_name as student_name, st.nim, a.title as assignment_title, c.code as course_code 
       FROM submissions s 
       JOIN assignments a ON s.assignment_id = a.id 
       JOIN courses c ON a.course_id = c.id 
       JOIN students st ON s.student_id = st.id 
       JOIN users u ON st.user_id = u.id 
       WHERE c.lecturer_id = ? 
       ORDER BY s.submitted_at DESC 
       LIMIT 10`,
      [lecturer ? lecturer.id : 0]
    );

    res.render('lecturer/dashboard', {
      title: 'Dashboard Dosen - Portal Kampus Lab',
      lecturer,
      courses,
      recentSubmissions,
      labMode: req.labMode
    });
  } catch (err) {
    console.error('[LECTURER_DASHBOARD_ERROR]', err);
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * Tampilkan Daftar Mahasiswa dalam Kelas & Nilai
 */
async function showClassStudents(req, res) {
  const user = req.session.user;
  const courseId = parseInt(req.params.courseId, 10);

  try {
    const course = (await db.query('SELECT * FROM courses WHERE id = ?', [courseId]))[0];
    if (!course) return res.status(404).render('error', { title: 'Mata Kuliah Tidak Ditemukan', message: 'Mata kuliah tidak terdaftar.', statusCode: 404 });

    const students = await db.query(
      `SELECT e.id as enrollment_id, s.id as student_id, s.nim, s.program_study, u.full_name, u.email,
              g.id as grade_id, g.task_score, g.midterm_score, g.final_score, g.letter_grade, g.feedback 
       FROM enrollments e 
       JOIN students s ON e.student_id = s.id 
       JOIN users u ON s.user_id = u.id 
       LEFT JOIN grades g ON e.id = g.enrollment_id 
       WHERE e.course_id = ? 
       ORDER BY s.nim ASC`,
      [courseId]
    );

    res.render('lecturer/class_students', {
      title: `Nilai Mahasiswa - ${course.name}`,
      course,
      students,
      success: req.query.success || null,
      error: req.query.error || null,
      labMode: req.labMode
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * Input atau Update Nilai Mahasiswa
 */
async function updateGrade(req, res) {
  const user = req.session.user;
  const { enrollment_id, student_id, course_id, task_score, midterm_score, final_score, feedback } = req.body;

  const tScore = parseFloat(task_score) || 0;
  const mScore = parseFloat(midterm_score) || 0;
  const fScore = parseFloat(final_score) || 0;

  // Hitung Nilai Akhir: 30% Tugas + 30% UTS + 40% UAS
  const avg = (tScore * 0.3) + (mScore * 0.3) + (fScore * 0.4);
  let letter = 'E';
  if (avg >= 85) letter = 'A';
  else if (avg >= 80) letter = 'A-';
  else if (avg >= 75) letter = 'B+';
  else if (avg >= 70) letter = 'B';
  else if (avg >= 65) letter = 'B-';
  else if (avg >= 60) letter = 'C+';
  else if (avg >= 55) letter = 'C';
  else if (avg >= 40) letter = 'D';

  try {
    const existing = await db.query('SELECT id FROM grades WHERE enrollment_id = ?', [enrollment_id]);

    if (existing.length > 0) {
      await db.query(
        `UPDATE grades 
         SET task_score = ?, midterm_score = ?, final_score = ?, letter_grade = ?, feedback = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE enrollment_id = ?`,
        [tScore, mScore, fScore, letter, feedback, user.id, enrollment_id]
      );
    } else {
      await db.query(
        `INSERT INTO grades (enrollment_id, student_id, course_id, task_score, midterm_score, final_score, letter_grade, feedback, updated_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [enrollment_id, student_id, course_id, tScore, mScore, fScore, letter, feedback, user.id]
      );
    }

    logActivity({
      userId: user.id,
      action: 'UPDATE_GRADE',
      details: `Dosen [${user.username}] memperbarui nilai mahasiswa [ID: ${student_id}] pada matkul [ID: ${course_id}]. Nilai: ${avg.toFixed(1)} (${letter}).`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success',
      mode: req.labMode
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Nilai berhasil disimpan.', letter_grade: letter });
    }

    res.redirect(`/lecturer/course/${course_id}/students?success=Nilai+berhasil+disimpan`);
  } catch (err) {
    console.error('[UPDATE_GRADE_ERROR]', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.redirect(`/lecturer/course/${course_id}/students?error=Gagal+menyimpan+nilai`);
  }
}

/**
 * Tampilkan Pengumpulan Tugas Mahasiswa
 */
async function showSubmissions(req, res) {
  const user = req.session.user;
  const courseId = parseInt(req.params.courseId, 10);

  try {
    const course = (await db.query('SELECT * FROM courses WHERE id = ?', [courseId]))[0];
    const assignments = await db.query('SELECT * FROM assignments WHERE course_id = ?', [courseId]);

    const submissions = await db.query(
      `SELECT sub.*, u.full_name as student_name, st.nim, a.title as assignment_title 
       FROM submissions sub 
       JOIN assignments a ON sub.assignment_id = a.id 
       JOIN students st ON sub.student_id = st.id 
       JOIN users u ON st.user_id = u.id 
       WHERE a.course_id = ? 
       ORDER BY sub.submitted_at DESC`,
      [courseId]
    );

    res.render('lecturer/submissions', {
      title: `Pengumpulan Tugas - ${course ? course.name : 'Kelas'}`,
      course,
      assignments,
      submissions,
      labMode: req.labMode
    });
  } catch (err) {
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * Unduh Berkas Tugas Mahasiswa
 */
async function downloadSubmission(req, res) {
  const subId = parseInt(req.params.submissionId, 10);

  try {
    const rows = await db.query('SELECT * FROM submissions WHERE id = ?', [subId]);
    if (!rows.length) return res.status(404).send('Berkas tidak ditemukan.');

    const sub = rows[0];
    const fullPath = path.join(__dirname, '../../', sub.file_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('Berkas fisik tidak ditemukan di server.');
    }

    // Set header aman untuk download attachment
    res.setHeader('Content-Disposition', `attachment; filename="${sub.original_filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(fullPath);
  } catch (err) {
    res.status(500).send('Terjadi kesalahan pengunduhan berkas.');
  }
}

module.exports = {
  showDashboard,
  showClassStudents,
  updateGrade,
  showSubmissions,
  downloadSubmission
};
