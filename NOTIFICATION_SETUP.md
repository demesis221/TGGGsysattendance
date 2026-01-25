# Todo Notification System Setup Guide

## Issue
You're not seeing notifications because the `notifications` table hasn't been created in your Supabase database yet.

## Solution: Create the Notifications Table

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Run the Notifications Table SQL
Copy and paste the following SQL into the editor and click **Run**:

```sql
-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- IMPORTANT: Allow service role to insert notifications
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
```

### Step 3: Verify Table Creation
1. Go to **Table Editor** in Supabase
2. You should see a new table called `notifications`
3. Check that it has the following columns:
   - id (UUID)
   - user_id (UUID)
   - type (TEXT)
   - title (TEXT)
   - message (TEXT)
   - link (TEXT)
   - is_read (BOOLEAN)
   - created_at (TIMESTAMP)

## Test the Notification System

### Test 1: Assign a Task
1. Login as a **coordinator** or **leader**
2. Go to **Todo List** → **Team** tab → **Manage** subtab
3. Assign a task to an intern
4. Login as that intern
5. You should see a notification bell with a badge count
6. Click the bell to see: "New Task Assigned"

### Test 2: Mark Task as Complete
1. Login as an **intern** with an assigned task
2. Go to **Todo List** → **Team** tab
3. Check the checkbox to mark a task as complete
4. Login as the **leader** who assigned the task
5. You should see a notification: "Task Completion Pending"

### Test 3: Approve Task Completion
1. Login as a **leader**
2. Go to **Todo List** → **Team** tab → **Manage** subtab
3. Click "Approve" on a pending completion
4. Login as the **intern**
5. You should see a notification: "Task Approved"

### Test 4: Reject Task Completion
1. Login as a **leader**
2. Go to **Todo List** → **Team** tab → **Manage** subtab
3. Click "Reject" on a pending completion
4. Login as the **intern**
5. You should see a notification: "Task Rejected"

### Test 5: Confirm Group Task
1. Login as a **team member** (not leader)
2. Go to **Todo List** → **Team** tab → **Tasks** subtab
3. Suggest a task
4. Login as the **leader**
5. Go to **Team** tab → **Manage** subtab
6. Click "Confirm" on the suggested task
7. Login as the team member who suggested it
8. You should see a notification: "Task Confirmed"

## Notification Types Implemented

| Type | Title | When Triggered | Who Gets Notified |
|------|-------|----------------|-------------------|
| `task_assigned` | New Task Assigned | Leader assigns task to member | Assignee |
| `task_pending_completion` | Task Completion Pending | Member marks task as complete | Leader/Assigner |
| `group_task_confirmed` | Task Confirmed | Leader confirms suggested task | Task suggester |
| `task_completion_confirmed` | Task Approved | Leader approves completion | Task assignee |
| `task_completion_rejected` | Task Rejected | Leader rejects completion | Task assignee |

## Troubleshooting

### No notifications appearing?
1. **Check if table exists**: Go to Supabase → Table Editor → Look for `notifications` table
2. **Check RLS policies**: Go to Supabase → Authentication → Policies → Verify policies exist for `notifications` table
3. **Check browser console**: Open DevTools (F12) → Console → Look for errors
4. **Check network tab**: DevTools → Network → Filter by "notifications" → Verify API calls are successful

### Notifications not updating in real-time?
- The notification bell auto-refreshes every 30 seconds
- You can also manually refresh by clicking the bell icon

### Can't see notification badge count?
- Make sure you're logged in
- Check that the notification bell icon is visible in the header
- Verify that unread notifications exist in the database

## Database Query to Check Notifications

Run this in Supabase SQL Editor to see all notifications:

```sql
SELECT 
  n.*,
  p.full_name as user_name
FROM notifications n
LEFT JOIN profiles p ON n.user_id = p.id
ORDER BY n.created_at DESC
LIMIT 20;
```

## Manual Test: Insert a Notification

To manually test, run this in Supabase SQL Editor (replace `YOUR_USER_ID` with actual UUID):

```sql
INSERT INTO notifications (user_id, type, title, message, link)
VALUES (
  'YOUR_USER_ID',
  'task_assigned',
  'Test Notification',
  'This is a test notification',
  'todos'
);
```

Then refresh your app and check the notification bell.

## Success Indicators

✅ Notification bell shows badge count when unread notifications exist  
✅ Clicking bell opens dropdown with notification list  
✅ Clicking notification navigates to correct page  
✅ Marking notification as read removes it from unread count  
✅ New notifications appear within 30 seconds  

## Need Help?

If notifications still don't work after following these steps:
1. Check backend logs for errors
2. Verify Supabase service role key is correct in `.env`
3. Ensure backend server is running
4. Check that frontend API URL is correct
