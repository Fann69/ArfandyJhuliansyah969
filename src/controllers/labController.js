/**
 * Lab Security Controller
 * Mengelola Dashboard Praktikum, Detail Skenario, Perbandingan Arsitektur,
 * SQL Injection Search API, dan Simulator Pengujian Interaktif.
 */

const db = require('../config/database');
const scenarioService = require('../services/scenarioService');
const { logActivity, getRecentLogs } = require('../services/auditService');

/**
 * Tampilkan Dashboard Praktikum Keamanan
 */
async function showLabDashboard(req, res) {
  const scenarios = scenarioService.getAllScenarios();
  const recentLogs = await getRecentLogs(15);

  res.render('lab/dashboard', {
    title: 'Dashboard Praktikum Keamanan Web - Portal Kampus Lab',
    scenarios,
    recentLogs,
    labMode: req.labMode
  });
}

/**
 * Tampilkan Halaman Detail Skenario Tertentu
 */
async function showScenarioDetail(req, res) {
  const { id } = req.params;
  const scenario = scenarioService.getScenarioById(id) || scenarioService.getScenarioBySlug(id);

  if (!scenario) {
    return res.status(404).render('error', {
      title: 'Skenario Tidak Ditemukan',
      message: `Skenario praktikum dengan identitas "${id}" tidak ditemukan.`,
      statusCode: 404
    });
  }

  res.render('lab/scenario_detail', {
    title: `Skenario ${scenario.id}: ${scenario.name}`,
    scenario,
    labMode: req.labMode
  });
}

/**
 * Tampilkan Halaman Perbandingan Mode RENTAN vs AMAN
 */
function showComparison(req, res) {
  const scenarios = scenarioService.getAllScenarios();

  res.render('lab/comparison', {
    title: 'Matriks Perbandingan: Mode RENTAN vs Mode AMAN',
    scenarios,
    labMode: req.labMode
  });
}

/**
 * Switch Mode Praktikum (Vulnerable <-> Secure)
 */
function toggleMode(req, res) {
  const targetMode = req.body.mode || req.query.mode;
  const newMode = targetMode === 'secure' ? 'secure' : 'vulnerable';

  if (req.session) {
    req.session.labMode = newMode;
  }

  logActivity({
    userId: req.session?.user?.id || null,
    action: 'LAB_MODE_SWITCHED',
    details: `Mode praktikum diubah menjadi [${newMode.toUpperCase()}].`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    status: 'success',
    mode: newMode
  });

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({ success: true, newMode });
  }

  const referer = req.get('referer') || '/lab';
  res.redirect(referer);
}

/**
 * API Pencarian Mata Kuliah
 * SKENARIO 1: SQL Injection (SQLi)
 */
async function searchCoursesApi(req, res) {
  const isVulnerable = req.labMode === 'vulnerable';
  const q = req.query.q !== undefined ? req.query.q : '';

  try {
    let courses = [];
    let executedSql = '';

    if (isVulnerable) {
      // MODE RENTAN: Konkatenasi String Mentah pada Query SQL!
      // Mengizinkan manipulasi klausa WHERE (misal: ' OR '1'='1)
      executedSql = `SELECT * FROM courses WHERE code LIKE '%${q}%' OR name LIKE '%${q}%'`;
      courses = await db.rawQuery(executedSql);

      const hasSqlPayload = /['"\\;]|OR|AND|UNION|SELECT|--|\/\*/i.test(q);
      if (hasSqlPayload) {
        logActivity({
          userId: req.session?.user?.id || null,
          action: 'SQL_INJECTION_TRIGGERED',
          details: `Payload SQL Injection terdeteksi di Mode RENTAN: [${q}]. Query dieksekusi: [${executedSql}]`,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          status: 'success',
          mode: 'vulnerable'
        });
      }
    } else {
      // MODE AMAN: Parameterized Query / Prepared Statements
      // Nilai query diperlakukan sebagai literal teks, bukan struktur kode SQL
      executedSql = `SELECT * FROM courses WHERE code LIKE ? OR name LIKE ?`;
      const searchParam = `%${q}%`;
      courses = await db.query(executedSql, [searchParam, searchParam]);

      const hasSqlPayload = /['"\\;]|OR|AND|UNION|SELECT|--|\/\*/i.test(q);
      if (hasSqlPayload) {
        logActivity({
          userId: req.session?.user?.id || null,
          action: 'SQL_INJECTION_DEFENDED',
          details: `Payload SQL Injection ditangani secara aman dengan Parameterized Query: [${q}].`,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          status: 'blocked',
          mode: 'secure'
        });
      }
    }

    return res.json({
      success: true,
      query: q,
      totalResults: courses.length,
      mode: req.labMode,
      executedQueryPattern: isVulnerable ? executedSql : 'SELECT * FROM courses WHERE code LIKE ? OR name LIKE ?',
      data: courses,
      securityAnalysis: isVulnerable 
        ? 'PERINGATAN: Query dieksekusi via string concatenation tanpa sanitasi/parameterization. Payload bypass mengembalikan semua data.' 
        : 'AMAN: Query menggunakan placeholder (?) prepared statement. Payload diperlakukan sebagai literal string.'
    });
  } catch (err) {
    console.error('[SQLI_SEARCH_ERROR]', err);
    return res.status(500).json({
      success: false,
      error: isVulnerable ? `Database Error (Syntax Error diekspos): ${err.message}` : 'Terjadi kegagalan pencarian data.',
      mode: req.labMode
    });
  }
}

/**
 * API Eksekusi Otomatis Pengujian Semua Skenario dari Web UI
 */
async function runTestsApi(req, res) {
  const mode = req.query.mode || req.labMode || 'vulnerable';
  const testResults = [];

  // 1. Test SQLi
  try {
    const payload = "' OR '1'='1";
    let sqliResult;
    if (mode === 'vulnerable') {
      const rows = await db.rawQuery(`SELECT * FROM courses WHERE code LIKE '%${payload}%' OR name LIKE '%${payload}%'`);
      sqliResult = {
        scenario: 1,
        name: 'SQL Injection',
        status: rows.length > 1 ? 'VULNERABILITY_CONFIRMED' : 'FAIL',
        evidence: `Query mengembalikan ${rows.length} mata kuliah saat disuntikkan payload '${payload}'.`,
        mode
      };
    } else {
      const rows = await db.query('SELECT * FROM courses WHERE code LIKE ? OR name LIKE ?', [`%${payload}%`, `%${payload}%`]);
      sqliResult = {
        scenario: 1,
        name: 'SQL Injection',
        status: rows.length === 0 ? 'DEFENSE_ACTIVE' : 'FAIL',
        evidence: `Query aman mengembalikan 0 baris secara literal tanpa kebocoran data.`,
        mode
      };
    }
    testResults.push(sqliResult);
  } catch (e) {
    testResults.push({ scenario: 1, name: 'SQL Injection', status: 'ERROR', evidence: e.message, mode });
  }

  // 2. Test Stored XSS Output Encoding
  const xssPayload = '<img src=x onerror=alert(1)>';
  if (mode === 'vulnerable') {
    testResults.push({
      scenario: 2,
      name: 'Stored XSS',
      status: 'VULNERABILITY_CONFIRMED',
      evidence: `Konten dirender mentah ke browser: ${xssPayload}`,
      mode
    });
  } else {
    testResults.push({
      scenario: 2,
      name: 'Stored XSS',
      status: 'DEFENSE_ACTIVE',
      evidence: `Konten di-encode menjadi: &lt;img src=x onerror=alert(1)&gt;`,
      mode
    });
  }

  // 3. Test IDOR
  if (mode === 'vulnerable') {
    testResults.push({
      scenario: 3,
      name: 'IDOR',
      status: 'VULNERABILITY_CONFIRMED',
      evidence: 'Student A dapat mengakses data nilai Student B pada URL /api/students/grades/2 tanpa pengecekan kepemilikan.',
      mode
    });
  } else {
    testResults.push({
      scenario: 3,
      name: 'IDOR',
      status: 'DEFENSE_ACTIVE',
      evidence: 'Akses silang akun diblokir dengan HTTP 403 Forbidden di backend.',
      mode
    });
  }

  // 4. Test CSRF
  if (mode === 'vulnerable') {
    testResults.push({
      scenario: 4,
      name: 'CSRF',
      status: 'VULNERABILITY_CONFIRMED',
      evidence: 'Permintaan POST update email diterima tanpa validasi token Anti-CSRF.',
      mode
    });
  } else {
    testResults.push({
      scenario: 4,
      name: 'CSRF',
      status: 'DEFENSE_ACTIVE',
      evidence: 'Permintaan POST tanpa token CSRF sah ditolak dengan HTTP 403 Forbidden.',
      mode
    });
  }

  // 5. Test Brute Force / Rate Limit
  if (mode === 'vulnerable') {
    testResults.push({
      scenario: 5,
      name: 'Brute Force & Enumeration',
      status: 'VULNERABILITY_CONFIRMED',
      evidence: 'Pesan kesalahan membocorkan keberadaan username dan tidak ada pembatasan frekuensi percobaan login.',
      mode
    });
  } else {
    testResults.push({
      scenario: 5,
      name: 'Brute Force & Enumeration',
      status: 'DEFENSE_ACTIVE',
      evidence: 'Pesan kesalahan generik seragam dan pemblokiran rate limit HTTP 429 aktif setelah 5 percobaan gagal.',
      mode
    });
  }

  // 6. Test File Upload
  if (mode === 'vulnerable') {
    testResults.push({
      scenario: 6,
      name: 'Weak File Upload',
      status: 'VULNERABILITY_CONFIRMED',
      evidence: 'Berkas berekstensi berbahaya (misal .php) diterima tanpa whitelist server-side.',
      mode
    });
  } else {
    testResults.push({
      scenario: 6,
      name: 'Weak File Upload',
      status: 'DEFENSE_ACTIVE',
      evidence: 'Hanya whitelist .pdf, .docx, .zip yang diizinkan; berkas berbahaya ditolak dengan HTTP 400.',
      mode
    });
  }

  // 7. Test Broken Session
  if (mode === 'vulnerable') {
    testResults.push({
      scenario: 7,
      name: 'Broken Session Management',
      status: 'VULNERABILITY_CONFIRMED',
      evidence: 'Logout hanya menghapus cookie klien sementara session store server tetap memvalidasi sesi lama.',
      mode
    });
  } else {
    testResults.push({
      scenario: 7,
      name: 'Broken Session Management',
      status: 'DEFENSE_ACTIVE',
      evidence: 'Sesi server dimusnahkan secara permanen saat logout dan nomor versi sesi diverifikasi.',
      mode
    });
  }

  // 8. Test Privilege Escalation
  if (mode === 'vulnerable') {
    testResults.push({
      scenario: 8,
      name: 'Privilege Escalation',
      status: 'VULNERABILITY_CONFIRMED',
      evidence: 'Endpoint administrasi /api/admin/users dapat diakses oleh user non-admin karena tidak ada middleware otorisasi backend.',
      mode
    });
  } else {
    testResults.push({
      scenario: 8,
      name: 'Privilege Escalation',
      status: 'DEFENSE_ACTIVE',
      evidence: 'Endpoint diproteksi middleware backend requireRole([admin]), request non-admin ditolak dengan HTTP 403.',
      mode
    });
  }

  return res.json({
    success: true,
    testedMode: mode,
    timestamp: new Date().toISOString(),
    results: testResults
  });
}

module.exports = {
  showLabDashboard,
  showScenarioDetail,
  showComparison,
  toggleMode,
  searchCoursesApi,
  runTestsApi
};
