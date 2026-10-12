/**
 * Database Adapter & Connection Pool
 * Mendukung MySQL (XAMPP/phpMyAdmin) dan SQLite sebagai fallback otomatis
 * Menjamin kesiapan praktikum di berbagai lingkungan laboratorium.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

let clientType = 'sqlite';
let pool = null;
let sqliteDb = null;

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'portal_kampus_lab'
};

/**
 * Inisialisasi koneksi database
 */
async function initDatabase() {
  const preferredClient = (process.env.DB_CLIENT || 'mysql').toLowerCase();

  if (preferredClient === 'mysql') {
    try {
      const mysql = require('mysql2/promise');
      // Test ping koneksi ke server MySQL
      const tempConn = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password
      });

      // Pastikan database ada
      await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await tempConn.end();

      pool = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true
      });

      // Test koneksi pool
      const conn = await pool.getConnection();
      conn.release();

      clientType = 'mysql';
      console.log(`[DATABASE] Berhasil terhubung ke MySQL di ${dbConfig.host}:${dbConfig.port} (Database: ${dbConfig.database})`);
      return;
    } catch (err) {
      console.warn(`[DATABASE] MySQL tidak dapat diakses (${err.message}). Mengaktifkan fallback ke SQLite lokal untuk kelancaran praktikum...`);
    }
  }

  // Fallback SQLite
  await initSqliteFallback();
}

/**
 * Inisialisasi SQLite database lokal dengan skema dan seed data otomatis
 */
function initSqliteFallback() {
  return new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    const isVercel = Boolean(process.env.VERCEL);
    const dbDir = isVercel ? path.join('/tmp', 'database') : path.join(__dirname, '../../database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'portal_kampus_lab.sqlite');
    sqliteDb = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('[DATABASE] Gagal menginisialisasi SQLite:', err.message);
        return reject(err);
      }
      clientType = 'sqlite';
      console.log(`[DATABASE] Menggunakan SQLite Database: ${dbPath}`);
      try {
        await bootstrapSqlite();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Buat tabel & masukkan data sintetis pada SQLite jika belum ada
 */
async function bootstrapSqlite() {
  const runSql = (sql) => new Promise((resolve, reject) => {
    sqliteDb.run(sql, (err) => (err ? reject(err) : resolve()));
  });

  // Cek apakah tabel users sudah ada
  const checkTable = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='users';");
  if (checkTable.length > 0) {
    return; // Sudah diinisialisasi
  }

  console.log('[DATABASE] Menginisialisasi skema dan data sintetis di SQLite...');

  // DDL SQLite
  await runSql(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    full_name TEXT NOT NULL,
    session_version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  await runSql(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    nim TEXT UNIQUE NOT NULL,
    program_study TEXT NOT NULL,
    semester INTEGER DEFAULT 1,
    academic_advisor_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`);

  await runSql(`CREATE TABLE IF NOT EXISTS lecturers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    nidn TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`);

  await runSql(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    credits INTEGER DEFAULT 3,
    lecturer_id INTEGER NOT NULL,
    semester INTEGER DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lecturer_id) REFERENCES lecturers(id) ON DELETE CASCADE
  );`);

  await runSql(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    academic_year TEXT DEFAULT '2026/2027-Genap',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
  );`);

  await runSql(`CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enrollment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    task_score REAL DEFAULT 0.00,
    midterm_score REAL DEFAULT 0.00,
    final_score REAL DEFAULT 0.00,
    letter_grade TEXT DEFAULT 'E',
    feedback TEXT,
    updated_by INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
  );`);

  await runSql(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
  );`);

  await runSql(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    notes TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
  );`);

  await runSql(`CREATE TABLE IF NOT EXISTS discussions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER,
    title TEXT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`);

  await runSql(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'success',
    mode TEXT DEFAULT 'secure',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  // Masukkan seed data
  const users = [
    [1, 'admin', 'admin@kampuslab.ac.id', '$2b$10$BXEs5LRMrkM/PawfL6lVJOZwO.gsCj06DoTZpkQ4l0UJA2MCOPqEq', 'admin', 'Administrator Sistem Lab', 1],
    [2, 'dosen1', 'budi.hartono@kampuslab.ac.id', '$2b$10$arOqJi1mCSDKSHFzGFga3euacZYLP81Sr./0q2rmWi/CnzjnJfLGq', 'lecturer', 'Dr. Budi Hartono, M.Kom.', 1],
    [3, 'dosen2', 'siti.aminah@kampuslab.ac.id', '$2b$10$arOqJi1mCSDKSHFzGFga3euacZYLP81Sr./0q2rmWi/CnzjnJfLGq', 'lecturer', 'Ir. Siti Aminah, M.T.', 1],
    [4, 'mhs1', 'ahmad.fauzi@kampuslab.ac.id', '$2b$10$b1l.zOxafrG8XWnsZ6MGnuxFWbpsm17n59By4TukBwrrfWjtGQ43S', 'student', 'Ahmad Fauzi', 1],
    [5, 'mhs2', 'citra.dewi@kampuslab.ac.id', '$2b$10$b1l.zOxafrG8XWnsZ6MGnuxFWbpsm17n59By4TukBwrrfWjtGQ43S', 'student', 'Citra Dewi', 1],
    [6, 'mhs3', 'doni.pratama@kampuslab.ac.id', '$2b$10$b1l.zOxafrG8XWnsZ6MGnuxFWbpsm17n59By4TukBwrrfWjtGQ43S', 'student', 'Doni Pratama', 1]
  ];

  for (const u of users) {
    await query(`INSERT INTO users (id, username, email, password_hash, role, full_name, session_version) VALUES (?, ?, ?, ?, ?, ?, ?);`, u);
  }

  await query(`INSERT INTO lecturers (id, user_id, nidn, department, title) VALUES (?, ?, ?, ?, ?);`, [1, 2, '0412088001', 'Teknik Informatika', 'Lektor Kepala']);
  await query(`INSERT INTO lecturers (id, user_id, nidn, department, title) VALUES (?, ?, ?, ?, ?);`, [2, 3, '0425038502', 'Sistem Informasi', 'Lektor']);

  await query(`INSERT INTO students (id, user_id, nim, program_study, semester, academic_advisor_id) VALUES (?, ?, ?, ?, ?, ?);`, [1, 4, '202401001', 'Teknik Informatika', 4, 1]);
  await query(`INSERT INTO students (id, user_id, nim, program_study, semester, academic_advisor_id) VALUES (?, ?, ?, ?, ?, ?);`, [2, 5, '202401002', 'Teknik Informatika', 4, 1]);
  await query(`INSERT INTO students (id, user_id, nim, program_study, semester, academic_advisor_id) VALUES (?, ?, ?, ?, ?, ?);`, [3, 6, '202401003', 'Sistem Informasi', 4, 2]);

  await query(`INSERT INTO courses (id, code, name, credits, lecturer_id, semester, description) VALUES (?, ?, ?, ?, ?, ?, ?);`, [1, 'IF401', 'Keamanan Aplikasi Web', 3, 1, 4, 'Mata kuliah praktikum identifikasi kerentanan dan secure software development.']);
  await query(`INSERT INTO courses (id, code, name, credits, lecturer_id, semester, description) VALUES (?, ?, ?, ?, ?, ?, ?);`, [2, 'IF402', 'Rekayasa Perangkat Lunak', 3, 1, 4, 'Desain dan metodologi pembangunan perangkat lunak berskala industri.']);
  await query(`INSERT INTO courses (id, code, name, credits, lecturer_id, semester, description) VALUES (?, ?, ?, ?, ?, ?, ?);`, [3, 'SI305', 'Manajemen Basis Data Terdistribusi', 3, 2, 4, 'Arsitektur, replikasi, dan optimasi query pada database skala besar.']);

  await query(`INSERT INTO enrollments (id, student_id, course_id, academic_year, status) VALUES (?, ?, ?, ?, ?);`, [1, 1, 1, '2026/2027-Genap', 'active']);
  await query(`INSERT INTO enrollments (id, student_id, course_id, academic_year, status) VALUES (?, ?, ?, ?, ?);`, [2, 1, 2, '2026/2027-Genap', 'active']);
  await query(`INSERT INTO enrollments (id, student_id, course_id, academic_year, status) VALUES (?, ?, ?, ?, ?);`, [3, 2, 1, '2026/2027-Genap', 'active']);
  await query(`INSERT INTO enrollments (id, student_id, course_id, academic_year, status) VALUES (?, ?, ?, ?, ?);`, [4, 2, 3, '2026/2027-Genap', 'active']);
  await query(`INSERT INTO enrollments (id, student_id, course_id, academic_year, status) VALUES (?, ?, ?, ?, ?);`, [5, 3, 3, '2026/2027-Genap', 'active']);

  await query(`INSERT INTO grades (id, enrollment_id, student_id, course_id, task_score, midterm_score, final_score, letter_grade, feedback, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [1, 1, 1, 1, 88.50, 85.00, 90.00, 'A', 'Analisis keamanan OWASP sangat komprehensif.', 2]);
  await query(`INSERT INTO grades (id, enrollment_id, student_id, course_id, task_score, midterm_score, final_score, letter_grade, feedback, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [2, 2, 1, 2, 78.00, 80.00, 82.00, 'B+', 'Diagram arsitektur UML rapi dan terstruktur.', 2]);
  await query(`INSERT INTO grades (id, enrollment_id, student_id, course_id, task_score, midterm_score, final_score, letter_grade, feedback, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [3, 3, 2, 1, 92.00, 90.00, 94.00, 'A', 'Skenario mitigasi XSS dan IDOR diuji tuntas.', 2]);
  await query(`INSERT INTO grades (id, enrollment_id, student_id, course_id, task_score, midterm_score, final_score, letter_grade, feedback, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [4, 4, 2, 3, 85.00, 82.50, 87.00, 'A', 'Desain sharding database sangat matang.', 3]);
  await query(`INSERT INTO grades (id, enrollment_id, student_id, course_id, task_score, midterm_score, final_score, letter_grade, feedback, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [5, 5, 3, 3, 70.00, 75.00, 73.00, 'B', 'Perlu optimasi pada indeks transaksi.', 3]);

  await query(`INSERT INTO assignments (id, course_id, title, description, due_date) VALUES (?, ?, ?, ?, ?);`, [1, 1, 'Tugas 1: Audit Keamanan Session & Otorisasi', 'Analisis manajemen session dan identifikasi potensi IDOR pada modul mahasiswa. Kumpulkan laporan format PDF.', '2026-11-20 23:59:00']);
  await query(`INSERT INTO assignments (id, course_id, title, description, due_date) VALUES (?, ?, ?, ?, ?);`, [2, 1, 'Tugas 2: Mitigasi SQL Injection dan XSS', 'Tuliskan kode perbaikan menggunakan parameterized query dan context-aware escaping.', '2026-11-27 23:59:00']);
  await query(`INSERT INTO assignments (id, course_id, title, description, due_date) VALUES (?, ?, ?, ?, ?);`, [3, 2, 'Tugas Analisis Kebutuhan Sistem Kampus', 'Dokumentasikan Use Case dan Sequence Diagram untuk portal akademik.', '2026-11-25 23:59:00']);

  await query(`INSERT INTO submissions (id, assignment_id, student_id, original_filename, stored_filename, file_path, file_size, mime_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`, [1, 1, 1, 'laporan_audit_session_ahmad.pdf', 'sub_1_4_1700000000_audit.pdf', 'uploads/sub_1_4_1700000000_audit.pdf', 245760, 'application/pdf', 'Laporan lengkap analisis session fixation dan IDOR pada endpoint nilai.']);

  await query(`INSERT INTO discussions (id, course_id, user_id, parent_id, title, content) VALUES (?, ?, ?, ?, ?, ?);`, [1, 1, 2, null, 'Selamat Datang di Lab Keamanan Web', 'Silakan gunakan forum ini untuk berdiskusi seputar materi OWASP Top 10 dan praktikum lab.']);
  await query(`INSERT INTO discussions (id, course_id, user_id, parent_id, title, content) VALUES (?, ?, ?, ?, ?, ?);`, [2, 1, 4, 1, 'Tanya Format Laporan Tugas 1', 'Apakah laporan tugas 1 wajib menyertakan log request HTTP atau cukup screenshot hasil pengujian?']);
  await query(`INSERT INTO discussions (id, course_id, user_id, parent_id, title, content) VALUES (?, ?, ?, ?, ?, ?);`, [3, 1, 2, 2, 'Re: Tanya Format Laporan Tugas 1', 'Sertakan tabel hasil uji sebelum dan sesudah perbaikan beserta screenshot respons HTTP.']);

  await query(`INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, status, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`, [1, 1, 'SYSTEM_INIT', 'Inisialisasi database laboratorium keamanan portal kampus sintetis.', '127.0.0.1', 'Node.js/Lab-Runner', 'success', 'secure']);

  console.log('[DATABASE] Inisialisasi SQLite selesai.');
}

/**
 * Eksekusi query dengan parameterized statement (AMAN)
 */
async function query(sql, params = []) {
  if (clientType === 'mysql' && pool) {
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  // SQLite execution
  return new Promise((resolve, reject) => {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN')) {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } else {
      sqliteDb.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({
          insertId: this.lastID,
          affectedRows: this.changes
        });
      });
    }
  });
}

/**
 * Eksekusi raw query string tanpa parameterized queries
 * PERHATIAN: Digunakan KHUSUS di Mode Rentan (Lab Demonstrasi Keamanan)
 */
async function rawQuery(sql) {
  if (clientType === 'mysql' && pool) {
    const [rows] = await pool.query(sql);
    return rows;
  }

  return new Promise((resolve, reject) => {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) {
      sqliteDb.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } else {
      sqliteDb.exec(sql, (err) => {
        if (err) return reject(err);
        resolve({ raw: true });
      });
    }
  });
}

function getClientType() {
  return clientType;
}

module.exports = {
  initDatabase,
  query,
  rawQuery,
  getClientType
};
