/**
 * Authentication, Authorization, and Security Lab Middlewares
 * Menyediakan kontrol keamanan dan demonstrasi mode RENTAN vs AMAN
 */

const crypto = require('crypto');
const db = require('../config/database');
const { logActivity } = require('../services/auditService');

// Simpan memori untuk rate-limit login di mode aman
const loginAttemptStore = new Map();

/**
 * Middleware untuk mendeteksi dan menetapkan Lab Mode (vulnerable | secure)
 */
function labModeMiddleware(req, res, next) {
  let mode = req.headers['x-lab-mode'] || req.query.lab_mode || req.query.set_mode || (req.session && req.session.labMode) || process.env.LAB_MODE_DEFAULT || 'vulnerable';
  
  if (mode !== 'vulnerable' && mode !== 'secure') {
    mode = 'vulnerable';
  }

  if (req.session) {
    req.session.labMode = mode;
  }

  req.labMode = mode;
  res.locals.labMode = mode;
  res.locals.currentPath = req.path || '';
  res.locals.user = req.session ? req.session.user : null;
  next();
}

/**
 * Inisialisasi atau ambil CSRF token untuk sesi aktif
 */
function csrfMiddleware(req, res, next) {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;

  // Jika method bukan mutasi data, lewati verifikasi
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Jika di Mode RENTAN (Skenario 4: CSRF), lewati validasi token!
  if (req.labMode === 'vulnerable') {
    return next();
  }

  // Di Mode AMAN: Wajib verifikasi CSRF Token
  // Untuk endpoint pengunggahan berkas (/upload), biarkan multer dan controller mengevaluasi Skenario 6
  if (req.path.includes('/upload')) {
    return next();
  }

  const submittedToken = req.body?._csrf || req.headers['x-csrf-token'] || req.query?._csrf;

  if (!submittedToken || submittedToken !== req.session.csrfToken) {
    logActivity({
      userId: req.session.user?.id || null,
      action: 'CSRF_BLOCKED',
      details: 'Permintaan ditolak karena token CSRF tidak cocok atau tidak disertakan.',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'blocked',
      mode: 'secure'
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({
        success: false,
        error: 'CSRF Token tidak valid atau tidak disertakan.'
      });
    }

    return res.status(403).render('error', {
      title: 'Akses Ditolak (CSRF Terdeteksi)',
      message: 'Permintaan dibatalkan: Validasi Anti-CSRF Token gagal. Di mode AMAN, seluruh permintaan POST wajib memvalidasi token CSRF.',
      statusCode: 403
    });
  }

  next();
}

/**
 * Memastikan pengguna telah login
 */
async function isAuthenticated(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ success: false, error: 'Sesi tidak ditemukan atau telah berakhir. Silakan login kembali.' });
    }
    return res.redirect('/auth/login?error=Silakan+login+terlebih+dahulu');
  }

  // Skenario 7: Broken Session Management
  // Di Mode AMAN: Periksa apakah session_version di database masih cocok (misal setelah ganti password)
  if (req.labMode === 'secure') {
    try {
      const users = await db.query('SELECT session_version FROM users WHERE id = ?', [req.session.user.id]);
      if (!users.length || users[0].session_version !== req.session.user.session_version) {
        req.session.destroy();
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(401).json({ success: false, error: 'Sesi telah dibatalkan karena pembaruan kata sandi. Silakan login ulang.' });
        }
        return res.redirect('/auth/login?error=Sesi+telah+berakhir+setelah+perubahan+sandi.+Silakan+login+ulang.');
      }
    } catch (e) {
      console.error('[AUTH_SESSION_CHECK_ERROR]', e.message);
    }
  }

  res.locals.currentUser = req.session.user;
  next();
}

/**
 * Otorisasi Role Pengguna
 * Skenario 8: Privilege Escalation
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    // Di Mode RENTAN: Jika ada parameter role palsu di body/query atau lewati pemeriksaan backend!
    if (req.labMode === 'vulnerable') {
      // Menunjukkan risiko frontend-only check atau parameter tampering
      if (req.body && req.body.role) {
        req.session.user.role = req.body.role; // Membiarkan klien mengubah role sesinya sendiri
      }
      return next(); // Lolos tanpa pengecekan role backend
    }

    // Di Mode AMAN: Verifikasi role mutlak di sisi backend dari sesi server
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, error: 'Silakan login terlebih dahulu.' });
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      logActivity({
        userId: req.session.user.id,
        action: 'PRIVILEGE_ESCALATION_BLOCKED',
        details: `Upaya akses endpoint role [${allowedRoles.join(',')}] oleh user role [${req.session.user.role}].`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'blocked',
        mode: 'secure'
      });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          error: `Akses ditolak: Anda tidak memiliki wewenang untuk role [${allowedRoles.join(', ')}].`
        });
      }

      return res.status(403).render('error', {
        title: 'Akses Ditolak (403 Forbidden)',
        message: `Halaman ini hanya dapat diakses oleh peran: ${allowedRoles.join(', ')}. Peran Anda saat ini: ${req.session.user.role}.`,
        statusCode: 403
      });
    }

    next();
  };
}

/**
 * Middleware Rate Limiter untuk Login
 * Skenario 5: Unrestricted Password Attempts
 */
function loginRateLimiter(req, res, next) {
  // Di Mode RENTAN: Tidak ada pembatasan percobaan login sama sekali
  if (req.labMode === 'vulnerable') {
    return next();
  }

  // Di Mode AMAN: Batasi 5 percobaan gagal per IP/username dalam rentang waktu 60 detik
  const key = `${req.ip}_${req.body.username || 'unknown'}`;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 5;

  let record = loginAttemptStore.get(key);
  if (!record || (now - record.firstAttempt) > windowMs) {
    record = { count: 1, firstAttempt: now };
    loginAttemptStore.set(key, record);
    return next();
  }

  record.count += 1;
  loginAttemptStore.set(key, record);

  if (record.count > maxAttempts) {
    const timeLeft = Math.ceil((windowMs - (now - record.firstAttempt)) / 1000);
    logActivity({
      userId: null,
      action: 'LOGIN_RATE_LIMITED',
      details: `Percobaan login ke-${record.count} untuk key [${key}] diblokir sementara.`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'blocked',
      mode: 'secure'
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(429).json({
        success: false,
        error: `Terlalu banyak percobaan login gagal. Percobaan diblokir sementara. Coba lagi dalam ${timeLeft} detik.`
      });
    }

    return res.status(429).render('error', {
      title: 'Terlalu Banyak Percobaan (HTTP 429)',
      message: `Terlalu banyak percobaan login gagal dari alamat Anda. Silakan coba kembali dalam ${timeLeft} detik.`,
      statusCode: 429
    });
  }

  next();
}

module.exports = {
  labModeMiddleware,
  csrfMiddleware,
  isAuthenticated,
  requireRole,
  loginRateLimiter,
  loginAttemptStore
};
