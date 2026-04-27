-- Add signature_url column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS signature_url TEXT;