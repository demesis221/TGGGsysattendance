# Check-In and Check-Out Flow Documentation

## 📥 CHECK-IN FLOW

### Frontend (Dashboard.js)

#### 1. **User Clicks "Time In" Button**
```
User Action → checkIn() function triggered
```

#### 2. **Pre-Check Validations**
```javascript
// Check if already checked in
if (todaysOpen) → Error: "Already Checked In"

// Check if within allowed time windows
if (!canCheckInNow()) → Error: "Not available"
  - Morning: 5:00 AM - 12:00 PM
  - Afternoon: 12:40 PM - 5:00 PM
  - Overtime: 6:50 PM - 10:00 PM (only if approved OT exists)

// Check daily limit
if (todaysEntries.length >= 2) → Error: "Limit Reached"

// Check photo upload
if (!photo) → Error: "Photo Required"
```

#### 3. **Prepare Check-In Data**
```javascript
const timeIn = getPhilippinesTime(); // e.g., "08:15 AM"
const formData = new FormData();
formData.append('time_in', timeIn);
formData.append('photo', compressedPhoto);
```

#### 4. **Send to Backend**
```
POST /api/attendance/checkin
Headers: Authorization Bearer token
Body: FormData (time_in, photo)
```

---

### Backend (server.js)

#### 5. **Receive Check-In Request**
```javascript
POST /api/attendance/checkin
- Authenticate user (auth middleware)
- Extract time_in and photo from request
```

#### 6. **Get Philippines Date**
```javascript
const phTime = toZonedTime(new Date(), 'Asia/Manila');
const date = format(phTime, 'yyyy-MM-dd'); // e.g., "2026-01-21"
```

#### 7. **Validate Existing Check-Ins**
```javascript
// Query existing check-ins for today
SELECT id, time_out FROM attendance 
WHERE user_id = ? AND date = ?

// Check if reached limit (2 check-ins max)
if (existingCheckins.length >= 2) → Error: "Maximum 2 check-ins"

// Check if has open session
if (existingCheckins has entry without time_out) → Error: "Check out current session first"
```

#### 8. **Calculate Late Deduction**
```javascript
// Convert time to 24-hour format
timeIn24 = convertTo24Hour(time_in); // "08:15 AM" → "08:15"
minutesSinceMidnight = hours * 60 + minutes; // 495 minutes

// Determine session and calculate deduction
if (minutesSinceMidnight < 720) { // Morning (< 12:00 PM)
  morningBaseline = 485; // 8:05 AM
  morningLate = 540; // 9:00 AM
  
  if (minutesSinceMidnight > 485) {
    status = 'Late';
    lateMinutes = minutesSinceMidnight - 485;
    lateDeduction = minutesSinceMidnight >= 540 ? 2 : 1; // 2hr if ≥9AM, 1hr if 8:05-9:00
  }
}
else if (minutesSinceMidnight >= 720 && minutesSinceMidnight < 1080) { // Afternoon (12:00 PM - 6:00 PM)
  afternoonBaseline = 780; // 1:00 PM
  afternoonLateThreshold = 785; // 1:05 PM
  
  if (minutesSinceMidnight > 785) {
    status = 'Late';
    lateMinutes = minutesSinceMidnight - 780;
    lateDeduction = 1; // 1hr deduction
  }
}
else if (minutesSinceMidnight >= 1080) { // Overtime (≥ 6:00 PM)
  overtimeBaseline = 1140; // 7:00 PM
  overtimeLateThreshold = 1145; // 7:05 PM
  
  if (minutesSinceMidnight > 1145) {
    status = 'Late';
    lateMinutes = minutesSinceMidnight - 1140;
    lateDeduction = 1; // 1hr deduction
  }
}
```

#### 9. **Upload Photo to Supabase Storage**
```javascript
// Generate unique filename
fileName = `${user_id}/${uuid}.jpg`;

// Upload to 'checkinphoto' bucket
supabaseAdmin.storage.from('checkinphoto').upload(fileName, photoBuffer);

// Get public URL
photoUrl = getPublicUrl(fileName);
```

#### 10. **Insert Attendance Record**
```javascript
INSERT INTO attendance (
  user_id,
  date,
  time_in,
  status,
  photo_path,
  late_deduction_hours
) VALUES (?, ?, ?, ?, ?, ?);
```

#### 11. **Return Response**
```javascript
Response: {
  id: attendance_id,
  status: "On-Time" or "Late",
  lateMinutes: number,
  lateDeduction: 0, 1, or 2
}
```

---

### Frontend Response Handling

#### 12. **Show Alert to User**
```javascript
if (lateDeduction > 0) {
  Alert: "Late Check-In - You are late by X minutes. Y hour(s) deducted."
} else {
  Alert: "Checked In! - Attendance recorded successfully."
}
```

#### 13. **Refresh Attendance Data**
```javascript
fetchAttendance(); // Reload table
setPhoto(null); // Clear photo input
```

---

## 📤 CHECK-OUT FLOW

### Frontend (Dashboard.js)

#### 1. **User Clicks "Time Out" Button**
```
User Action → checkOut(id) function triggered
```

#### 2. **Pre-Check Validations**
```javascript
// Check work documentation
if (!workDoc.trim()) → Error: "Work Documentation Required"

// No time restrictions - can checkout anytime after check-in
```

#### 3. **Prepare Check-Out Data**
```javascript
const actualTimeOut = getPhilippinesTime(); // e.g., "10:30 AM"
const formData = new FormData();
formData.append('actual_time_out', actualTimeOut);
formData.append('work_documentation', workDoc);
formData.append('attachments', files); // Optional files
```

#### 4. **Send to Backend**
```
PUT /api/attendance/checkout/:id
Headers: Authorization Bearer token
Body: FormData (actual_time_out, work_documentation, attachments)
```

---

### Backend (server.js)

#### 5. **Receive Check-Out Request**
```javascript
PUT /api/attendance/checkout/:id
- Authenticate user (auth middleware)
- Extract actual_time_out, work_documentation, attachments
```

#### 6. **Fetch Attendance Entry**
```javascript
SELECT * FROM attendance 
WHERE id = ? AND user_id = ?

if (!entry) → Error: "Attendance entry not found"
```

#### 7. **Determine Session & Calculate Early Checkout Deduction**
```javascript
// Convert check-in time to 24-hour format
timeIn24 = convertTo24Hour(entry.time_in); // "08:00 AM" → "08:00"
actualTimeOut24 = convertTo24Hour(actual_time_out); // "10:30 AM" → "10:30"

checkInMinutes = hours * 60 + minutes; // e.g., 480 (8:00 AM)
checkOutMinutes = hours * 60 + minutes; // e.g., 630 (10:30 AM)

// Determine session and standard checkout time
if (checkInMinutes < 720) { // Morning session
  recordedTimeOut = '12:00 PM';
  standardCheckoutMinutes = 720; // 12:00 PM
}
else if (checkInMinutes >= 720 && checkInMinutes < 1080) { // Afternoon session
  recordedTimeOut = '05:00 PM';
  standardCheckoutMinutes = 1020; // 5:00 PM
}
else { // Overtime session
  recordedTimeOut = '10:00 PM';
  standardCheckoutMinutes = 1320; // 10:00 PM
}

// Calculate early checkout deduction
if (checkOutMinutes < standardCheckoutMinutes) {
  minutesEarly = standardCheckoutMinutes - checkOutMinutes;
  earlyCheckoutDeduction = Math.ceil(minutesEarly / 60); // Round up to nearest hour
}

// Example: Check out at 10:30 AM (630 min) for morning session (standard 720 min)
// minutesEarly = 720 - 630 = 90 minutes
// earlyCheckoutDeduction = Math.ceil(90 / 60) = 2 hours
```

#### 8. **Upload Attachments (Optional)**
```javascript
if (files exist) {
  for each file {
    // Generate unique filename
    fileName = `${user_id}/${uuid}.${extension}`;
    
    // Upload to 'workdocs' bucket
    supabaseAdmin.storage.from('workdocs').upload(fileName, fileBuffer);
    
    // Get public URL
    attachmentUrls.push(getPublicUrl(fileName));
  }
}
```

#### 9. **Update Attendance Record**
```javascript
UPDATE attendance SET
  time_out = ?, // Recorded time (12PM/5PM/10PM)
  actual_time_out = ?, // Actual time (e.g., 10:30 AM)
  early_checkout_deduction = ?, // Hours deducted (e.g., 2)
  work_documentation = ?,
  attachments = ? // Array of URLs
WHERE id = ? AND user_id = ?;
```

#### 10. **Return Response**
```javascript
Response: {
  success: true,
  earlyCheckoutDeduction: 0, 1, 2, 3, or 4
}
```

---

### Frontend Response Handling

#### 11. **Show Alert to User**
```javascript
if (earlyCheckoutDeduction > 0) {
  Alert: "Early Checkout - You checked out early. X hour(s) deducted from this session."
} else {
  Alert: "Checked Out! - You have successfully checked out."
}
```

#### 12. **Refresh Attendance Data**
```javascript
fetchAttendance(); // Reload table
setWorkDoc(''); // Clear work documentation
setAttachments([]); // Clear attachments
```

---

## 📊 DATABASE SCHEMA

```sql
attendance table:
├── id (UUID, Primary Key)
├── user_id (UUID, Foreign Key → auth.users)
├── date (DATE) - Philippines date
├── time_in (TEXT) - Check-in time (e.g., "08:15 AM")
├── time_out (TEXT) - Recorded checkout time (12PM/5PM/10PM)
├── actual_time_out (TEXT) - Actual checkout time (e.g., "10:30 AM")
├── status (TEXT) - "On-Time" or "Late"
├── late_deduction_hours (INTEGER) - Hours deducted for late check-in (0, 1, or 2)
├── early_checkout_deduction (INTEGER) - Hours deducted for early checkout
├── work_documentation (TEXT) - Work description
├── attachments (TEXT[]) - Array of file URLs
├── photo_path (TEXT) - Check-in photo URL
└── created_at (TIMESTAMP)
```

---

## 🔢 DEDUCTION CALCULATION EXAMPLES

### Late Check-In Deductions:
```
Morning Session:
- 8:00 AM - 8:05 AM → On-Time (0hr deduction)
- 8:06 AM - 8:59 AM → Late (1hr deduction)
- 9:00 AM onwards → Late (2hr deduction)

Afternoon Session:
- 1:00 PM - 1:05 PM → On-Time (0hr deduction)
- 1:06 PM onwards → Late (1hr deduction)

Overtime Session:
- 7:00 PM - 7:05 PM → On-Time (0hr deduction)
- 7:06 PM onwards → Late (1hr deduction)
```

### Early Checkout Deductions:
```
Morning Session (Standard: 12:00 PM):
- Check out 11:30 AM → 30 min early → 1hr deduction
- Check out 10:30 AM → 90 min early → 2hr deduction
- Check out 9:00 AM → 180 min early → 3hr deduction

Afternoon Session (Standard: 5:00 PM):
- Check out 4:30 PM → 30 min early → 1hr deduction
- Check out 3:00 PM → 120 min early → 2hr deduction

Overtime Session (Standard: 10:00 PM):
- Check out 9:30 PM → 30 min early → 1hr deduction
- Check out 8:00 PM → 120 min early → 2hr deduction
```

---

## 🎯 KEY FEATURES

1. **Timezone Handling**: All times use Philippines timezone (Asia/Manila, UTC+8)
2. **Photo Compression**: Check-in photos compressed to 600x400px, 60% quality
3. **File Validation**: Max 5MB per file, specific formats allowed
4. **Session Detection**: Automatic based on check-in time
5. **Dual Time Recording**: Stores both actual and recorded checkout times
6. **Flexible Checkout**: Can checkout anytime, but deductions apply if early
7. **Work Documentation**: Required at checkout with optional file attachments
8. **Daily Limit**: Maximum 2 check-ins per day (morning + afternoon)
9. **Real-time Validation**: Prevents multiple open sessions
10. **Deduction Transparency**: Shows both late and early deductions in table

---

## 🔄 COMPLETE USER JOURNEY

```
1. User arrives at work
2. Opens dashboard
3. Uploads photo
4. Clicks "Time In" (8:15 AM)
5. System checks: ✓ Within time window, ✓ Photo uploaded, ✓ No open session
6. Backend calculates: Late by 10 minutes → 1hr deduction
7. Alert shows: "Late Check-In - 10 minutes late, 1 hour deducted"
8. User works on tasks
9. User decides to leave early at 10:30 AM
10. Fills work documentation: "Completed database design"
11. Attaches screenshot (optional)
12. Clicks "Time Out"
13. Backend calculates: 90 minutes early → 2hr deduction
14. Alert shows: "Early Checkout - 2 hours deducted from this session"
15. Attendance record shows:
    - Time In: 8:15 AM
    - Time Out: 12:00 PM (recorded)
    - Actual Time Out: 10:30 AM
    - Late Deduction: 1hr
    - Early Deduction: 2hr
    - Total Deduction: 3hr
    - Net Hours: 4hr - 3hr = 1hr credited
```
