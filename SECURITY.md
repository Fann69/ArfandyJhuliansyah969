# KEBIJAKAN KEAMANAN & PANDUAN LABORATORIUM (SECURITY.MD)

Dokumen ini mendefinisikan batasan lingkungan praktikum, kontrol keamanan defensif, katalog kelemahan yang sengaja dibuat (*deliberate vulnerabilities*), serta etika pengujian keamanan pada proyek **Portal Kampus Fiktif**.

---

## 1. Batasan Lingkungan & Isolasi Lab

1. **Lingkungan Terisolasi (*Localhost Only*):**
   - Aplikasi ini dirancang untuk dijalankan hanya pada lingkungan lokal (`127.0.0.1` / `localhost`) atau jaringan laboratorium komputer tertutup.
   - Aplikasi ini **TIDAK BOLEH** di-*deploy* ke *production server* atau dibuka ke internet publik menggunakan *port forwarding* / *reverse proxy* / *tunnels* saat berada dalam Mode RENTAN.

2. **Penggunaan Data Sintetis (Non-Real Data):**
   - Seluruh data akun, nomor induk (NIM/NIDN), transkrip nilai, dan pesan forum adalah data buatan/sintetis.
   - Sistem tidak terhubung ke API eksternal, sistem akademik kampus nyata, atau basis data pihak ketiga.

3. **Integritas Berkas Unggahan:**
   - Direktori penyimpanan berkas unggahan (`uploads/`) tidak memiliki hak akses eksekusi skrip server (*non-executable directory*). Berkas diunduh dengan header `Content-Disposition: attachment` dan `X-Content-Type-Options: nosniff` untuk mencegah eksekusi sepihak.

---

## 2. Katalog Kelemahan yang Sengaja Dibuat (Mode RENTAN)

Dalam **Mode RENTAN (`LAB_MODE=vulnerable`)**, aplikasi memuat delapan kelemahan klasik OWASP Top 10 berikut:

1. **SQL Injection (A03:2021):**
   - *Lokasi:* [`src/controllers/labController.js`](file:///d:/Arfandy%20Jhuliansyah/src/controllers/labController.js) (`searchCoursesApi`).
   - *Penyebab:* Pemanggilan `db.rawQuery` dengan penggabungan string literal tanpa sanitasi input.
   - *Risiko:* Akses seluruh tabel basis data tanpa batasan filter.

2. **Stored Cross-Site Scripting (A03:2021):**
   - *Lokasi:* [`src/controllers/discussionController.js`](file:///d:/Arfandy%20Jhuliansyah/src/controllers/discussionController.js) & [`src/views/discussion/index.ejs`](file:///d:/Arfandy%20Jhuliansyah/src/views/discussion/index.ejs).
   - *Penyebab:* Konten diskusi disimpan dan dirender langsung dengan tag HTML mentah (`<%- %>`).
   - *Risiko:* Eksekusi event handler JavaScript di browser pengguna lain.

3. **Insecure Direct Object Reference / IDOR (A01:2021):**
   - *Lokasi:* [`src/controllers/studentController.js`](file:///d:/Arfandy%20Jhuliansyah/src/controllers/studentController.js) (`getGradesApi`).
   - *Penyebab:* Menggunakan identifier URL `req.params.studentId` langsung untuk mengambil data tanpa memverifikasi hak milik sesi aktif.
   - *Risiko:* Akses transkrip nilai rahasia mahasiswa lain.

4. **Cross-Site Request Forgery / CSRF (A01:2021):**
   - *Lokasi:* [`src/controllers/authController.js`](file:///d:/Arfandy%20Jhuliansyah/src/controllers/authController.js) (`updateEmail`).
   - *Penyebab:* Endpoint state-changing POST tidak memvalidasi Anti-CSRF Synchronizer Token.
   - *Risiko:* Perubahan alamat email akun melalui permintaan paksa lintas situs.

5. **Unrestricted Password Attempts & Enumeration (A07:2021):**
   - *Lokasi:* [`src/controllers/authController.js`](file:///d:/Arfandy%20Jhuliansyah/src/controllers/authController.js) (`login`).
   - *Penyebab:* Tidak adanya rate limiting dan perbedaan pesan kesalahan saat username tidak ada vs saat password salah.
   - *Risiko:* Penebakan password otomatis (*brute force*) dan pemetaan username terdaftar (*account enumeration*).

6. **Weak File Upload Validation (A05:2021):**
   - *Lokasi:* [`src/controllers/studentController.js`](file:///d:/Arfandy%20Jhuliansyah/src/controllers/studentController.js) (`uploadAssignment`).
   - *Penyebab:* Ekstensi dan MIME type berkas tidak diperiksa di sisi server, serta penyimpanan dengan nama asli.
   - *Risiko:* Unggahan berkas berpotensi berbahaya (.php, .html, .exe).

7. **Broken Session Management (A07:2021):**
   - *Lokasi:* [`src/controllers/authController.js`](file:///d:/Arfandy%20Jhuliansyah/src/controllers/authController.js) (`logout` & `changePassword`).
   - *Penyebab:* Logout hanya menghapus cookie browser tanpa memanggil `req.session.destroy()`, dan perubahan sandi tidak membatalkan sesi lama di perangkat lain.
   - *Risiko:* Penggunaan kembali session identifier lama (*session hijacking/reuse*).

8. **Privilege Escalation (A01:2021):**
   - *Lokasi:* [`src/controllers/adminController.js`](file:///d:/Arfandy%20Jhuliansyah/src/controllers/adminController.js) (`getUsersApi`).
   - *Penyebab:* Endpoint administrasi hanya disembunyikan tombolnya di antarmuka frontend tanpa otorisasi peran di backend.
   - *Risiko:* Mahasiswa dapat membaca seluruh data akun administrator.

---

## 3. Kontrol Keamanan Defensif (Mode AMAN)

Dalam **Mode AMAN (`LAB_MODE=secure`)**, seluruh kerentanan di atas diperbaiki secara ketat di sisi backend:

1. **Prepared Statements & Parameterization:**
   - Semua perintah SQL dieksekusi dengan *prepared statements* menggunakan placeholder `?`, menjamin pemisahan kode dan data.

2. **Context-Aware Output Encoding:**
   - Semua teks dinamis di-escape menjadi entitas HTML (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#039;`) sebelum dirender ke peramban.

3. **Object-Level Authorization (Kepemilikan Data):**
   - Backend memverifikasi `req.session.user.student_id === targetStudentId` sebelum mengembalikan data nilai.

4. **Synchronizer Token Pattern (CSRF Defense):**
   - Middleware memvalidasi token acak 24-byte heksadesimal pada setiap permintaan HTTP POST, PUT, dan DELETE.

5. **Rate Limiting & Generic Error Messages:**
   - Pembatasan maksimal 5 percobaan login gagal per alamat IP dan username dalam rentang waktu 60 detik. Pesan kesalahan login diseragamkan: *"Username/Email atau kata sandi tidak valid."*

6. **Server-Side File Whitelisting:**
   - Hanya ekstensi `.pdf`, `.docx`, dan `.zip` yang diizinkan dengan batas ukuran maksimal 5 MB. Nama berkas dienkripsi dengan UUID acak.

7. **Proper Session Lifecycle Management:**
   - `req.session.destroy()` dipanggil saat logout.
   - `req.session.regenerate()` dipanggil saat login berhasil untuk mencegah *session fixation*.
   - Kolom `session_version` pada basis data dinaikkan saat kata sandi diperbarui untuk membatalkan seluruh sesi aktif lainnya.

8. **Role-Based Access Control (RBAC):**
   - Middleware `requireRole(['admin'])` memverifikasi peran pengguna dari sesi server tepercaya di setiap endpoint administratif sensitif.

---

## 4. Etika Praktikum

- Seluruh skenario dan alat uji yang disediakan hanya diperuntukkan untuk edukasi dan demonstrasi pada aplikasi lokal ini.
- Dilarang menyalahgunakan payload atau metode pengujian terhadap sistem komputer, server kampus, atau jaringan pihak ketiga tanpa izin resmi tertulis.
