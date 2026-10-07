-- =====================================================================
-- 03_events_venues_seed.sql  (DML)
-- Owner: Events & Venues Lead
-- Sample data: >= 5 records per table. Dates are relative to Oct 2026.
-- available_tickets starts equal to total_tickets; the Bookings lead's seed
-- inserts bookings and reduces available_tickets to keep the data consistent.
-- =====================================================================
USE event_booking_db;

INSERT INTO event_categories (id, name, description) VALUES
(1, 'Concert',    'Live music performances'),
(2, 'Workshop',   'Hands-on learning sessions'),
(3, 'Conference', 'Talks, panels and industry conferences'),
(4, 'Sports',     'Matches, tournaments and sports days'),
(5, 'Theatre',    'Stage plays and musicals'),
(6, 'Exhibition', 'Exhibitions, expos and fairs');

INSERT INTO venues (id, name, address, city, state, capacity, facilities, created_by) VALUES
(1, 'Axiata Arena',                 'Jalan Barat, Bukit Jalil',                      'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur', 16000, 'Parking, food court, accessible seating', 1),
(2, 'MITEC',                        'Jalan Dutamas 2',                               'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur', 10000, 'Exhibition halls, parking, Wi-Fi', 1),
(3, 'Dewan Filharmonik Petronas',   'Kuala Lumpur City Centre',                      'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur',   900, 'Concert hall acoustics, wheelchair access', 2),
(4, 'Zepp Kuala Lumpur',            'Jalan Hang Tuah, Bukit Bintang',                'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur',  2400, 'Standing area, bar, lockers', 2),
(5, 'Setia City Convention Centre', 'Setia Alam',                                    'Shah Alam',    'Selangor',                          5000, 'Ballroom, parking, Wi-Fi', 3),
(6, 'UPTM Main Hall',               'Jalan 6/91, Taman Shamelin Perkasa, Cheras',    'Kuala Lumpur', 'Wilayah Persekutuan Kuala Lumpur',   800, 'Stage, projector, PA system', 1);

INSERT INTO events (id, organiser_id, category_id, title, description, image_url, status) VALUES
(1, 2, 1, 'Malaysia Jazz Night 2026',     'An evening of live jazz featuring local and regional bands.',            NULL, 'published'),
(2, 2, 2, 'Secure Coding Workshop',       'Hands-on workshop on OWASP Top 10 and writing secure web APIs.',        NULL, 'published'),
(3, 3, 3, 'KL Cybersecurity Summit 2026', 'Talks on threat intelligence, cloud security and incident response.',  NULL, 'published'),
(4, 3, 4, 'Varsity Futsal Cup',           'Inter-university futsal tournament with group and knockout stages.',    NULL, 'published'),
(5, 2, 5, 'Hikayat Kota Lama: A Musical', 'A Malay folklore musical with a full live orchestra.',                  NULL, 'draft'),
(6, 3, 6, 'Selangor Tech Expo',           'Exhibition of local tech start-ups, gadgets and career booths.',        NULL, 'published'),
(7, 2, 1, 'Indie Rock Showcase',          'Showcase of upcoming indie rock bands (cancelled by organiser).',       NULL, 'cancelled'),
(8, 3, 2, 'Intro to Ethical Hacking',     'Beginner workshop on reconnaissance and responsible disclosure.',      NULL, 'draft');

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
