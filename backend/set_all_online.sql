-- Set all existing attendance entries to 'online'
-- Run this in Supabase SQL Editor after adding the work_mode column

UPDATE attendance 
SET work_mode = 'online' 
WHERE work_mode IS NULL OR work_mode = 'onsite';

-- Verify the update
SELECT work_mode, COUNT(*) as count 
FROM attendance 
GROUP BY work_mode;
