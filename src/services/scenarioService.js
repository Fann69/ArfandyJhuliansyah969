/**
 * Scenario Service
 * Mendefinisikan metadata, technical cause, testing steps, synthetic test data,
 * expected outcomes, safe technical evidence, impact, dan remediations untuk 8 skenario OWASP.
 */

const scenarios = [
  {
    id: 1,
    slug: 'sql-injection',
    name: 'SQL Injection (SQLi)',
    category: 'Injection (A03:2021)',
    severity: 'CRITICAL',
    endpoint: '/api/courses/search',
    method: 'GET',
    explanation: 'Kerentanan yang terjadi ketika input pengguna digabungkan langsung ke dalam perintah SQL dinamis tanpa sanitasi atau parameterisasi, memungkinkan modifikasi struktur logika query.',
    technicalCause: 'Penggunaan konkatenasi string secara langsung (`SELECT * FROM courses WHERE code = \'${q}\'`) pada controller pencarian atau filter data akademik.',
    syntheticData: {
      legitimate: 'IF401',
      attackPayload: "' OR '1'='1"
    },
    testingSteps: [
      '1. Buka dashboard mahasiswa atau menu Pencarian Mata Kuliah.',
      '2. Pada kolom pencarian kode mata kuliah, masukkan input legitimasi: "IF401". Perhatikan hanya 1 mata kuliah yang muncul.',
      '3. Ubah input menjadi payload SQL Injection sintetis: "\' OR \'1\'=\'1".',
      '4. Dalam Mode RENTAN: Query mengabaikan filter dan menampilkan seluruh record mata kuliah dari database.',
      '5. Ubah mode ke Mode AMAN, lalu ulangi pencarian dengan payload yang sama.',
      '6. Dalam Mode AMAN: Query diperlakukan sebagai literal string yang aman melalui parameterized statement, menghasilkan 0 record tanpa error sintaks.'
    ],
    expectedVulnerable: 'Seluruh data mata kuliah bocor/muncul karena kondisi Boolean `OR \'1\'=\'1` bernilai true pada setiap baris database.',
    expectedSecure: 'Sistem mencari literal string "\' OR \'1\'=\'1" secara aman dan mengembalikan hasil kosong (0 baris ditemukan) tanpa kegagalan query.',
    technicalEvidence: 'VULNERABLE: Query dieksekusi sebagai: `SELECT * FROM courses WHERE code LIKE \'%\' OR \'1\'=\'1%\'` -> Menghasilkan semua baris. SECURE: Query dieksekusi dengan placeholder `?` dan parameter `["%\' OR \'1\'=\'1%"]`.',
    impact: 'Pencurian seluruh data akademik sintetis, bypass autentikasi, serta potensi eskalasi hak akses basis data.',
    remediation: 'Gunakan Prepared Statements / Parameterized Queries secara konsisten. Validasi tipe data dan batasi karakter input pada sisi server.'
  },
  {
    id: 2,
    slug: 'stored-xss',
    name: 'Stored Cross-Site Scripting (Stored XSS)',
    category: 'Injection (A03:2021)',
    severity: 'HIGH',
    endpoint: '/discussions/post',
    method: 'POST',
    explanation: 'Input berbahaya disimpan ke dalam basis data dan dirender kembali pada browser pengguna lain tanpa proses encoding HTML, menyebabkan eksekusi skrip berbahaya di konteks sesi korban.',
    technicalCause: 'Komentar diskusi disimpan langsung dan dirender di template/DOM menggunakan atribut HTML mentah (misal `{{{content}}}` atau `innerHTML`) tanpa escaping karakter khusus (`<`, `>`, `"`, `\', `&`).',
    syntheticData: {
      legitimate: 'Terima kasih atas penjelasannya Pak Dosen.',
      attackPayload: '<img src=x onerror="alert(\'XSS-LAB-TRIGGERED\')">'
    },
    testingSteps: [
      '1. Login sebagai mahasiswa (mhs1) dan buka forum Diskusi Akademik.',
      '2. Buat tanggapan diskusi baru dengan isi payload sintetis: `<img src=x onerror="alert(\'XSS-LAB-TRIGGERED\')">`.',
      '3. Dalam Mode RENTAN: Pesan disimpan apa adanya dan saat halaman dirender kembali, browser mengeksekusi skrip alert.',
      '4. Ubah ke Mode AMAN dan kirim tanggapan serupa atau muat ulang halaman.',
      '5. Dalam Mode AMAN: Karakter di-escape menjadi entitas HTML `&lt;img src=x onerror=&quot;alert(...)&quot;&gt;` sehingga tampil sebagai teks biasa tanpa eksekusi DOM.'
    ],
    expectedVulnerable: 'Tag HTML dan atribut event handler dijalankan langsung oleh peramban pengguna.',
    expectedSecure: 'Karakter khusus HTML dikonversi ke HTML entities yang aman, tampil sebagai teks murni di layar tanpa injeksi DOM.',
    technicalEvidence: 'VULNERABLE: Output di browser: `<div class="content"><img src=x onerror="..."></div>`. SECURE: Output di browser: `&lt;img src=x onerror=...&gt;`.',
    impact: 'Pencurian cookie sesi yang tidak berflag HttpOnly, defacement tampilan portal, atau pengalihan pengguna secara berbahaya.',
    remediation: 'Terapkan Context-Aware Output Encoding (HTML entity encoding) pada semua data dinamis yang dirender ke browser. Terapkan Content Security Policy (CSP) dan HttpOnly cookie flag.'
  },
  {
    id: 3,
    slug: 'idor',
    name: 'Insecure Direct Object Reference (IDOR)',
    category: 'Broken Access Control (A01:2021)',
    severity: 'HIGH',
    endpoint: '/api/students/grades/:studentId',
    method: 'GET',
    explanation: 'Aplikasi membuka akses ke objek internal (transkrip nilai mahasiswa) berdasarkan input identifier dari pengguna tanpa memverifikasi kepemilikan data pada sesi pengguna yang sedang login.',
    technicalCause: 'Handler endpoint mengambil parameter `req.params.studentId` langsung dari URL dan mengeksekusi query database tanpa memeriksa apakah `studentId` tersebut milik akun pengguna aktif (`req.session.user.student_id`).',
    syntheticData: {
      userA_StudentId: 1, // Ahmad Fauzi
      userB_StudentId: 2  // Citra Dewi
    },
    testingSteps: [
      '1. Login sebagai Mahasiswa A (Ahmad Fauzi, student_id = 1).',
      '2. Akses endpoint nilai pribadi: `/api/students/grades/1`. Data nilai Ahmad tampil.',
      '3. Ubah URL parameter secara manual menjadi ID Mahasiswa B: `/api/students/grades/2`.',
      '4. Dalam Mode RENTAN: Sistem mengembalikan data transkrip nilai Mahasiswa B (Citra Dewi), meskipun Ahmad tidak berhak melihatnya.',
      '5. Aktifkan Mode AMAN dan akses kembali `/api/students/grades/2` dengan sesi Ahmad Fauzi.',
      '6. Dalam Mode AMAN: Backend mendeteksi ketidaksesuaian ID dan mengembalikan status HTTP 403 Forbidden dengan pesan penolakan akses.'
    ],
    expectedVulnerable: 'Mahasiswa A dapat membaca nilai rahasia mahasiswa lain hanya dengan mengganti nomor ID pada URL.',
    expectedSecure: 'Akses ditolak dengan status HTTP 403 Forbidden karena ID pada request bukan milik pengguna yang sedang login.',
    technicalEvidence: 'VULNERABLE: Status 200 OK dengan payload nilai milik student_id=2 pada sesi student_id=1. SECURE: Status 403 Forbidden dengan response `{"error":"Akses ditolak: Anda tidak memiliki wewenang melihat data mahasiswa lain."}`.',
    impact: 'Kebocoran data privasi akademik seluruh mahasiswa secara horizontal kepada pengguna lain.',
    remediation: 'Lakukan verifikasi kepemilikan data (Object-Level Authorization) di sisi backend. Bandingkan ID objek dengan ID subjek pada sesi terautentikasi.'
  },
  {
    id: 4,
    slug: 'csrf',
    name: 'Cross-Site Request Forgery (CSRF)',
    category: 'Broken Access Control (A01:2021)',
    severity: 'MEDIUM',
    endpoint: '/api/profile/update-email',
    method: 'POST',
    explanation: 'Eksploitasi di mana situs pihak ketiga yang berbahaya memaksa browser korban yang telah terautentikasi untuk mengirimkan permintaan perubahan data sensitif tanpa sepengetahuan korban.',
    technicalCause: 'Endpoint pengubah profil/email tidak memvalidasi Anti-CSRF Token dan cookie sesi tidak memiliki konfigurasi `SameSite=Strict/Lax`.',
    syntheticData: {
      legitimateEmail: 'ahmad.fauzi@kampuslab.ac.id',
      forgedEmail: 'attacker-spoof@lab-test.local'
    },
    testingSteps: [
      '1. Login sebagai mahasiswa Ahmad Fauzi di portal.',
      '2. Buka simulator pengujian CSRF di menu Detail Kerentanan CSRF.',
      '3. Kirim permintaan POST perubahan email tanpa menyertakan CSRF token (mensimulasikan payload dari tab browser pihak ketiga).',
      '4. Dalam Mode RENTAN: Permintaan diterima oleh backend dan email profil Ahmad berubah.',
      '5. Aktifkan Mode AMAN dan lakukan pengujian ulang.',
      '6. Dalam Mode AMAN: Permintaan ditolak dengan status HTTP 403 Forbidden karena token CSRF hilang atau tidak valid.'
    ],
    expectedVulnerable: 'Email profil berhasil diubah tanpa verifikasi token CSRF.',
    expectedSecure: 'Permintaan ditolak dengan error `HTTP 403: Invalid or missing CSRF token`.',
    technicalEvidence: 'VULNERABLE: Respon status 200 OK dengan email terupdate. SECURE: Respon status 403 Forbidden: `{"error":"CSRF Token tidak valid atau tidak disertakan."}`.',
    impact: 'Pengambilalihan akun korban (account takeover) akibat perubahan alamat email pemulihan atau informasi kontak penting.',
    remediation: 'Terapkan Synchronizer Token Pattern (Anti-CSRF Token) untuk semua permintaan state-changing (POST, PUT, DELETE). Pasang atribut `SameSite=Lax` atau `SameSite=Strict` pada cookie sesi.'
  },
  {
    id: 5,
    slug: 'brute-force',
    name: 'Unrestricted Password Attempts (Brute Force & Account Enumeration)',
    category: 'Identification and Authentication Failures (A07:2021)',
    severity: 'MEDIUM',
    endpoint: '/api/auth/login',
    method: 'POST',
    explanation: 'Tidak adanya pembatasan frekuensi percobaan login memungkinkan penyerang mencoba ratusan kombinasi kata sandi, serta pesan kesalahan yang membocorkan keberadaan username.',
    technicalCause: 'Tidak adanya middleware Rate Limiting dan pesan kesalahan login yang membedakan antara "Username tidak ditemukan" dan "Password salah".',
    syntheticData: {
      targetUsername: 'dosen1',
      wrongPasswords: ['123456', 'password', 'qwerty', 'admin123', 'rahasia', 'dosen123']
    },
    testingSteps: [
      '1. Buka formulir login portal kampus.',
      '2. Masukkan username sembarang yang tidak terdaftar ("usernametidakada"). Dalam Mode RENTAN: Sistem membalas "Username tidak ditemukan!" (Account Enumeration).',
      '3. Masukkan username terdaftar ("dosen1") dengan password salah secara berulang-ulang lebih dari 5 kali berturut-turut.',
      '4. Dalam Mode RENTAN: Sistem membalas "Kata sandi salah!" tanpa jeda atau pemblokiran frekuensi percobaan.',
      '5. Aktifkan Mode AMAN dan ulangi percobaan login salah sebanyak 5 kali berturut-turut.',
      '6. Dalam Mode AMAN: Pada percobaan ke-6, sistem mengembalikan status HTTP 429 Too Many Requests dan pesan kesalahan selalu generik ("Email/username atau kata sandi tidak valid").'
    ],
    expectedVulnerable: 'Pengguna dapat mencoba ribuan password tanpa batasan serta dapat mengetahui username yang valid.',
    expectedSecure: 'Sistem memblokir sementara percobaan berlebihan (HTTP 429) dan menampilkan pesan kesalahan generik.',
    technicalEvidence: 'VULNERABLE: Status 200/401 dengan pesan verbose: "Username tidak terdaftar" vs "Kata sandi salah". SECURE: Status 429 Too Many Requests: `{"error":"Terlalu banyak percobaan login. Silakan tunggu 60 detik."}`.',
    impact: 'Penebakan kata sandi akun dosen/admin secara otomatis dan pencurian akun.',
    remediation: 'Terapkan Rate Limiter (misalnya max 5 percobaan per IP/akun per menit), progressive delay, dan pesan kesalahan generik seragam.'
  },
  {
    id: 6,
    slug: 'file-upload',
    name: 'Weak File Upload Validation',
    category: 'Security Misconfiguration (A05:2021)',
    severity: 'HIGH',
    endpoint: '/api/assignments/upload',
    method: 'POST',
    explanation: 'Unggahan berkas tugas hanya memeriksa ekstensi di frontend atau mempercayai MIME type dari header klien tanpa validasi whitelist, ukuran, dan penyimpanan yang terisolasi.',
    technicalCause: 'Backend menyimpan file dengan ekstensi berbahaya atau nama file asli tanpa validasi whitelist ekstensi dan MIME type di sisi server.',
    syntheticData: {
      validFile: 'laporan_praktikum.pdf',
      maliciousFile: 'webshell_test.php'
    },
    testingSteps: [
      '1. Login sebagai mahasiswa dan buka halaman Pengumpulan Tugas.',
      '2. Pilih berkas sintetis berbahaya non-dokumen (contoh: berkas berekstensi `.php`, `.html`, atau `.exe`).',
      '3. Dalam Mode RENTAN: File diterima, disimpan dengan nama asli dan ekstensi berbahaya di folder yang dapat diakses publik.',
      '4. Aktifkan Mode AMAN, lalu coba unggah kembali berkas berekstensi `.php` atau `.exe`.',
      '5. Dalam Mode AMAN: Backend menolak berkas dengan pesan validasi whitelist (hanya .pdf, .docx, .zip) dan batas ukuran maksimum (5MB).'
    ],
    expectedVulnerable: 'Berkas skrip (.php/.html) berhasil diunggah ke server.',
    expectedSecure: 'Backend menolak berkas dengan status HTTP 400: "Format berkas tidak diizinkan. Hanya PDF, DOCX, dan ZIP yang diperbolehkan."',
    technicalEvidence: 'VULNERABLE: Berkas disimpan sebagai `uploads/webshell_test.php`. SECURE: HTTP 400 Bad Request, berkas langsung ditolak dan dihapus dari buffer.',
    impact: 'Remote Code Execution (RCE), Stored XSS via HTML upload, atau pengisian disk server (Denial of Service).',
    remediation: 'Terapkan whitelist ekstensi ketat (.pdf, .docx, .zip), periksa Magic Bytes/MIME type, batasi ukuran berkas, ubah nama file dengan UUID acak, dan simpan di direktori non-executable.'
  },
  {
    id: 7,
    slug: 'broken-session',
    name: 'Broken Session Management (Session Remains Active After Logout/Password Change)',
    category: 'Identification and Authentication Failures (A07:2021)',
    severity: 'MEDIUM',
    endpoint: '/api/auth/logout & /api/profile/change-password',
    method: 'POST',
    explanation: 'Proses logout hanya menghapus cookie di sisi peramban tanpa menghancurkan data sesi di sisi server, atau sesi lama tetap dapat digunakan setelah pengguna mengganti kata sandinya.',
    technicalCause: 'Logout hanya menjalankan `res.clearCookie()` tanpa memanggil `req.session.destroy()`, dan perubahan kata sandi tidak memperbarui nomor versi sesi (`session_version`) di database.',
    syntheticData: {
      username: 'mhs1',
      sessionId: 'sess_lab_sample_synthetic'
    },
    testingSteps: [
      '1. Login sebagai mahasiswa (mhs1) dan salin nilai Cookie Sesi (`connect.sid`).',
      '2. Lakukan klik Logout pada aplikasi.',
      '3. Kirim kembali request HTTP ke `/api/students/profile` menggunakan Cookie Sesi lama yang telah disalin.',
      '4. Dalam Mode RENTAN: Backend tetap menerima sesi lama dan mengembalikan data profil (sesi belum mati di server).',
      '5. Aktifkan Mode AMAN, login kembali, salin cookie, lalu logout.',
      '6. Dalam Mode AMAN: Request dengan cookie lama ditolak dengan status HTTP 401 Unauthorized karena sesi telah dihancurkan di server (`req.session.destroy`).'
    ],
    expectedVulnerable: 'Session ID lama tetap valid di backend dan dapat digunakan kembali setelah logout atau pergantian password.',
    expectedSecure: 'Sesi dihancurkan sepenuhnya di server saat logout dan sesi lama dibatalkan otomatis saat kata sandi diperbarui.',
    technicalEvidence: 'VULNERABLE: Request dengan cookie lama menghasilkan HTTP 200 OK. SECURE: Request dengan cookie lama menghasilkan HTTP 401 Unauthorized (`{"error":"Sesi telah berakhir atau tidak valid."}`).',
    impact: 'Session Hijacking jika sesi disadap di jaringan lab atau komputer umum perpustakaan yang lupa di-logout sempurna.',
    remediation: 'Panggil `req.session.destroy()` pada logout, regenerasi session ID saat login (`req.session.regenerate()`), dan batalkan semua sesi aktif dengan kolom `session_version` saat pergantian kata sandi.'
  },
  {
    id: 8,
    slug: 'privilege-escalation',
    name: 'Privilege Escalation (Role Checked Only in Frontend)',
    category: 'Broken Access Control (A01:2021)',
    severity: 'HIGH',
    endpoint: '/api/admin/users',
    method: 'GET / POST',
    explanation: 'Otorisasi peran pengguna hanya diperiksa dengan menyembunyikan tombol navigasi pada antarmuka frontend, sementara endpoint sensitif di backend tidak memvalidasi hak akses role.',
    technicalCause: 'Route administrator (`/api/admin/*`) tidak dilindungi middleware verifikasi role (`requireRole([\'admin\'])`), atau mempercayai parameter role yang dikirimkan oleh klien pada body request.',
    syntheticData: {
      studentUser: 'mhs1 (Role: student)',
      targetEndpoint: '/api/admin/users'
    },
    testingSteps: [
      '1. Login sebagai mahasiswa biasa (mhs1). Di tampilan antarmuka tidak terdapat menu Admin.',
      '2. Akses langsung endpoint administrasi: `GET /api/admin/users` atau `POST /api/admin/users`.',
      '3. Dalam Mode RENTAN: Backend mengembalikan daftar seluruh pengguna kampus atau menerima pembuatan akun admin baru karena tidak ada otorisasi role di backend.',
      '4. Aktifkan Mode AMAN dan kirim kembali permintaan yang sama.',
      '5. Dalam Mode AMAN: Backend memeriksa role sesi pengguna dan mengembalikan status HTTP 403 Forbidden dengan pesan penolakan hak akses.'
    ],
    expectedVulnerable: 'Mahasiswa dapat mengakses data manajemen user dan fungsi administratif tanpa pembatasan role backend.',
    expectedSecure: 'Backend menolak akses dengan status HTTP 403: "Akses ditolak: Anda tidak memiliki wewenang administrator."',
    technicalEvidence: 'VULNERABLE: Mahasiswa mengakses `/api/admin/users` menghasilkan HTTP 200 OK dengan daftar akun. SECURE: Menghasilkan HTTP 403 Forbidden dengan log audit peringatan eskalasi akses.',
    impact: 'Mahasiswa dapat mengubah nilai, membuat akun palsu, atau menghapus data akademik institusi.',
    remediation: 'Wajib terapkan middleware otorisasi berbasis role (`requireRole([\'admin\'])`) di setiap endpoint sensitif backend. Jangan pernah mempercayai validasi di sisi frontend semata.'
  }
];

function getAllScenarios() {
  return scenarios;
}

function getScenarioBySlug(slug) {
  return scenarios.find(s => s.slug === slug);
}

function getScenarioById(id) {
  return scenarios.find(s => s.id === parseInt(id, 10));
}

module.exports = {
  getAllScenarios,
  getScenarioBySlug,
  getScenarioById
};
