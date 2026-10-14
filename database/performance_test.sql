-- =====================================================================
-- performance_test.sql  -  Index before/after test (Debugging & Performance)
--
-- What it tests: the query behind GET /events. For every event it finds
-- the next upcoming date and the lowest price from the schedules table:
--     WHERE s.event_id = ? AND s.start_time >= NOW() AND s.status <> 'closed'
-- MySQL already has an index on schedules.event_id (created for the
-- foreign key), but it still has to read every schedule of the event and
-- check start_time, status and ticket_price row by row. A covering index on
-- (event_id, start_time, status, ticket_price) lets MySQL jump straight to the
-- upcoming schedules of each event and answer from the index alone.
--
-- HOW TO RUN (MySQL Workbench): first run schema.sql and seed.sql so you
-- start from the clean shared data, then run this file one step at a time:
--   Step 1 removes the index and adds 2,000 test events and 200,000 schedules.
--   Step 2 measures the query BEFORE the index.
--   Step 3 adds the index.
--   Step 4 measures the same query AFTER the index.
--   Step 5 cleans up by re-running schema.sql and seed.sql.
-- Screenshot the EXPLAIN ANALYZE results of steps 2 and 4.
-- =====================================================================
USE event_booking_db;

-- ---------------------------------------------------------------------
-- STEP 1: remove the index (schema.sql creates it) so we can measure
-- without it, then load test data (takes a few seconds)
-- ---------------------------------------------------------------------
DROP INDEX idx_schedules_event_start ON schedules;
SET SESSION cte_max_recursion_depth = 10000;

-- 2,000 published test events, shared between organisers 2 and 3
INSERT INTO events (organiser_id, category_id, title, description, status)
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 2000)
SELECT 2 + (i % 2), 1 + (i % 6), CONCAT('Load test event ', i),
       'Generated for the performance test', 'published'
  FROM n;

-- 100 schedules per test event = 200,000 schedules,
-- half in the past and half in the future
INSERT INTO schedules (event_id, venue_id, start_time, end_time, ticket_price,
                       total_tickets, available_tickets, status)
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 100)
SELECT e.id,
       1 + (n.i % 6),
       TIMESTAMPADD(DAY, n.i - 50, '2026-10-12 20:00:00'),
       TIMESTAMPADD(HOUR, 2, TIMESTAMPADD(DAY, n.i - 50, '2026-10-12 20:00:00')),
       10 + (n.i % 50),
       100, 100, 'open'
  FROM events e
  CROSS JOIN n
 WHERE e.title LIKE 'Load test event %';

ANALYZE TABLE schedules;
SELECT COUNT(*) AS total_schedules FROM schedules;

-- ---------------------------------------------------------------------
-- STEP 2: BEFORE the index - same query as GET /events (first page of 10)
-- Note the "actual time" on the top line of the result.
-- ---------------------------------------------------------------------
EXPLAIN ANALYZE
SELECT e.id, e.title,
       (SELECT MIN(s.start_time) FROM schedules s
         WHERE s.event_id = e.id AND s.start_time >= NOW() AND s.status <> 'closed') AS next_start_time,
       (SELECT MIN(s.ticket_price) FROM schedules s
         WHERE s.event_id = e.id AND s.start_time >= NOW() AND s.status <> 'closed') AS min_price
  FROM events e
  JOIN event_categories c ON c.id = e.category_id
  JOIN users u ON u.id = e.organiser_id
 WHERE e.status = 'published'
 ORDER BY next_start_time IS NULL, next_start_time
 LIMIT 10;

-- ---------------------------------------------------------------------
-- STEP 3: add the index
-- ---------------------------------------------------------------------
CREATE INDEX idx_schedules_event_start ON schedules (event_id, start_time, status, ticket_price);
ANALYZE TABLE schedules;

-- ---------------------------------------------------------------------
-- STEP 4: AFTER the index - run exactly the same query again
-- ---------------------------------------------------------------------
EXPLAIN ANALYZE
SELECT e.id, e.title,
       (SELECT MIN(s.start_time) FROM schedules s
         WHERE s.event_id = e.id AND s.start_time >= NOW() AND s.status <> 'closed') AS next_start_time,
       (SELECT MIN(s.ticket_price) FROM schedules s
         WHERE s.event_id = e.id AND s.start_time >= NOW() AND s.status <> 'closed') AS min_price
  FROM events e
  JOIN event_categories c ON c.id = e.category_id
  JOIN users u ON u.id = e.organiser_id
 WHERE e.status = 'published'
 ORDER BY next_start_time IS NULL, next_start_time
 LIMIT 10;

-- ---------------------------------------------------------------------
-- STEP 5: clean up - run schema.sql and then seed.sql again.
-- schema.sql already creates idx_schedules_event_start, so the clean
-- database keeps the optimisation.
-- ---------------------------------------------------------------------
