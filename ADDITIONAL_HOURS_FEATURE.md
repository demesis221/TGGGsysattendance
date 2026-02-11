# Additional Hours Feature Implementation

## Overview
Added support for tracking additional hours (16 hours from 1st week before system implementation) for specific students.

## Database Changes

### 1. Run SQL Migration in Supabase
Execute the SQL file: `backend/add_additional_hours.sql`

```sql
-- Add additional_hours column to profiles table
ALTER TABLE profiles ADD COLUMN additional_hours INTEGER DEFAULT 0;

-- Update specific students with 16 additional hours (960 minutes)
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
```

## Frontend Changes

### Reports.js
- Modified `calculateStats()` function to include additional hours in total calculation
- Added visual indicator showing "+16h" next to Total Hours for students with additional hours
- The additional hours are displayed in green color to differentiate from regular hours

## How It Works

1. **Database**: Stores additional hours as minutes in `profiles.additional_hours` column
2. **Calculation**: Adds additional hours to the total worked hours after deducting late minutes
3. **Display**: Shows "+16h" indicator in green next to the total hours on report cards

## Students with Additional Hours
- Kimberly Faith Ytac
- John Anthony Buena
- Villamora Archie
- Ernestojr Beltran
- Mhar Jhane William
- RoelJames Dela Pena

## Example Display
```
Total Hours: 24h 30m +16h
```

This indicates the student has 24 hours 30 minutes tracked in the system, plus 16 additional hours from the first week.
