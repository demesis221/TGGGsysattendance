-- Add INSERT policy for notifications (run this if table already exists)
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
