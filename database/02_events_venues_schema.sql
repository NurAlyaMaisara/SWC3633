-- =====================================================================
-- 02_events_venues_schema.sql  (DDL)
-- Owner: Events & Venues Lead
-- Tables: event_categories, venues, events, schedules
-- Requires: users table (Auth lead). Run before bookings/payments DDL.
-- =====================================================================
USE event_booking_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS venues;
DROP TABLE IF EXISTS event_categories;
SET FOREIGN_KEY_CHECKS = 1;

-- Reference table for grouping events (Concert, Workshop, ...)
CREATE TABLE event_categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(50)  NOT NULL,
  description VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_event_categories_name UNIQUE (name)
) ENGINE=InnoDB;

-- Physical locations where schedules take place
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

-- An event (e.g. a concert) owned by an organiser; it can run on several schedules
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

-- One showing of an event at a venue, with its own price and ticket stock.
-- Bookings reference schedules (bookings.schedule_id).
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
