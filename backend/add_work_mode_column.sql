-- Add work_mode column to attendance table
-- Run this in Supabase SQL Editor

ALTER TABLE attendance 
ADD COLUMN work_mode TEXT CHECK(work_mode IN ('onsite', 'online')) DEFAULT 'onsite';

-- Add index for filtering by work_mode
CREATE INDEX idx_attendance_work_mode ON attendance(work_mode);

-- Add comment for documentation
COMMENT ON COLUMN attendance.work_mode IS 'Work mode: onsite or online';
