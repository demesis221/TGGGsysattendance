-- Profile signature bucket setup and policies
-- Run this in Supabase SQL Editor

-- Create public bucket for profile signatures (if it does not exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profilesignature',
  'profilesignature',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Remove old policies if they already exist
DROP POLICY IF EXISTS "profilesignature_select_public" ON storage.objects;
DROP POLICY IF EXISTS "profilesignature_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "profilesignature_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "profilesignature_delete_own_folder" ON storage.objects;

-- Public can read signatures (needed for printing and display)
CREATE POLICY "profilesignature_select_public" ON storage.objects
FOR SELECT USING (
  bucket_id = 'profilesignature'
);

-- Authenticated users can only upload inside their own folder: {auth.uid()}/...
CREATE POLICY "profilesignature_insert_own_folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profilesignature'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can only update files in their own folder
CREATE POLICY "profilesignature_update_own_folder" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profilesignature'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profilesignature'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can only delete files in their own folder
CREATE POLICY "profilesignature_delete_own_folder" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profilesignature'
  AND (storage.foldername(name))[1] = auth.uid()::text
);