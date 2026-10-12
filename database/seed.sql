-- =====================================================================
-- DATABASE SEED: DATA SINTETIS PRAKTIKUM KEAMANAN WEB
-- Seluruh entitas, nama, nomor identitas, dan nilai adalah FIKTIF (SINTETIS).
-- Digunakan khusus untuk lingkungan lab lokal.
-- =====================================================================

USE `portal_kampus_lab`;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `audit_logs`;
TRUNCATE TABLE `discussions`;
TRUNCATE TABLE `submissions`;
TRUNCATE TABLE `assignments`;
TRUNCATE TABLE `grades`;
TRUNCATE TABLE `enrollments`;
TRUNCATE TABLE `courses`;
TRUNCATE TABLE `lecturers`;
TRUNCATE TABLE `students`;
TRUNCATE TABLE `users`;

-- 1. USERS (Password hashes dihasilkan dengan bcrypt round 10)
-- Admin    : admin@kampuslab.ac.id      / Admin@123
-- Dosen 1  : budi.hartono@kampuslab.ac.id / Dosen@123
-- Dosen 2  : siti.aminah@kampuslab.ac.id  / Dosen@123
-- Mhs 1    : ahmad.fauzi@kampuslab.ac.id  / Mahasiswa@123
-- Mhs 2    : citra.dewi@kampuslab.ac.id   / Mahasiswa@123
-- Mhs 3    : doni.pratama@kampuslab.ac.id / Mahasiswa@123

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `full_name`, `session_version`) VALUES
(1, 'admin', 'admin@kampuslab.ac.id', '$2b$10$BXEs5LRMrkM/PawfL6lVJOZwO.gsCj06DoTZpkQ4l0UJA2MCOPqEq', 'admin', 'Administrator Sistem Lab', 1),
(2, 'dosen1', 'budi.hartono@kampuslab.ac.id', '$2b$10$arOqJi1mCSDKSHFzGFga3euacZYLP81Sr./0q2rmWi/CnzjnJfLGq', 'lecturer', 'Dr. Budi Hartono, M.Kom.', 1),
(3, 'dosen2', 'siti.aminah@kampuslab.ac.id', '$2b$10$arOqJi1mCSDKSHFzGFga3euacZYLP81Sr./0q2rmWi/CnzjnJfLGq', 'lecturer', 'Ir. Siti Aminah, M.T.', 1),
(4, 'mhs1', 'ahmad.fauzi@kampuslab.ac.id', '$2b$10$b1l.zOxafrG8XWnsZ6MGnuxFWbpsm17n59By4TukBwrrfWjtGQ43S', 'student', 'Ahmad Fauzi', 1),
(5, 'mhs2', 'citra.dewi@kampuslab.ac.id', '$2b$10$b1l.zOxafrG8XWnsZ6MGnuxFWbpsm17n59By4TukBwrrfWjtGQ43S', 'student', 'Citra Dewi', 1),
(6, 'mhs3', 'doni.pratama@kampuslab.ac.id', '$2b$10$b1l.zOxafrG8XWnsZ6MGnuxFWbpsm17n59By4TukBwrrfWjtGQ43S', 'student', 'Doni Pratama', 1);

-- 2. LECTURERS
INSERT INTO `lecturers` (`id`, `user_id`, `nidn`, `department`, `title`) VALUES
(1, 2, '0412088001', 'Teknik Informatika', 'Lektor Kepala'),
(2, 3, '0425038502', 'Sistem Informasi', 'Lektor');

-- 3. STUDENTS
INSERT INTO `students` (`id`, `user_id`, `nim`, `program_study`, `semester`, `academic_advisor_id`) VALUES
(1, 4, '202401001', 'Teknik Informatika', 4, 1),
(2, 5, '202401002', 'Teknik Informatika', 4, 1),
(3, 6, '202401003', 'Sistem Informasi', 4, 2);

-- 4. COURSES
INSERT INTO `courses` (`id`, `code`, `name`, `credits`, `lecturer_id`, `semester`, `description`) VALUES
(1, 'IF401', 'Keamanan Aplikasi Web', 3, 1, 4, 'Mata kuliah praktikum identifikasi kerentanan dan secure software development.'),
(2, 'IF402', 'Rekayasa Perangkat Lunak', 3, 1, 4, 'Desain dan metodologi pembangunan perangkat lunak berskala industri.'),
(3, 'SI305', 'Manajemen Basis Data Terdistribusi', 3, 2, 4, 'Arsitektur, replikasi, dan optimasi query pada database skala besar.');

-- 5. ENROLLMENTS
INSERT INTO `enrollments` (`id`, `student_id`, `course_id`, `academic_year`, `status`) VALUES
(1, 1, 1, '2026/2027-Genap', 'active'),
(2, 1, 2, '2026/2027-Genap', 'active'),
(3, 2, 1, '2026/2027-Genap', 'active'),
(4, 2, 3, '2026/2027-Genap', 'active'),
(5, 3, 3, '2026/2027-Genap', 'active');

-- 6. GRADES
INSERT INTO `grades` (`id`, `enrollment_id`, `student_id`, `course_id`, `task_score`, `midterm_score`, `final_score`, `letter_grade`, `feedback`, `updated_by`) VALUES
(1, 1, 1, 1, 88.50, 85.00, 90.00, 'A', 'Analisis keamanan OWASP sangat komprehensif.', 2),
(2, 2, 1, 2, 78.00, 80.00, 82.00, 'B+', 'Diagram arsitektur UML rapi dan terstruktur.', 2),
(3, 3, 2, 1, 92.00, 90.00, 94.00, 'A', 'Skenario mitigasi XSS dan IDOR diuji tuntas.', 2),
(4, 4, 2, 3, 85.00, 82.50, 87.00, 'A', 'Desain sharding database sangat matang.', 3),
(5, 5, 3, 3, 70.00, 75.00, 73.00, 'B', 'Perlu optimasi pada indeks transaksi.', 3);

-- 7. ASSIGNMENTS
INSERT INTO `assignments` (`id`, `course_id`, `title`, `description`, `due_date`) VALUES
(1, 1, 'Tugas 1: Audit Keamanan Session & Otorisasi', 'Analisis manajemen session dan identifikasi potensi IDOR pada modul mahasiswa. Kumpulkan laporan format PDF.', '2026-11-20 23:59:00'),
(2, 1, 'Tugas 2: Mitigasi SQL Injection dan XSS', 'Tuliskan kode perbaikan menggunakan parameterized query dan context-aware escaping.', '2026-11-27 23:59:00'),
(3, 2, 'Tugas Analisis Kebutuhan Sistem Kampus', 'Dokumentasikan Use Case dan Sequence Diagram untuk portal akademik.', '2026-11-25 23:59:00');

-- 8. SUBMISSIONS
INSERT INTO `submissions` (`id`, `assignment_id`, `student_id`, `original_filename`, `stored_filename`, `file_path`, `file_size`, `mime_type`, `notes`) VALUES
(1, 1, 1, 'laporan_audit_session_ahmad.pdf', 'sub_1_4_1700000000_audit.pdf', 'uploads/sub_1_4_1700000000_audit.pdf', 245760, 'application/pdf', 'Laporan lengkap analisis session fixation dan IDOR pada endpoint nilai.');

-- 9. DISCUSSIONS
INSERT INTO `discussions` (`id`, `course_id`, `user_id`, `parent_id`, `title`, `content`) VALUES
(1, 1, 2, NULL, 'Selamat Datang di Lab Keamanan Web', 'Silakan gunakan forum ini untuk berdiskusi seputar materi OWASP Top 10 dan praktikum lab.'),
(2, 1, 4, 1, 'Tanya Format Laporan Tugas 1', 'Apakah laporan tugas 1 wajib menyertakan log request HTTP atau cukup screenshot hasil pengujian?'),
(3, 1, 2, 2, 'Re: Tanya Format Laporan Tugas 1', 'Sertakan tabel hasil uji sebelum dan sesudah perbaikan beserta screenshot respons HTTP.');

-- 10. AUDIT LOGS
INSERT INTO `audit_logs` (`id`, `user_id`, `action`, `details`, `ip_address`, `user_agent`, `status`, `mode`) VALUES
(1, 1, 'SYSTEM_INIT', 'Inisialisasi database laboratorium keamanan portal kampus sintetis.', '127.0.0.1', 'Node.js/Lab-Runner', 'success', 'secure'),
(2, 4, 'LOGIN_SUCCESS', 'Mahasiswa Ahmad Fauzi login ke portal lab.', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'success', 'secure');

SET FOREIGN_KEY_CHECKS = 1;
