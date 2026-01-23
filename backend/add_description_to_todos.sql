-- Add description column to todos table
-- Run this in Supabase SQL editor

  ALTER TABLE todos
    ADD COLUMN IF NOT EXISTS description TEXT;

  -- Add index for better query performance if needed
  CREATE INDEX IF NOT EXISTS idx_todos_description ON todos(description) WHERE description IS NOT NULL;
