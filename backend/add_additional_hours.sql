-- Add additional_hours column to profiles table
ALTER TABLE profiles ADD COLUMN additional_hours INTEGER DEFAULT 0;

-- Update specific students with 16 additional hours
UPDATE profiles 
SET additional_hours = 960  -- 16 hours * 60 minutes
WHERE full_name IN (
  'Kimberly Faith Ytac',
  'John Anthony Buena',
  'Villamora Archie',
  'Ernestojr Beltran',
  'Mhar Jhane William',
  'RoelJames Dela Pena'
);
