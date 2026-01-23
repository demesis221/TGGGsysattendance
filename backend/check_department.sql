-- Check if your profile has a department
SELECT id, full_name, department FROM profiles WHERE id = auth.uid();

-- If department is NULL, set it (replace 'Engineering' with your department name)
UPDATE profiles SET department = 'Engineering' WHERE id = auth.uid();

-- Or set department for all interns
UPDATE profiles SET department = 'Engineering' WHERE role = 'intern' AND department IS NULL;
