-- Add full_name columns to tables for easier visual tracking in Supabase
-- This script adds denormalized full_name columns and triggers to keep them in sync

-- 1. Add full_name column to attendance table
ALTER TABLE public.attendance 
ADD COLUMN full_name TEXT;

-- 2. Add full_name column to notifications table
ALTER TABLE public.notifications 
ADD COLUMN full_name TEXT;

-- 3. Add full_name column to todos table
ALTER TABLE public.todos 
ADD COLUMN full_name TEXT;

-- 4. Populate existing records with full_name from profiles table

-- Update attendance table
UPDATE public.attendance a
SET full_name = p.full_name
FROM public.profiles p
WHERE a.user_id = p.id;

-- Update notifications table
UPDATE public.notifications n
SET full_name = p.full_name
FROM public.profiles p
WHERE n.user_id = p.id;

-- Update todos table
UPDATE public.todos t
SET full_name = p.full_name
FROM public.profiles p
WHERE t.user_id = p.id;

-- 5. Create triggers to automatically populate full_name on INSERT/UPDATE

-- Trigger function for attendance
CREATE OR REPLACE FUNCTION update_attendance_full_name()
RETURNS TRIGGER AS $$
BEGIN
  SELECT full_name INTO NEW.full_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_full_name_trigger
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION update_attendance_full_name();

-- Trigger function for notifications
CREATE OR REPLACE FUNCTION update_notifications_full_name()
RETURNS TRIGGER AS $$
BEGIN
  SELECT full_name INTO NEW.full_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notifications_full_name_trigger
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_full_name();

-- Trigger function for todos
CREATE OR REPLACE FUNCTION update_todos_full_name()
RETURNS TRIGGER AS $$
BEGIN
  SELECT full_name INTO NEW.full_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER todos_full_name_trigger
BEFORE INSERT OR UPDATE ON public.todos
FOR EACH ROW
EXECUTE FUNCTION update_todos_full_name();

-- 6. Optional: Create indexes for better query performance
CREATE INDEX idx_attendance_full_name ON public.attendance(full_name);
CREATE INDEX idx_notifications_full_name ON public.notifications(full_name);
CREATE INDEX idx_todos_full_name ON public.todos(full_name);
