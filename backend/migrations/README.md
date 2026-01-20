# Password Reset Setup

## Database Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Create password_reset_codes table
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_code ON password_reset_codes(code);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires_at ON password_reset_codes(expires_at);

-- Enable RLS
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Service role can manage password reset codes" ON password_reset_codes
  FOR ALL USING (auth.role() = 'service_role');
```

## How It Works

1. User enters email → Receives 6-digit code via email
2. User enters code → System verifies it
3. User sets new password → Password is updated

Code expires in 10 minutes and can only be used once.
