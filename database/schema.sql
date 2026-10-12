-- =====================================================================
-- DATABASE SCHEMA: PORTAL KAMPUS FIKTIF PRAKTIKUM KEAMANAN WEB
-- Target RDBMS: MySQL / MariaDB (Dapat diimpor melalui phpMyAdmin)
-- Karakteristik: Menggunakan Foreign Key, Index, Enums, dan Constraints
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `portal_kampus_lab` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `portal_kampus_lab`;

-- Matikan foreign key checks saat inisialisasi
SET FOREIGN_KEY_CHECKS = 0;

-- 1. TABEL: users
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('student', 'lecturer', 'admin') NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `session_version` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_username` (`username`),
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABEL: students
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `nim` VARCHAR(20) NOT NULL UNIQUE,
  `program_study` VARCHAR(100) NOT NULL,
  `semester` INT NOT NULL DEFAULT 1,
  `academic_advisor_id` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_students_nim` (`nim`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABEL: lecturers
DROP TABLE IF EXISTS `lecturers`;
CREATE TABLE `lecturers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `nidn` VARCHAR(20) NOT NULL UNIQUE,
  `department` VARCHAR(100) NOT NULL,
  `title` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_lecturers_nidn` (`nidn`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABEL: courses
DROP TABLE IF EXISTS `courses`;
CREATE TABLE `courses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `credits` INT NOT NULL DEFAULT 3,
  `lecturer_id` INT NOT NULL,
  `semester` INT NOT NULL DEFAULT 1,
  `description` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_courses_code` (`code`),
  INDEX `idx_courses_lecturer` (`lecturer_id`),
  FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TABEL: enrollments
DROP TABLE IF EXISTS `enrollments`;
CREATE TABLE `enrollments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `academic_year` VARCHAR(20) NOT NULL DEFAULT '2026/2027-Ganjil',
  `status` ENUM('active', 'completed', 'dropped') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_student_course_year` (`student_id`, `course_id`, `academic_year`),
  INDEX `idx_enroll_student` (`student_id`),
  INDEX `idx_enroll_course` (`course_id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TABEL: grades
DROP TABLE IF EXISTS `grades`;
CREATE TABLE `grades` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `task_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `midterm_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `final_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `letter_grade` VARCHAR(2) NOT NULL DEFAULT 'E',
  `feedback` TEXT NULL,
  `updated_by` INT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_grades_student` (`student_id`),
  INDEX `idx_grades_course` (`course_id`),
  FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TABEL: assignments
DROP TABLE IF EXISTS `assignments`;
CREATE TABLE `assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `due_date` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_assignments_course` (`course_id`),
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TABEL: submissions
DROP TABLE IF EXISTS `submissions`;
CREATE TABLE `submissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `assignment_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `stored_filename` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `file_size` INT NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `notes` TEXT NULL,
  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_subs_assignment` (`assignment_id`),
  INDEX `idx_subs_student` (`student_id`),
  FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TABEL: discussions
DROP TABLE IF EXISTS `discussions`;
CREATE TABLE `discussions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `parent_id` INT NULL,
  `title` VARCHAR(150) NULL,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_disc_course` (`course_id`),
  INDEX `idx_disc_user` (`user_id`),
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. TABEL: audit_logs
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `status` ENUM('success', 'failed', 'blocked') NOT NULL DEFAULT 'success',
  `mode` ENUM('vulnerable', 'secure') NOT NULL DEFAULT 'secure',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_mode` (`mode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nyalakan kembali foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
