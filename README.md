# PORTAL KAMPUS FIKTIF - PRAKTIKUM KEAMANAN APLIKASI WEB

Aplikasi web portal kampus sintetis berbasis **Node.js**, **Express.js**, **EJS**, dan **MySQL** (kompatibel penuh dengan XAMPP & phpMyAdmin, serta fallback otomatis SQLite). Aplikasi ini dirancang khusus untuk pembelajaran rekayasa keamanan aplikasi web (*Web Application Security Engineering*), audit kode (*Secure Code Review*), dan praktikum deteksi kerentanan berbasis **OWASP Top 10**.

---

## 1. Ikhtisar & Fitur Portal

Aplikasi memiliki tiga peran (*role*) pengguna dengan batasan hak akses masing-masing:

1. **Mahasiswa (`student`)**
   - Autentikasi Login dan Logout berbasis sesi server.
   - Melihat profil akademik mahasiswa.
   - Melihat transkrip & kartu hasil studi (KHS) milik sendiri.
   - Mengunggah berkas laporan tugas/praktikum dengan validasi whitelist.
   - Mengikuti dan mengirim tanggapan pada forum diskusi akademik.

2. **Dosen (`lecturer`)**
   - Login dan Logout.
   - Melihat daftar mahasiswa pada kelas mata kuliah yang diampu.
   - Menginputkan dan memperbarui nilai (Tugas 30%, UTS 30%, UAS 40%) beserta feedback.
   - Mengunduh dan meninjau berkas tugas yang dikumpulkan mahasiswa.
   - Membalas diskusi perkuliahan.

3. **Administrator (`admin`)**
   - Manajemen akun pengguna kampus (Mahasiswa, Dosen, Admin).
   - Manajemen kurikulum mata kuliah dan penugasan dosen pengampu.
   - Pemantauan log aktivitas keamanan dan audit forensik (`audit_logs`).

---

## 2. Dua Mode Praktikum: RENTAN vs AMAN

Aplikasi menyediakan tombol alih mode (*toggle switch*) pada bilah navigasi atas (navbar) serta dukungan header `x-lab-mode: vulnerable | secure` dan query parameter:

- ⚠️ **MODE RENTAN (VULNERABLE):**  
  Sengaja mengaktifkan pola kode yang memiliki kelemahan keamanan klasik OWASP untuk keperluan demonstrasi dan analisis eksploitasi data sintetis di jaringan lokal terisolasi.
- 🛡️ **MODE AMAN (SECURE):**  
  Menerapkan kontrol keamanan menyeluruh di sisi backend (Prepared Statements, Context-Aware Escaping, Object-Level Authorization, Anti-CSRF Token, Rate Limiter, Whitelist Berkas, dan Session Invalidation).

---

## 3. Katalog 8 Skenario Kerentanan Praktikum

| No | Skenario Kerentanan | Kategori OWASP | Endpoint Target | Pola Mode Rentan | Kontrol Keamanan Mode Aman |
|:--:|:--------------------|:--------------|:----------------|:-----------------|:---------------------------|
| **1** | **SQL Injection (SQLi)** | A03:2021 - Injection | `GET /api/courses/search?q=` | Konkatenasi string langsung pada klausa WHERE | Prepared Statements (`?` parameterization) |
| **2** | **Stored XSS** | A03:2021 - Injection | `POST /discussions/post` | Tag HTML dirender mentah (`<%- %>`) | HTML entity encoding (`<%= %>` / `escapeHtml`) |
| **3** | **IDOR** | A01:2021 - Broken Access Control | `GET /api/students/grades/:studentId` | Mengambil data ID objek tanpa verifikasi kepemilikan subjek | Verifikasi kepemilikan backend (`session.user.student_id === targetId`) |
| **4** | **CSRF** | A01:2021 - Broken Access Control | `POST /api/profile/update-email` | Menerima mutasi data tanpa Anti-CSRF token | Validasi Synchronizer CSRF Token di middleware |
| **5** | **Brute Force & Enumeration** | A07:2021 - Identification & Auth Failures | `POST /api/auth/login` | Membocorkan status username & percobaan tanpa batas | Pesan generik seragam & Rate Limiting HTTP 429 |
| **6** | **Weak File Upload** | A05:2021 - Security Misconfiguration | `POST /api/assignments/upload` | Menerima berkas ekstensi berbahaya (misal `.php`) | Whitelist `.pdf, .docx, .zip`, batas 5MB, UUID acak |
| **7** | **Broken Session** | A07:2021 - Identification & Auth Failures | `POST /api/auth/logout` | Hanya menghapus cookie browser; sesi server tetap aktif | Pemusnahan sesi server (`destroy`) & kenaikan `session_version` |
| **8** | **Privilege Escalation** | A01:2021 - Broken Access Control | `GET /api/admin/users` | Akses admin hanya disembunyikan di menu tampilan frontend | Middleware otorisasi backend `requireRole(['admin'])` |

---

## 4. Persyaratan Sistem

- **Node.js:** Versi 18 LTS ke atas (Teruji pada Node.js v24 LTS).
- **Web Server / Basis Data:** MySQL / MariaDB (Dapat menggunakan **XAMPP** dengan Apache & phpMyAdmin).  
  *Catatan:* Aplikasi dilengkapi modul fallback otomatis SQLite (`database/portal_kampus_lab.sqlite`) sehingga dapat berjalan langsung tanpa instalasi database tambahan.

---

## 5. Panduan Instalasi & Menjalankan Aplikasi

### Langkah 1: Pasang Dependency
Buka terminal PowerShell pada direktori proyek:
```powershell
npm install
```

### Langkah 2: Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```powershell
Copy-Item .env.example .env
```
Isi konfigurasi database MySQL XAMPP Anda:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=kunci-rahasia-sesi-laboratorium-praktikum-keamanan-2026
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=portal_kampus_lab
LAB_MODE_DEFAULT=vulnerable
UPLOAD_DIR=uploads
```

### Langkah 3: Impor Basis Data melalui phpMyAdmin
1. Buka browser dan akses **phpMyAdmin** di `http://localhost/phpmyadmin`.
2. Klik tab **Import** (atau buat database baru bernama `portal_kampus_lab`).
3. Pilih berkas [`database/schema.sql`](file:///d:/Arfandy%20Jhuliansyah/database/schema.sql), lalu klik tombol **Go / Kirim**.
4. Setelah struktur tabel berhasil dibuat, pilih berkas [`database/seed.sql`](file:///d:/Arfandy%20Jhuliansyah/database/seed.sql), lalu klik **Go / Kirim** untuk mengisi data akademik sintetis.

### Langkah 4: Jalankan Server Lokal
```powershell
npm start
```
Buka browser Anda dan akses:
- **Dashboard Lab Praktikum Keamanan:** [http://localhost:3000/lab](http://localhost:3000/lab)
- **Halaman Login Portal Kampus:** [http://localhost:3000/auth/login](http://localhost:3000/auth/login)
- **Matriks Perbandingan Kode:** [http://localhost:3000/lab/comparison](http://localhost:3000/lab/comparison)

---

## 6. Kredensial Akun Dummy Sintetis

Seluruh password dienkripsi menggunakan algoritma `bcrypt` (10 rounds):

| Peran (Role) | Username | Email | Password | Keterangan Akun |
|:-------------|:---------|:------|:---------|:----------------|
| **Administrator** | `admin` | `admin@kampuslab.ac.id` | `Admin@123` | Akses penuh pengguna, kurikulum, dan audit logs |
| **Dosen 1** | `dosen1` | `budi.hartono@kampuslab.ac.id` | `Dosen@123` | Dr. Budi Hartono, M.Kom. (Dosen Keamanan Web) |
| **Dosen 2** | `dosen2` | `siti.aminah@kampuslab.ac.id` | `Dosen@123` | Ir. Siti Aminah, M.T. (Dosen Basis Data) |
| **Mahasiswa 1** | `mhs1` | `ahmad.fauzi@kampuslab.ac.id` | `Mahasiswa@123` | Ahmad Fauzi (NIM: 202401001, Student ID: 1) |
| **Mahasiswa 2** | `mhs2` | `citra.dewi@kampuslab.ac.id` | `Mahasiswa@123` | Citra Dewi (NIM: 202401002, Student ID: 2) |
| **Mahasiswa 3** | `mhs3` | `doni.pratama@kampuslab.ac.id` | `Mahasiswa@123` | Doni Pratama (NIM: 202401003, Student ID: 3) |

*Tips:* Pada halaman login tersedia fitur **1-Click Quick Fill** untuk mengisi form login akun dummy secara instan.

---

## 7. Menjalankan Pengujian Otomatis

Proyek ini dilengkapi test runner otomatis yang memverifikasi perilaku backend pada mode RENTAN dan mode AMAN secara menyeluruh:

```powershell
npm test
```

Setiap skenario akan mencetak 7 poin analisis:
1. Prediksi Hasil
2. Langkah Pengujian
3. Hasil Aktual
4. Penyebab Teknis
5. Kontrol Keamanan
6. Pengujian Ulang Setelah Perbaikan
7. Kesimpulan

---

## 8. Peringatan Keamanan & Batasan Lingkungan

> [!CAUTION]
> **PERINGATAN PENTING PENDIDIKAN KEAMANAN:**
> 1. Aplikasi ini memuat kerentanan yang **SENGAJA DIBUAT** untuk tujuan praktikum laboratorium dan riset akademis mahasiswa.
> 2. Dilarang keras membuka atau menghubungkan aplikasi ini ke jaringan publik atau internet luas saat berada dalam **Mode RENTAN**.
> 3. Seluruh data identitas (NIM, NIDN, Nilai, Nama, Email) adalah **100% SINTETIS (FIKTIF)**.
> 4. Jangan pernah menggunakan data asli institusi pendidikan manapun di lingkungan lab ini.
