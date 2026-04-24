# Triple G BuildHub – Attendance System Guide

> A professional attendance management system designed for CTU students completing their On-the-Job Training (OJT) at Triple G BuildHub.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Attendance Rules & Policies](#attendance-rules--policies)
4. [Daily Operations](#daily-operations)
5. [Check-In Process](#check-in-process)
6. [Check-Out Process](#check-out-process)
7. [Overtime Management](#overtime-management)
8. [Late Deductions Policy](#late-deductions-policy)
9. [Work Documentation](#work-documentation)
10. [Notifications System](#notifications-system)
11. [Policies & Guidelines](#policies--guidelines)

---

## System Overview

The Triple G BuildHub Attendance System is a comprehensive OJT attendance tracking solution that provides:

- **Real-time Attendance Tracking**: Monitor check-ins and check-outs with timestamps
- **Photo Verification**: Capture photo documentation for every attendance record
- **Work Documentation**: Record daily accomplishments with optional file attachments
- **Overtime Management**: Track and approve overtime sessions
- **Automated Notifications**: Keep users informed about their attendance status
- **Role-Based Dashboards**: Separate interfaces for interns and coordinators
- **Transparent Reporting**: Comprehensive attendance records and performance metrics

### System Architecture

- **Backend**: Node.js and Express server running on port 5000
- **Frontend**: React-based web application running on port 3000
- **Database**: Supabase (PostgreSQL with RLS security)
- **Authentication**: Supabase Auth with Email/Password
- **Storage**: Supabase Storage for photos and document uploads

---

## User Roles & Permissions

### 1. Intern Role
**Responsibilities:**
- Record daily attendance (check-in and check-out)
- Provide work documentation
- Submit overtime requests
- View personal attendance records and statistics
- Manage personal to-do tasks and team tasks

**Permissions:**
- View own attendance records
- Insert and update own attendance
- View own profile

### 2. Coordinator Role
**Responsibilities:**
- Monitor all interns' attendance
- Review photo verifications
- Verify and manage overtime requests
- Access comprehensive attendance reports
- Manage system-wide tasks

**Permissions:**
- View all users' profiles
- View all attendance records
- Monitor real-time check-ins and check-outs
- Access attendance analytics

---

## Attendance Rules & Policies

### Session Schedule

The system divides the workday into three distinct sessions:

| Session | Time Window | Check-In Time | Check-Out Time | Maximum Hours |
|---------|-------------|---------------|----------------|---------------|
| **Morning** | 5:00 AM - 12:00 PM | 5:00 AM - 12:00 PM | 12:00 PM onwards | 4 hours |
| **Afternoon** | 12:40 PM - 5:00 PM | 12:40 PM - 5:00 PM | 5:00 PM onwards | 4 hours |
| **Overtime** | 6:50 PM - 10:00 PM | 6:50 PM - 10:00 PM | 10:00 PM onwards | 3 hours |

### Check-In Availability

**Morning Session:**
- Available: 5:00 AM - 12:00 PM
- Baseline: 8:00 AM (official start time)
- Late threshold: 8:05 AM

**Afternoon Session:**
- Available: 12:40 PM - 5:00 PM
- Baseline: 1:00 PM (official start time)
- Cannot check in if morning session is still open
- Late threshold: 1:05 PM

**Overtime Session:**
- Available: 6:50 PM - 10:00 PM
- Only available if an approved overtime request exists
- Baseline: 7:00 PM (official start time)
- Late threshold: 7:05 PM

### Hours Calculation Policy

**Important:** Hours are calculated based on **baseline times**, NOT actual check-in times.

**How It Works:**
- **Morning Session**: Calculated from 8:00 AM to 12:00 PM (4 hour maximum)
- **Afternoon Session**: Calculated from 1:00 PM to 5:00 PM (4 hour maximum)
- **Overtime Session**: Calculated from 7:00 PM to 10:00 PM (3 hour maximum)

**Examples:**
- Check in at 5:00 AM, checkout at 6:00 AM = **0 hours** (before 8 AM baseline)
- Check in at 5:00 AM, checkout at 10:00 AM = **2 hours** (8 AM to 10 AM)
- Check in at 8:30 AM, checkout at 12:00 PM = **4 hours** (8 AM to 12 PM)
- Check in at 1:00 PM, checkout at 3:00 PM = **2 hours** (1 PM to 3 PM)

### Flexible Checkout Policy

Interns can now check out **anytime after checking in** for morning and afternoon sessions, providing flexibility for real-world work scenarios.

**Exception:** Overtime sessions require waiting until 10:00 PM to ensure accurate overtime tracking.

---

## Daily Operations

### Maximum Check-Ins Per Day

- Interns can perform a **maximum of 2 check-ins per day**
  - First session: Morning (5:00 AM - 12:00 PM) OR Overtime
  - Second session: Afternoon (12:40 PM - 5:00 PM) OR Overtime
  - Or: Morning and Afternoon on the same day
  - Or: Two overtime sessions (rare, requires special approval)

### Session Session Constraints

1. **Cannot have two sessions open simultaneously**
   - Must complete (check out) the first session before checking in to the second session
   - If attempting to check in with an open session, system will reject with error message

2. **Afternoon Cannot Start if Morning Open**
   - Morning session must be closed (time out recorded) before checking in for afternoon
   - This ensures accurate session tracking

3. **Overtime Approval Required**
   - Overtime availability is only enabled if an approved overtime request exists for that date
   - Without approval, the check-in window for overtime is not available

---

## Check-In Process

### Step-by-Step Check-In Flow

#### 1. **Initiate Check-In**
   - Click the "Time In" button on the dashboard
   - Select/capture a photo (required for verification)

#### 2. **Photo Verification**
   - Photo is mandatory for every check-in
   - Must be a valid image format (JPG, PNG, WebP)
   - Photo is automatically uploaded to secure cloud storage
   - Photo timestamp is recorded for verification purposes

#### 3. **System Validations**
Before accepting the check-in, the system checks:

   - **Session Status**: Is there an existing open session? (Cannot check in twice)
   - **Time Window**: Is the current time within the allowed check-in window?
   - **Daily Limit**: Have you already completed 2 check-ins today?
   - **Session Lock**: Is the previous session properly closed?

#### 4. **Automatic Time Recording**
   - System records the exact check-in time in Philippines Standard Time (PST/UTC+8)
   - Time is formatted as HH:MM AM/PM (e.g., "08:15 AM")
   - Timestamp is automatically captured from server

#### 5. **Status Determination**
   - **On-Time**: Check-in before the baseline + 5 minutes
     - Morning: Before 8:05 AM
     - Afternoon: Before 1:05 PM
     - Overtime: Before 7:05 PM
   
   - **Late**: Check-in after baseline + 5 minutes
     - Morning: 8:05 AM or later
     - Afternoon: 1:05 PM or later
     - Overtime: 7:05 PM or later

#### 6. **Late Deduction Calculation** (if applicable)
   For late check-ins, deductions are applied based on how late you are:

   **Morning Session (8:05 AM onwards):**
   - 8:05 AM - 8:59 AM: **1 hour** deduction
   - 9:00 AM or later: **2 hours** deduction

   **Afternoon Session (1:05 PM onwards):**
   - Any time after 1:05 PM: **1 hour** deduction

   **Overtime Session (7:05 PM onwards):**
   - Any time after 7:05 PM: **1 hour** deduction

#### 7. **Confirmation**
   - User receives alert confirming check-in status
   - If late: Shows minutes late and hours deducted
   - Attendance record is immediately visible in the table

---

## Check-Out Process

### Step-by-Step Check-Out Flow

#### 1. **Initiate Check-Out**
   - Click the "Time Out" button next to the corresponding check-in record
   - A text input field appears for work documentation

#### 2. **Work Documentation (Required)**
   - Enter a description of tasks completed during this session
   - Examples: "Built UI components", "Fixed database queries", "Tested new features"
   - Minimum: Brief description of work performed
   - Maximum: No character limit, but recommended to keep concise

#### 3. **Optional File Attachments**
   - Upload supporting documents (screenshots, reports, etc.)
   - Allowed file types:
     - Images: PNG, JPG, JPEG
     - Documents: PDF, Word (.doc, .docx)
     - Spreadsheets: Excel (.xls, .xlsx)
   - File size limit: 5 MB per file
   - Multiple files can be attached to single check-out

#### 4. **System Processing**
Once you submit, the system:

   - Records the exact check-out time in Philippines Standard Time
   - Calculates session hours based on baseline times
   - Validates work documentation is present
   - Uploads all attached files securely
   - Creates a complete attendance record

#### 5. **Hours Credit**
Hours are calculated based on your session:

   **Morning Checkout:**
   - Hours = 4 hours (fixed, unless checked out before baseline)
   - If checked out before 8:00 AM: Hours proportionally reduced

   **Afternoon Checkout:**
   - Hours = 4 hours (fixed, unless checked out before baseline)
   - If checked out before 1:00 PM: Hours proportionally reduced

   **Overtime Checkout:**
   - Hours calculated from 7:00 PM to checkout time (max 3 hours)
   - If checked out after 10:00 PM: Capped at 3 hours

#### 6. **Confirmation**
   - User receives success notification
   - Attendance record updates with time out and work documentation
   - Work documentation becomes visible in coordinator dashboard

---

## Overtime Management

### Overtime Request Workflow

#### 1. **Submitting an Overtime Request**
   - Interns access the "Overtime" page from the dashboard menu
   - Click "Request Overtime" button
   - Provide required information:
     - Date of overtime
     - Reason for overtime
     - Expected duration (usually 7:00 PM - 10:00 PM)

#### 2. **Request Status States**

   | Status | Meaning | Action Required |
   |--------|---------|-----------------|
   | **Pending** | Awaiting coordinator review | Wait for approval |
   | **Approved** | Coordinator approved the request | Proceed with overtime check-in |
   | **Rejected** | Coordinator declined the request | Contact supervisor if needed |

#### 3. **Checking In for Overtime**
   - Overtime check-in is only available if request is "Approved"
   - Time window: 6:50 PM - 10:00 PM
   - Must complete morning or afternoon session first
   - Same photo verification required as regular sessions

#### 4. **Overtime Hours Credit**
   - Overtime sessions are credited as **3 hours** maximum
   - Calculated from 7:00 PM baseline to checkout time
   - If checked out before 7:00 PM: Hours adjusted proportionally
   - If checked out after 10:00 PM: Capped at 3 hours

#### 5. **Coordinator Approval Process**
   Coordinators can:
   - View all pending overtime requests
   - Review request details and justification
   - Approve or reject requests
   - Add comments for rejected requests
   - Track approved overtime hours

---

## Late Deductions Policy

### Late Deduction Rules

Late deductions are applied when you check in after the baseline + 5 minutes threshold for your session.

### Morning Session Late Deductions

| Check-In Time | Status | Deduction |
|---------------|--------|-----------|
| Before 8:05 AM | On-Time | 0 hours |
| 8:05 AM - 8:59 AM | Late | 1 hour |
| 9:00 AM or later | Late | 2 hours |

**Example:**
- Check in at 8:30 AM = 1 hour deduction
- Check in at 9:15 AM = 2 hours deduction

### Afternoon Session Late Deductions

| Check-In Time | Status | Deduction |
|---------------|--------|-----------|
| Before 1:05 PM | On-Time | 0 hours |
| 1:05 PM or later | Late | 1 hour |

### Overtime Session Late Deductions

| Check-In Time | Status | Deduction |
|---------------|--------|-----------|
| Before 7:05 PM | On-Time | 0 hours |
| 7:05 PM or later | Late | 1 hour |

### How Deductions Are Applied

Late deductions are subtracted from the hours credited for that session:

**Example Scenario:**
- Morning check-in at 9:30 AM: Qualifies as 2-hour deduction
- Morning checkout at 12:00 PM: Earns 4 hours
- Net result: 4 - 2 = **2 hours credited**

**Another Example:**
- Afternoon check-in at 1:30 PM: Qualifies as 1-hour deduction
- Afternoon checkout at 5:00 PM: Earns 4 hours
- Net result: 4 - 1 = **3 hours credited**

### Multiple Late Check-Ins in One Day

If you check in late for both morning and afternoon:

- Each session's deduction is calculated independently
- Both deductions are applied to the respective session hours
- Total daily hours = (Morning hours - Morning deduction) + (Afternoon hours - Afternoon deduction)

---

## Work Documentation

### Why Work Documentation Matters

Work documentation serves as:
- **Accountability**: Proof of work completed during the session
- **Verification**: Coordinators can verify work alignment with OJT objectives
- **Portfolio**: Creates a record of accomplishments for your professional development
- **Feedback**: Enables supervisors to provide targeted guidance

### Required vs. Optional

| Element | Required | Notes |
|---------|----------|-------|
| **Text Description** | ✅ Yes | Must describe tasks completed |
| **File Attachments** | ❌ No | Optional but highly recommended |
| **Photos/Screenshots** | ❌ No | Optional but helps document work |

### What to Include in Documentation

**Effective work documentation includes:**

1. **Task Summary**: What did you work on?
   - "Build employee verification queue component"
   - "Fixed bug in attendance calculation logic"
   - "Created database migration for new feature"

2. **Key Activities**: What specific actions did you take?
   - "Implemented form validation"
   - "Debugged ORM queries"
   - "Conducted code review with senior developer"

3. **Challenges & Solutions** (optional): What obstacles did you overcome?
   - "Resolved timezone issues with database timestamps"
   - "Optimized React component rendering performance"

4. **Files/Evidence** (optional): Attach supporting documentation
   - Screenshots of completed UI
   - Code snippets
   - Documentation files
   - Test reports

### File Attachment Guidelines

**Supported File Types:**
- Images: `.png`, `.jpg`, `.jpeg`
- Documents: `.pdf`, `.doc`, `.docx`
- Spreadsheets: `.xls`, `.xlsx`

**Limitations:**
- Maximum 5 MB per file
- Multiple files can be attached to a single check-out
- Files are secured in cloud storage with access controls

### Documentation Examples

**✅ Good Documentation:**
```
"Completed responsive design for intern dashboard. 
Implemented mobile-first approach using Tailwind CSS. 
Fixed alignment issues on tablet view. 
Tested on Chrome, Firefox, and Safari."
```

**✅ Detailed Documentation:**
```
"Morning: Built TodoList component with filter functionality
- Added filter by status (All, Active, Completed)
- Implemented sorting by date
- Added animation for smooth transitions

Afternoon: Code review and bug fixes
- Reviewed PR from team member #45
- Fixed date formatting in Reports page
- Updated documentation for API endpoints"
```

**❌ Insufficient Documentation:**
```
"Worked on the system" (too vague)
"Did stuff" (lacks detail)
```

---

## Notifications System

### Notification Types

The system automatically generates notifications for important attendance events:

#### 1. **Check-In Notifications**
   - **Trigger**: When you successfully check in
   - **Content**: Session, time, and status (On-Time/Late)
   - **Recipient**: Personal notification

#### 2. **Check-Out Notifications**
   - **Trigger**: When work documentation is submitted
   - **Content**: Session completion, hours credited, deductions (if any)
   - **Recipient**: Personal notification + Coordinator review

#### 3. **Late Arrival Alerts**
   - **Trigger**: When you check in after the allowable time
   - **Content**: Minutes late, hours deducted
   - **Recipient**: Your notification panel + Coordinator dashboard

#### 4. **Overtime Approval Notifications**
   - **Trigger**: When coordinator approves/rejects overtime request
   - **Content**: Approval status, approval date
   - **Recipient**: Your notification panel

#### 5. **Task Assignment Notifications**
   - **Trigger**: When assigned a task
   - **Content**: Task title, assigner name
   - **Recipient**: Your notification panel

### Notification Panel Features

- **Real-Time Updates**: Receive notifications as events occur
- **Notification Bell**: Shows unread notification count
- **Mark as Read**: Click notification to mark as read
- **Notification History**: View all past notifications
- **Smart Navigation**: Clicking a notification takes you to relevant page

### Staying Informed

**Tips for staying updated:**
1. Check your notification panel regularly
2. Review your daily attendance summary after checkout
3. Monitor overtime request status regularly
4. Enable browser notifications (optional) for immediate alerts

---

## Policies & Guidelines

### Attendance Policy

#### Mandatory Attendance
- Attendance is required as per OJT program guidelines
- All absences must be documented
- Tardiness results in automatic hour deductions (per late deduction policy)

#### Session Attendance
- Target: Complete both morning and afternoon sessions daily
- Minimum: At least one complete session per day
- Flexibility: Interns can choose morning OR afternoon based on work needs

#### Making Up Hours
- If hours are deducted due to tardiness, communicate with your coordinator
- Overtime sessions can help make up missing hours (with approval)

### Photo Verification Policy

#### Photo Requirements
- Must be clear and face-visible
- Must be taken at the time of check-in (not selfies from elsewhere)
- Coordinators review photos for authenticity

#### Photo Usage
- Photos are stored securely in cloud storage
- Only accessible to coordinators for verification
- Retained for audit purposes
- Deleted after program completion (per data retention policy)

### Work Documentation Standards

#### Quality Expectations
- Professional tone and appropriate language
- Specific and measurable accomplishments
- Clear reference to OJT learning objectives
- Honest and accurate representation of work

#### Documentation Review
- Coordinators may request clarification on documentation
- Repeated vague documentation may result in follow-up conversations
- Documentation is part of your OJT evaluation

### Conduct Policies

#### On-Time Commitment
- Arrive before or at baseline times (8:00 AM for morning, 1:00 PM for afternoon)
- Consistent tardiness may result in:
  - Conversation with coordinator
  - Additional hour deductions
  - Program review if pattern continues

#### Honesty in Reporting
- Never falsify work documentation
- Never claim hours not worked
- Never ask others to check in/out for you
- System logs are audited by coordinators

#### Session Completion
- Always perform proper check-out with documentation
- Do not leave without checking out
- Emergency early departure: Inform coordinator and still submit documentation

### Overtime Policy

#### Overtime Eligibility
- Only available with prior coordinator approval
- Typically scheduled for specific projects or deadlines
- Not guaranteed; approved based on business needs

#### Overtime Compensation
- Overtime hours are credited as training hours (part of OJT program)
- Follow same late deduction rules as regular sessions
- Overtime hours contribute toward total OJT hour requirements

#### Overtime Work Standards
- Must be substantial and work-related
- Same documentation standards apply
- Coordinators verify necessity and completion

### Dispute Resolution

**If you have concerns about:**

1. **Attendance Records**: 
   - Contact your coordinator immediately
   - Provide evidence (screenshots, photos)
   - Request record correction if error is found

2. **Hours Deduction**: 
   - Discuss with coordinator
   - Provide context (system delays, etc.)
   - Request adjustment if justified

3. **Overtime Rejection**: 
   - Request feedback from coordinator
   - Understand reasoning
   - Plan for future requests

---

## Common Scenarios

### Scenario 1: Early Morning Check-In
**Situation**: You arrive at 5:30 AM and check in
- **Status**: On-Time (before 8:05 AM threshold)
- **Hours**: When you check out, hours calculated from 8:00 AM baseline
- **Deduction**: 0 hours

### Scenario 2: Late Morning Arrival
**Situation**: You check in at 8:45 AM
- **Status**: Late (after 8:05 AM, before 9:00 AM)
- **Deduction**: 1 hour
- **Hours**: 4 hours (morning baseline) - 1 hour (late) = **3 hours credited**

### Scenario 3: Very Late Morning Arrival
**Situation**: You check in at 9:30 AM
- **Status**: Late (after 9:00 AM threshold)
- **Deduction**: 2 hours
- **Hours**: 4 hours (morning baseline) - 2 hours (late) = **2 hours credited**

### Scenario 4: Half-Day (Morning Only)
**Situation**: Afternoon meeting, only work morning session
- **Check-In**: 7:00 AM (On-Time)
- **Check-Out**: 12:00 PM with documentation
- **Hours**: 4 hours
- **Total Daily**: 4 hours

### Scenario 5: Half-Day (Afternoon Only)
**Situation**: Morning appointment, only work afternoon session
- **Check-In**: 2:00 PM (On-Time)
- **Check-Out**: 5:00 PM with documentation
- **Hours**: 4 hours
- **Total Daily**: 4 hours

### Scenario 6: Full Day Plus Overtime
**Situation**: Complete both morning and afternoon, then do overtime
- **Morning**: 8:00 AM - 12:00 PM = 4 hours
- **Afternoon**: 1:00 PM - 5:00 PM = 4 hours
- **Overtime**: 7:00 PM - 9:00 PM = 2 hours (capped at 3)
- **Total Daily**: 4 + 4 + 2 = **10 hours**

### Scenario 7: Multiple Sessions in One Day
**Situation**: Morning session cut short, make up with afternoon + overtime
- **Morning**: 8:00 AM - 10:00 AM = 2 hours
- **Afternoon**: 1:00 PM - 5:00 PM = 4 hours
- **Overtime**: 7:00 PM - 10:00 PM = 3 hours
- **Total Daily**: 2 + 4 + 3 = **9 hours**

---

## Key Takeaways

✅ **Do:**
- Arrive on time (before baseline + 5 minutes)
- Check in with a valid photo every time
- Check out with thorough work documentation
- Request overtime in advance
- Communicate any issues to your coordinator
- Review your attendance records regularly

❌ **Don't:**
- Skip check-in or check-out process
- Submit fake photos
- Provide vague work documentation
- Check in late repeatedly without addressing it
- Leave without proper checkout
- Ask others to check in/out for you

---

## Contact & Support

**Questions about the attendance system?**
- Contact your Head Coordinator at `coordinator@tripleg.com`
- Available during business hours
- Response time: Within 24 hours

**Report Technical Issues:**
- System not accepting check-in: Document error and timestamp
- Photo not uploading: Check file size and format
- Time discrepancies: Note exact time and timezone issues

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 22, 2026 | Initial policy documentation |
| 1.1 | Mar 9, 2026 | Added flexible checkout policy, detailed scenarios |

---

**Last Updated**: March 9, 2026
**System Version**: 1.1
**For OJT Program**: Triple G BuildHub - CTU 4th Year Students
