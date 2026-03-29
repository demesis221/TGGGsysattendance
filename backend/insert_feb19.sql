-- Insert attendance records for February 19, 2026 - Research Congress Presentation

-- February 19, 2026 - Morning Sessions
INSERT INTO attendance (user_id, date, time_in, time_out, status, late_minutes, total_minutes_worked, work_documentation)
VALUES
-- Ernestojr Beltran - Morning
('0fe54d52-17e0-4318-92ae-545724371afc', '2026-02-19', '07:45:00', '12:00:00', 'On-Time', 0, 240, 'Presentor for Research Congress'),
-- Kimberly Faith Ytac - Morning
('fe3ce8fe-c420-41e2-b834-2fb5a3b92562', '2026-02-19', '07:50:00', '12:00:00', 'On-Time', 0, 240, 'Presentor for Research Congress');

-- February 19, 2026 - Afternoon Sessions
INSERT INTO attendance (user_id, date, time_in, time_out, status, late_minutes, total_minutes_worked, work_documentation)
VALUES
-- Ernestojr Beltran - Afternoon
('0fe54d52-17e0-4318-92ae-545724371afc', '2026-02-19', '13:00:00', '17:00:00', 'On-Time', 0, 240, 'Presentor for Research Congress'),
-- Kimberly Faith Ytac - Afternoon
('fe3ce8fe-c420-41e2-b834-2fb5a3b92562', '2026-02-19', '13:00:00', '17:00:00', 'On-Time', 0, 240, 'Presentor for Research Congress');
