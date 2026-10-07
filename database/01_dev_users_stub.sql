-- =====================================================================
-- 01_dev_users_stub.sql
-- TEMPORARY - for local development of the Events & Venues module only.
-- The Auth & Users lead owns the real `users` table and seed data.
-- Delete this file once the merged schema.sql / seed.sql exist.
-- Columns follow the group's agreed field list so the merge is painless.
-- =====================================================================
CREATE DATABASE IF NOT EXISTS event_booking_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE event_booking_db;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20)  NULL,
  role          ENUM('admin','organiser','staff','customer') NOT NULL DEFAULT 'customer',
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB;

-- Placeholder hashes: these accounts cannot log in. Real bcrypt hashes come from the Auth lead.
INSERT IGNORE INTO users (id, full_name, email, password_hash, phone, role) VALUES
(1, 'System Admin',    'admin@eventbook.test',  'DEV_ONLY_NOT_A_REAL_HASH', '0123000001', 'admin'),
(2, 'Wyatt Anderson',  'wyatt@eventbook.test',  'DEV_ONLY_NOT_A_REAL_HASH', '0123000002', 'organiser'),
(3, 'Damon Vance',     'damon@eventbook.test',  'DEV_ONLY_NOT_A_REAL_HASH', '0123000003', 'organiser'),
(4, 'Audrey Gomez',    'audrey@eventbook.test', 'DEV_ONLY_NOT_A_REAL_HASH', '0123000004', 'staff'),
(5, 'Kimi Antoneli',   'kimi@eventbook.test',   'DEV_ONLY_NOT_A_REAL_HASH', '0123000005', 'customer'),
(6, 'Jace Walker',     'jace@eventbook.test',   'DEV_ONLY_NOT_A_REAL_HASH', '0123000006', 'customer');
