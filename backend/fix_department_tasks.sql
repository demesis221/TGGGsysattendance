-- Fix department_tasks table to add start_date and change deadline to DATE type

-- Add start_date column if it doesn't exist
ALTER TABLE department_tasks ADD COLUMN IF NOT EXISTS start_date DATE;

-- Change deadline from timestamp to date
ALTER TABLE department_tasks ALTER COLUMN deadline TYPE DATE;
