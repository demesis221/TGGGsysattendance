-- Add attachments column to attendance table for work documentation files
-- Run this in Supabase SQL Editor

ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS attachments TEXT[];

COMMENT ON COLUMN attendance.attachments IS 'Array of file URLs for work documentation attachments (PDF, Word, Excel, etc.)';
