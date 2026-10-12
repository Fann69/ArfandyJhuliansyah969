/**
 * Authentication Controller
 * Mengelola proses login, logout, dan manajemen akun
 * Menangani Skenario 5 (Brute Force / Enumeration), Skenario 7 (Session Management), Skenario 4 (CSRF)
 */

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { logActivity } = require('../services/auditService');

/**
 * Tampilkan Halaman Login
 */
function showLogin(req, res) {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') return res.redirect('/admin/dashboard');
    if (req.session.user.role === 'lecturer') return res.redirect('/lecturer/dashboard');
    return res.redirect('/student/dashboard');
  }

  res.render('auth/login', {
    title: 'Login - Portal Kampus Lab',
    error: req.query.error || null,
    success: req.query.success || null,
    labMode: req.labMode
  });
}

/**
 * Proses Login
 */
async function login(req, res) {
  const { username, password } = req.body;
  const isVulnerable = req.labMode === 'vulnerable';

  if (!username || !password) {
    const errorMsg = 'Harap isi username dan password!';
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, error: errorMsg });
    }
    return res.redirect(`/auth/login?error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    const users = await db.query(
      `SELECT u.*, s.id as student_id, l.id as lecturer_id 
       FROM users u 
       LEFT JOIN students s ON u.id = s.user_id 
       LEFT JOIN lecturers l ON u.id = l.user_id 
       WHERE u.username = ? OR u.email = ?`,
      [username.trim(), username.trim()]
    );

    const user = users[0];

    // SKENARIO 5: Akun tidak ditemukan
    if (!user) {
      logActivity({
        userId: null,
        action: 'LOGIN_FAILED',
        details: `Upaya login dengan username tidak terdaftar: [${username}].`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed',
        mode: req.labMode
      });

      // MODE RENTAN: Membocorkan keberadaan username (Account Enumeration)
      const errorMsg = isVulnerable
        ? `Username/Email "${username}" tidak terdaftar di sistem!`
        : 'Username/Email atau kata sandi tidak valid.';

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, error: errorMsg });
      }
      return res.redirect(`/auth/login?error=${encodeURIComponent(errorMsg)}`);
    }

    // Verifikasi password dengan bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    // SKENARIO 5: Password salah
    if (!passwordMatch) {
      logActivity({
        userId: user.id,
        action: 'LOGIN_FAILED',
        details: `Password salah untuk user [${user.username}].`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed',
        mode: req.labMode
      });

      // MODE RENTAN: Menginformasikan secara spesifik bahwa password salah
      const errorMsg = isVulnerable
        ? 'Kata sandi yang Anda masukkan salah!'
        : 'Username/Email atau kata sandi tidak valid.';

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, error: errorMsg });
      }
      return res.redirect(`/auth/login?error=${encodeURIComponent(errorMsg)}`);
    }

    // Login Berhasil
    logActivity({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      details: `Pengguna [${user.username}] berhasil login dengan role [${user.role}].`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success',
      mode: req.labMode
    });

    const sessionUserData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      student_id: user.student_id || null,
      lecturer_id: user.lecturer_id || null,
      session_version: user.session_version
    };

    if (isVulnerable) {
      // SKENARIO 7: Tidak melakukan regenerasi session ID (Rentan Session Fixation)
      req.session.user = sessionUserData;
      req.session.save(() => {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.json({ success: true, user: sessionUserData });
        }
        redirectByRole(user.role, res);
      });
    } else {
      // MODE AMAN: Regenerasi Session ID untuk mencegah Session Fixation
      req.session.regenerate((err) => {
        if (err) console.error('[SESSION_REGENERATE_ERROR]', err);
        req.session.user = sessionUserData;
        req.session.labMode = 'secure';
        req.session.save(() => {
          if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, user: sessionUserData });
          }
          redirectByRole(user.role, res);
        });
      });
    }

  } catch (err) {
    console.error('[LOGIN_ERROR]', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, error: 'Terjadi kesalahan internal pada server.' });
    }
    return res.redirect('/auth/login?error=Terjadi+kesalahan+internal+server');
  }
}

/**
 * Logout
 * SKENARIO 7: Broken Session Management
 */
function logout(req, res) {
  const isVulnerable = req.labMode === 'vulnerable';
  const userId = req.session?.user?.id || null;

  logActivity({
    userId,
    action: 'LOGOUT',
    details: isVulnerable 
      ? 'Logout di Mode RENTAN (Hanya hapus cookie klien, sesi server tetap aktif).'
      : 'Logout di Mode AMAN (Sesi server dihancurkan secara permanen).',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    status: 'success',
    mode: req.labMode
  });

  if (isVulnerable) {
    // MODE RENTAN: Hanya menghapus cookie di browser, data sesi di server tetap hidup!
    // Klien dapat menggunakan kembali cookie/session ID lama untuk mengakses endpoint terproteksi.
    res.clearCookie('connect.sid');
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Logout rentan: Cookie klien dihapus, tetapi sesi server tetap aktif di store.'
      });
    }
    return res.redirect('/auth/login?success=Logout+berhasil+(Mode+Rentan:+Sesi+server+tetap+aktif)');
  } else {
    // MODE AMAN: Hancurkan sesi di sisi server secara permanen
    req.session.destroy((err) => {
      res.clearCookie('connect.sid');
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({
          success: true,
          message: 'Logout aman: Sesi di server berhasil dimusnahkan secara permanen.'
        });
      }
      return res.redirect('/auth/login?success=Anda+telah+berhasil+logout+dengan+aman.');
    });
  }
}

/**
 * Update Email Profile
 * SKENARIO 4: Cross-Site Request Forgery (CSRF)
 */
async function updateEmail(req, res) {
  const { new_email } = req.body;
  const user = req.session.user;

  if (!new_email || !new_email.includes('@')) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, error: 'Format email tidak valid.' });
    }
    return res.redirect('/profile?error=Format+email+tidak+valid');
  }

  try {
    await db.query('UPDATE users SET email = ? WHERE id = ?', [new_email.trim(), user.id]);
    user.email = new_email.trim();

    logActivity({
      userId: user.id,
      action: 'UPDATE_EMAIL',
      details: `Email pengguna diubah menjadi [${new_email}] (Lab Mode: ${req.labMode}).`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success',
      mode: req.labMode
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        message: `Email berhasil diperbarui menjadi ${new_email}.`,
        mode: req.labMode
      });
    }

    return res.redirect('/profile?success=Email+berhasil+diperbarui');
  } catch (err) {
    console.error('[UPDATE_EMAIL_ERROR]', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, error: 'Gagal memperbarui email.' });
    }
    return res.redirect('/profile?error=Gagal+memperbarui+email');
  }
}

/**
 * Perubahan Kata Sandi
 * SKENARIO 7: Invalidation of Previous Sessions
 */
async function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  const user = req.session.user;
  const isVulnerable = req.labMode === 'vulnerable';

  if (!current_password || !new_password || new_password.length < 6) {
    const errorMsg = 'Kata sandi baru minimal 6 karakter.';
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, error: errorMsg });
    }
    return res.redirect('/profile?error=' + encodeURIComponent(errorMsg));
  }

  try {
    const rows = await db.query('SELECT password_hash, session_version FROM users WHERE id = ?', [user.id]);
    if (!rows.length) return res.status(404).send('User tidak ditemukan.');

    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) {
      const errorMsg = 'Kata sandi saat ini tidak cocok.';
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, error: errorMsg });
      }
      return res.redirect('/profile?error=' + encodeURIComponent(errorMsg));
    }

    const newHash = await bcrypt.hash(new_password, 10);

    if (isVulnerable) {
      // MODE RENTAN: Update hash password tanpa mengubah session_version
      // Akibatnya, sesi lama di perangkat lain atau tab lain tidak dibatalkan!
      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
    } else {
      // MODE AMAN: Naikkan session_version agar seluruh sesi aktif di tempat lain langsung terputus!
      const newVersion = (rows[0].session_version || 1) + 1;
      await db.query('UPDATE users SET password_hash = ?, session_version = ? WHERE id = ?', [newHash, newVersion, user.id]);
      req.session.user.session_version = newVersion;
    }

    logActivity({
      userId: user.id,
      action: 'CHANGE_PASSWORD',
      details: isVulnerable
        ? 'Perubahan kata sandi di Mode RENTAN (Sesi lain tetap aktif).'
        : 'Perubahan kata sandi di Mode AMAN (session_version diperbarui, sesi lain dibatalkan).',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success',
      mode: req.labMode
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        message: isVulnerable 
          ? 'Kata sandi diperbarui (Mode Rentan: Sesi lain tidak dibatalkan).' 
          : 'Kata sandi diperbarui (Mode Aman: Sesi lain otomatis dibatalkan).'
      });
    }

    return res.redirect('/profile?success=Kata+sandi+berhasil+diperbarui');
  } catch (err) {
    console.error('[CHANGE_PASSWORD_ERROR]', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, error: 'Gagal memperbarui kata sandi.' });
    }
    return res.redirect('/profile?error=Gagal+memperbarui+kata+sandi');
  }
}

function redirectByRole(role, res) {
  if (role === 'admin') return res.redirect('/admin/dashboard');
  if (role === 'lecturer') return res.redirect('/lecturer/dashboard');
  return res.redirect('/student/dashboard');
}

module.exports = {
  showLogin,
  login,
  logout,
  updateEmail,
  changePassword
};
