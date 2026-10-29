CREATE DATABASE IF NOT EXISTS attendance_db CHARACTER SET utf8mb4;
USE attendance_db;
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS attendance, class_assignments, subjects, students, faculty, users, departments;
SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL
);
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin','faculty','student') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
);
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  department_id INT NOT NULL,
  year TINYINT NOT NULL,
  semester TINYINT NOT NULL,
  section VARCHAR(5) NOT NULL,
  roll_no VARCHAR(30),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  INDEX idx_students_class (department_id, year, section)
);
CREATE TABLE faculty (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  department_id INT NOT NULL,
  designation VARCHAR(60), 
  name VARCHAR(20),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
CREATE TABLE subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  department_id INT NOT NULL,
  year TINYINT NOT NULL,
  semester TINYINT NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
CREATE TABLE class_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  faculty_id INT NOT NULL,
  subject_id INT NOT NULL,
  department_id INT NOT NULL,
  year TINYINT NOT NULL,
  section VARCHAR(5) NOT NULL,
  UNIQUE KEY uq_assignment (subject_id, department_id, year, section),
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  INDEX idx_assign_faculty (faculty_id)
);
CREATE TABLE attendance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  date DATE NOT NULL,
  period TINYINT NOT NULL DEFAULT 1,
  status ENUM('Present','Absent','Leave') NOT NULL,
  marked_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance (student_id, subject_id, date, period),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES faculty(id) ON DELETE SET NULL,
  INDEX idx_att_date (date),
  INDEX idx_att_subject_date (subject_id, date),
  INDEX idx_att_marker_date (marked_by, date)
);

