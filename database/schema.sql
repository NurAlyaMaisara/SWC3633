-- =====================================================================
-- schema.sql  (DDL)  -  Ticket.exe shared database
-- Event Ticketing & Venue Booking System  (SWC3633 / SWC4443)
--
-- One database shared by every member's backend module and frontend.
-- Run this first, then seed.sql.
--
-- Tables (7):
--   users              Auth & Users Lead
--   event_categories   Events & Venues Lead
--   venues             Events & Venues Lead
--   events             Events & Venues Lead
--   schedules          Events & Venues Lead
--   bookings           Bookings & Payments Lead
--   payments           Bookings & Payments Lead
--
-- Relationships:
--   users 1..* venues        (venues.created_by, optional)
--   users 1..* events        (events.organiser_id)
--   event_categories 1..* events
--   events 1..* schedules    venues 1..* schedules
--   users 1..* bookings      (bookings.customer_id)
--   schedules 1..* bookings
--   bookings 1..* payments
-- =====================================================================
CREATE DATABASE IF NOT EXISTS event_booking_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE event_booking_db;

-- Drop in reverse dependency order so the script can be re-run safely
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS venues;
DROP TABLE IF EXISTS event_categories;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- USERS  (Administrator, Organiser, Staff, Customer)
-- ---------------------------------------------------------------------
CREATE TABLE users (
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

-- ---------------------------------------------------------------------
-- EVENT CATEGORIES  (Concert, Workshop, ...)
-- ---------------------------------------------------------------------
CREATE TABLE event_categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(50)  NOT NULL,
  description VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_event_categories_name UNIQUE (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- VENUES  (physical locations where schedules take place)
-- ---------------------------------------------------------------------
CREATE TABLE venues (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(150) NOT NULL,
  address     VARCHAR(255) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  capacity    INT UNSIGNED NOT NULL,
  facilities  TEXT NULL,
  created_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_venues_name_city UNIQUE (name, city),
  CONSTRAINT chk_venues_capacity CHECK (capacity > 0),
  CONSTRAINT fk_venues_created_by FOREIGN KEY (created_by)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- EVENTS  (owned by an organiser; can run on several schedules)
-- ---------------------------------------------------------------------
CREATE TABLE events (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organiser_id  INT UNSIGNED NOT NULL,
  category_id   INT UNSIGNED NOT NULL,
  title         VARCHAR(150) NOT NULL,
  description   TEXT NULL,
  image_url     VARCHAR(255) NULL,
  status        ENUM('draft','published','cancelled') NOT NULL DEFAULT 'draft',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_events_organiser FOREIGN KEY (organiser_id)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_events_category FOREIGN KEY (category_id)
    REFERENCES event_categories (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- SCHEDULES  (one showing of an event at a venue, with price & ticket stock)
-- ---------------------------------------------------------------------
CREATE TABLE schedules (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id          INT UNSIGNED NOT NULL,
  venue_id          INT UNSIGNED NOT NULL,
  start_time        DATETIME NOT NULL,
  end_time          DATETIME NOT NULL,
  ticket_price      DECIMAL(10,2) NOT NULL,
  total_tickets     INT UNSIGNED NOT NULL,
  available_tickets INT UNSIGNED NOT NULL,
  status            ENUM('open','sold_out','closed') NOT NULL DEFAULT 'open',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_schedules_time      CHECK (end_time > start_time),
  CONSTRAINT chk_schedules_price     CHECK (ticket_price >= 0),
  CONSTRAINT chk_schedules_total     CHECK (total_tickets > 0),
  CONSTRAINT chk_schedules_available CHECK (available_tickets <= total_tickets),
  CONSTRAINT fk_schedules_event FOREIGN KEY (event_id)
    REFERENCES events (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_schedules_venue FOREIGN KEY (venue_id)
    REFERENCES venues (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- NOTE: no index on schedules.start_time yet. It is added later as a measured
-- optimisation (before/after timing) for the Debugging & Performance section.

-- ---------------------------------------------------------------------
-- BOOKINGS  (a customer's tickets for one schedule)
--   pending   -> seats held, waiting for payment
--   confirmed -> paid
--   cancelled -> seats released back to schedules.available_tickets
-- unit_price is copied from schedules.ticket_price at booking time so the
-- booking keeps its price even if the organiser changes the schedule later.
-- A schedule (or its event) with bookings cannot be deleted (RESTRICT);
-- it should be closed or cancelled instead.
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_ref   VARCHAR(20)  NOT NULL,
  customer_id   INT UNSIGNED NOT NULL,
  schedule_id   INT UNSIGNED NOT NULL,
  quantity      INT UNSIGNED NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  total_amount  DECIMAL(10,2) NOT NULL,
  status        ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  cancelled_at  DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_bookings_ref UNIQUE (booking_ref),
  CONSTRAINT chk_bookings_quantity CHECK (quantity > 0),
  CONSTRAINT chk_bookings_price    CHECK (unit_price >= 0),
  CONSTRAINT chk_bookings_total    CHECK (total_amount = quantity * unit_price),
  CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_schedule FOREIGN KEY (schedule_id)
    REFERENCES schedules (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PAYMENTS  (one or more payment attempts per booking)
-- ---------------------------------------------------------------------
CREATE TABLE payments (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id      INT UNSIGNED NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  method          ENUM('card','fpx','ewallet') NOT NULL,
  transaction_ref VARCHAR(50) NULL,
  status          ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  paid_at         DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_payments_transaction_ref UNIQUE (transaction_ref),
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id)
    REFERENCES bookings (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
