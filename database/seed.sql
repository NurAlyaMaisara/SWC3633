-- =====================================================================
-- seed.sql  (DML)  -  Ticket.exe shared sample data
-- Run after schema.sql. Every member uses this same data.
-- Dates are relative to Oct 2026.
--
-- TEST LOGINS (passwords are stored as real bcrypt hashes, cost 10)
--   id  email                   role       password
--   1   admin@eventbook.test    admin      Admin@123
--   2   wyatt@eventbook.test    organiser  Organiser@123
--   3   damon@eventbook.test    organiser  Organiser@123
--   4   audrey@eventbook.test   staff      Staff@123
--   5   kimi@eventbook.test     customer   Customer@123
--   6   jace@eventbook.test     customer   Customer@123
-- Test passwords only - never reuse them outside this project.
-- =====================================================================
USE event_booking_db;

-- ---------------------------------------------------------------------
-- USERS (6)
-- ---------------------------------------------------------------------
INSERT INTO users (id, full_name, email, password_hash, phone, role) VALUES
(1, 'System Admin',    'admin@eventbook.test',  '$2b$10$MZgSmjsP2psz0wa7RXhHFOX5/vy5V/qblOWRvCis/h4IvaVkKps1K', '0123000001', 'admin'),
(2, 'Wyatt Anderson',  'wyatt@eventbook.test',  '$2b$10$158LwgAWHvOSIU1uzhIFO.HrATxbSHZBjE7DDWS6wJSAqPpwRA.qW', '0123000002', 'organiser'),
(3, 'Damon Vance',     'damon@eventbook.test',  '$2b$10$158LwgAWHvOSIU1uzhIFO.HrATxbSHZBjE7DDWS6wJSAqPpwRA.qW', '0123000003', 'organiser'),
(4, 'Audrey Gomez',    'audrey@eventbook.test', '$2b$10$ZN4ylv.w00d8NJnYpBGI0.1K13xI2h/sQE7u1gq8ONIeyTz8PxvvG', '0123000004', 'staff'),
(5, 'Kimi Antoneli',   'kimi@eventbook.test',   '$2b$10$XB.kzeT.bMXrGdLDGohvXevtaSNJAqIt6C4l.2IZJXWRWXcNiR7X.', '0123000005', 'customer'),
(6, 'Jace Walker',     'jace@eventbook.test',   '$2b$10$XB.kzeT.bMXrGdLDGohvXevtaSNJAqIt6C4l.2IZJXWRWXcNiR7X.', '0123000006', 'customer');

-- ---------------------------------------------------------------------
-- EVENT CATEGORIES (6)
-- ---------------------------------------------------------------------
INSERT INTO event_categories (id, name, description) VALUES
(1, 'Concert',    'Live music performances'),
(2, 'Workshop',   'Hands-on learning sessions'),
(3, 'Conference', 'Talks, panels and industry conferences'),
(4, 'Sports',     'Matches, tournaments and sports days'),
(5, 'Theatre',    'Stage plays and musicals'),
(6, 'Exhibition', 'Exhibitions, expos and fairs');

-- ---------------------------------------------------------------------
-- VENUES (6)
-- ---------------------------------------------------------------------
INSERT INTO venues (id, name, address, city, state, capacity, facilities, created_by) VALUES
(1, 'Axiata Arena',                 'Jalan Barat, Bukit Jalil',                      'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur', 16000, 'Parking, food court, accessible seating', 1),
(2, 'MITEC',                        'Jalan Dutamas 2',                               'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur', 10000, 'Exhibition halls, parking, Wi-Fi', 1),
(3, 'Dewan Filharmonik Petronas',   'Kuala Lumpur City Centre',                      'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur',   900, 'Concert hall acoustics, wheelchair access', 2),
(4, 'Zepp Kuala Lumpur',            'Jalan Hang Tuah, Bukit Bintang',                'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur',  2400, 'Standing area, bar, lockers', 2),
(5, 'Setia City Convention Centre', 'Setia Alam',                                    'Shah Alam',    'Selangor',                          5000, 'Ballroom, parking, Wi-Fi', 3),
(6, 'UPTM Main Hall',               'Jalan 6/91, Taman Shamelin Perkasa, Cheras',    'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur',   800, 'Stage, projector, PA system', 1);

-- ---------------------------------------------------------------------
-- EVENTS (8)
-- ---------------------------------------------------------------------
INSERT INTO events (id, organiser_id, category_id, title, description, image_url, status) VALUES
(1, 2, 1, 'Malaysia Jazz Night 2026',     'An evening of live jazz featuring local and regional bands.',            NULL, 'published'),
(2, 2, 2, 'Secure Coding Workshop',       'Hands-on workshop on OWASP Top 10 and writing secure web APIs.',        NULL, 'published'),
(3, 3, 3, 'KL Cybersecurity Summit 2026', 'Talks on threat intelligence, cloud security and incident response.',  NULL, 'published'),
(4, 3, 4, 'Varsity Futsal Cup',           'Inter-university futsal tournament with group and knockout stages.',    NULL, 'published'),
(5, 2, 5, 'Hikayat Kota Lama: A Musical', 'A Malay folklore musical with a full live orchestra.',                  NULL, 'draft'),
(6, 3, 6, 'Selangor Tech Expo',           'Exhibition of local tech start-ups, gadgets and career booths.',        NULL, 'published'),
(7, 2, 1, 'Indie Rock Showcase',          'Showcase of upcoming indie rock bands (cancelled by organiser).',       NULL, 'cancelled'),
(8, 3, 2, 'Intro to Ethical Hacking',     'Beginner workshop on reconnaissance and responsible disclosure.',      NULL, 'draft');

-- ---------------------------------------------------------------------
-- SCHEDULES (9) - available_tickets starts equal to total_tickets and is
-- reduced after the bookings are inserted (see the UPDATE further down).
-- ---------------------------------------------------------------------
INSERT INTO schedules (id, event_id, venue_id, start_time, end_time, ticket_price, total_tickets, available_tickets, status) VALUES
(1, 1, 3, '2026-11-14 20:00:00', '2026-11-14 23:00:00', 120.00,  900,  900, 'open'),
(2, 1, 3, '2026-11-15 20:00:00', '2026-11-15 23:00:00', 120.00,  900,  900, 'open'),
(3, 2, 6, '2026-10-24 09:00:00', '2026-10-24 17:00:00',  50.00,  150,  150, 'open'),
(4, 3, 2, '2026-11-25 09:00:00', '2026-11-25 18:00:00', 250.00, 3000, 3000, 'open'),
(5, 4, 1, '2026-12-05 10:00:00', '2026-12-05 20:00:00',  15.00, 5000, 5000, 'open'),
(6, 6, 5, '2026-12-12 10:00:00', '2026-12-12 18:00:00',  10.00, 4000, 4000, 'open'),
(7, 5, 4, '2026-12-19 20:00:00', '2026-12-19 22:30:00',  80.00, 2000, 2000, 'open'),
(8, 2, 6, '2026-09-19 09:00:00', '2026-09-19 17:00:00',  50.00,  150,  150, 'closed'),
(9, 7, 4, '2026-11-07 20:00:00', '2026-11-07 23:00:00',  90.00, 2400, 2400, 'closed');

-- ---------------------------------------------------------------------
-- BOOKINGS (8) - customers only (users 5 and 6)
--   unit_price = the schedule's ticket_price, total_amount = quantity * unit_price
-- ---------------------------------------------------------------------
INSERT INTO bookings (id, booking_ref, customer_id, schedule_id, quantity, unit_price, total_amount, status, cancelled_at, created_at) VALUES
(1, 'BK-20261001-0001', 5, 1, 2, 120.00, 240.00, 'confirmed', NULL,                  '2026-10-01 10:15:00'),
(2, 'BK-20261002-0002', 6, 3, 1,  50.00,  50.00, 'confirmed', NULL,                  '2026-10-02 14:30:00'),
(3, 'BK-20261003-0003', 5, 4, 1, 250.00, 250.00, 'pending',   NULL,                  '2026-10-03 09:05:00'),
(4, 'BK-20261004-0004', 6, 5, 4,  15.00,  60.00, 'confirmed', NULL,                  '2026-10-04 20:45:00'),
(5, 'BK-20260910-0005', 5, 8, 1,  50.00,  50.00, 'confirmed', NULL,                  '2026-09-10 11:00:00'),
(6, 'BK-20260920-0006', 6, 9, 2,  90.00, 180.00, 'cancelled', '2026-09-28 16:00:00', '2026-09-20 13:20:00'),
(7, 'BK-20261005-0007', 6, 6, 3,  10.00,  30.00, 'cancelled', '2026-10-05 18:10:00', '2026-10-05 17:40:00'),
(8, 'BK-20261006-0008', 5, 2, 3, 120.00, 360.00, 'confirmed', NULL,                  '2026-10-06 21:00:00');

-- ---------------------------------------------------------------------
-- PAYMENTS (9)
--   booking 1,2,4,5,8 -> paid
--   booking 3         -> one failed card attempt, still pending (seats held)
--   booking 6         -> paid then refunded (event cancelled by organiser)
--   booking 7         -> failed, customer then cancelled the booking
-- ---------------------------------------------------------------------
INSERT INTO payments (id, booking_id, amount, method, transaction_ref, status, paid_at, created_at) VALUES
(1, 1, 240.00, 'card',    'TXN-CARD-100001', 'paid',     '2026-10-01 10:16:00', '2026-10-01 10:15:30'),
(2, 2,  50.00, 'fpx',     'TXN-FPX-200001',  'paid',     '2026-10-02 14:31:00', '2026-10-02 14:30:30'),
(3, 3, 250.00, 'card',    'TXN-CARD-100002', 'failed',   NULL,                  '2026-10-03 09:06:00'),
(4, 4,  60.00, 'ewallet', 'TXN-EWL-300001',  'paid',     '2026-10-04 20:46:00', '2026-10-04 20:45:30'),
(5, 5,  50.00, 'card',    'TXN-CARD-100003', 'paid',     '2026-09-10 11:01:00', '2026-09-10 11:00:30'),
(6, 6, 180.00, 'fpx',     'TXN-FPX-200002',  'refunded', '2026-09-20 13:21:00', '2026-09-20 13:20:30'),
(7, 7,  30.00, 'ewallet', 'TXN-EWL-300002',  'failed',   NULL,                  '2026-10-05 17:41:00'),
(8, 8, 360.00, 'fpx',     'TXN-FPX-200003',  'paid',     '2026-10-06 21:02:00', '2026-10-06 21:00:30'),
(9, 3, 250.00, 'fpx',     NULL,              'pending',  NULL,                  '2026-10-03 09:10:00');

-- ---------------------------------------------------------------------
-- Keep ticket stock consistent: pending and confirmed bookings hold seats,
-- cancelled bookings do not.
-- ---------------------------------------------------------------------
UPDATE schedules s
SET s.available_tickets = s.total_tickets - (
  SELECT COALESCE(SUM(b.quantity), 0)
  FROM bookings b
  WHERE b.schedule_id = s.id
    AND b.status IN ('pending', 'confirmed')
);
