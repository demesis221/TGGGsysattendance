-- Update all attendance records from 2026-01-18 to 2026-01-19
UPDATE attendance 
SET date = '2026-01-19' 
WHERE date = '2026-01-18';

-- Verify the update
SELECT * FROM attendance WHERE date = '2026-01-19';
