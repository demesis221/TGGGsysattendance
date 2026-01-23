# Department Tasks Feature - Implementation Guide

## Overview
The Department Tasks feature allows users in the same department to collaborate on tasks through a suggest-grab-complete workflow.

## Database Setup

### 1. Run the SQL Schema
Execute `backend/department_tasks.sql` in your Supabase SQL Editor to create:
- `department_tasks` table
- Row Level Security (RLS) policies
- Helper functions for task actions
- Indexes for performance

### 2. Ensure Profiles Have Department Field
Make sure your `profiles` table has a `department` column:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
```

Update user profiles with their departments:
```sql
UPDATE profiles SET department = 'Engineering' WHERE id = 'user-id';
UPDATE profiles SET department = 'Design' WHERE id = 'user-id';
-- etc.
```

## Features

### Task Workflow
1. **Suggest**: Any user can suggest a task for their department
2. **Grab**: Any department member can grab a suggested task (transfers ownership)
3. **Complete**: Only the user who grabbed the task can mark it complete
4. **Abandon**: User who grabbed can return task to suggested state

### Security
- Users only see tasks from their own department
- Department validation enforced at database level
- Only task suggester or coordinator can delete tasks
- All actions verified through RLS policies

### UI Layout
Three-column view:
- **Suggested**: Tasks waiting to be grabbed
- **In Progress**: Tasks currently being worked on
- **Completed**: Finished tasks (visible to all department members)

## API Endpoints

### GET /api/department-tasks
Fetch all tasks for user's department

### POST /api/department-tasks
Suggest a new task
```json
{
  "task": "Task description",
  "description": "Optional details",
  "deadline": "2024-12-31",
  "priority": "high"
}
```

### POST /api/department-tasks/:id/grab
Grab a suggested task (transfers ownership)

### POST /api/department-tasks/:id/complete
Mark grabbed task as complete

### POST /api/department-tasks/:id/abandon
Return grabbed task to suggested state

### DELETE /api/department-tasks/:id
Soft delete task (suggester or coordinator only)

## Frontend Components

### New Tab
- Added "Department" tab to TodoList navigation
- Icon: building
- Available to all users with a department

### Task Cards
- **Suggested**: Shows suggester name, Grab button, Delete button (if owner)
- **In Progress**: Shows grabber name, Complete/Abandon buttons (if owner)
- **Completed**: Shows completer name, read-only

### Task Form
Simple input for suggesting new tasks with deadline support

## Testing Checklist

- [ ] Run SQL schema in Supabase
- [ ] Assign departments to user profiles
- [ ] Restart backend server
- [ ] Test suggesting a task
- [ ] Test grabbing a task (same department)
- [ ] Test completing a grabbed task
- [ ] Test abandoning a grabbed task
- [ ] Verify cross-department isolation
- [ ] Test delete permissions

## Business Rules

1. **Same Department Only**: Users can only interact with tasks from their department
2. **Ownership Transfer**: Grabbing a task transfers ownership from suggester to grabber
3. **Completion Rights**: Only the current owner (grabber) can complete the task
4. **Abandon Resets**: Abandoning returns task to suggested state for others to grab
5. **Visibility**: All department members see all tasks (suggested, grabbed, completed)
6. **Delete Rights**: Only suggester or coordinator can delete tasks

## Database Functions

### grab_department_task(task_id, user_id)
- Validates same department
- Updates status to 'grabbed'
- Sets grabbed_by and grabbed_at
- Returns updated task

### complete_department_task(task_id, user_id)
- Validates same department
- Validates user is the grabber
- Updates status to 'completed'
- Sets completed_by and completed_at
- Returns updated task

### abandon_department_task(task_id, user_id)
- Validates same department
- Validates user is the grabber
- Resets to 'suggested' status
- Clears grabbed_by and grabbed_at
- Sets abandoned_at timestamp
- Returns updated task

## Future Enhancements

- Task priority indicators
- Task descriptions/details modal
- Task assignment notifications
- Department leaderboard
- Task time tracking
- Task comments/discussion
- File attachments
- Task categories/tags
