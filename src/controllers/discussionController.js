/**
 * Discussion Controller
 * Forum diskusi akademik mahasiswa dan dosen
 * Menangani target Skenario 2: Stored Cross-Site Scripting (Stored XSS)
 */

const db = require('../config/database');
const { logActivity } = require('../services/auditService');

/**
 * Fungsi pembantu encoding HTML untuk mode AMAN
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Tampilkan Halaman Forum Diskusi
 */
async function showDiscussions(req, res) {
  const isVulnerable = req.labMode === 'vulnerable';
  const selectedCourseId = req.query.course_id ? parseInt(req.query.course_id, 10) : 1;

  try {
    const courses = await db.query('SELECT * FROM courses ORDER BY code ASC');

    const rawDiscussions = await db.query(
      `SELECT d.*, u.full_name as author_name, u.role as author_role, u.username as author_username 
       FROM discussions d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.course_id = ? 
       ORDER BY d.created_at ASC`,
      [selectedCourseId]
    );

    // Pemrosesan konten diskusi sesuai Mode Lab:
    // MODE RENTAN: Konten dibiarkan mentah apa adanya (Memungkinkan Stored XSS)
    // MODE AMAN: Konten di-encode karakter khusus HTML
    const discussions = rawDiscussions.map(item => {
      return {
        ...item,
        title: isVulnerable ? item.title : escapeHtml(item.title),
        content: isVulnerable ? item.content : escapeHtml(item.content),
        isRawHtml: isVulnerable // Flag untuk template EJS
      };
    });

    res.render('discussion/index', {
      title: 'Forum Diskusi Akademik - Portal Kampus Lab',
      courses,
      selectedCourseId,
      discussions,
      success: req.query.success || null,
      error: req.query.error || null,
      labMode: req.labMode
    });
  } catch (err) {
    console.error('[DISCUSSION_ERROR]', err);
    res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message, statusCode: 500 });
  }
}

/**
 * Tambah Postingan Diskusi Baru
 * SKENARIO 2: Stored XSS
 */
async function createPost(req, res) {
  const user = req.session.user;
  const isVulnerable = req.labMode === 'vulnerable';
  const { course_id, title, content, parent_id } = req.body;

  if (!content || !content.trim()) {
    const err = 'Isi diskusi tidak boleh kosong.';
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(400).json({ success: false, error: err });
    return res.redirect(`/discussions?course_id=${course_id || 1}&error=` + encodeURIComponent(err));
  }

  try {
    // Di mode rentan maupun aman, kita simpan input asli ke database.
    // Kerentanan Stored XSS dievaluasi saat render output (Output Context Encoding).
    const parsedCourseId = parseInt(course_id, 10) || 1;
    const parsedParentId = parent_id ? parseInt(parent_id, 10) : null;

    const result = await db.query(
      `INSERT INTO discussions (course_id, user_id, parent_id, title, content) 
       VALUES (?, ?, ?, ?, ?)`,
      [parsedCourseId, user.id, parsedParentId, title || null, content]
    );

    const hasScriptTag = /<script|<img|<iframe|onerror|onload|javascript:/i.test(content);
    if (hasScriptTag) {
      logActivity({
        userId: user.id,
        action: isVulnerable ? 'STORED_XSS_INJECTED' : 'STORED_XSS_SANITIZED_DISPLAY',
        details: `Postingan dengan tag HTML/JS potensial disimpan oleh [${user.username}]. Lab Mode: ${req.labMode}.`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: isVulnerable ? 'success' : 'blocked',
        mode: req.labMode
      });
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Komentar diskusi berhasil diposting.',
        postId: result.insertId,
        mode: req.labMode,
        renderedContent: isVulnerable ? content : escapeHtml(content)
      });
    }

    return res.redirect(`/discussions?course_id=${parsedCourseId}&success=Diskusi+berhasil+diposting`);
  } catch (err) {
    console.error('[CREATE_DISCUSSION_ERROR]', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(500).json({ success: false, error: err.message });
    return res.redirect(`/discussions?course_id=${course_id || 1}&error=` + encodeURIComponent(err.message));
  }
}

module.exports = {
  showDiscussions,
  createPost,
  escapeHtml
};
