# Triple G BuildHub – OJT Attendance System

A centralized attendance dashboard system for interns and coordinators with real-time monitoring, photo documentation, and automatic status tracking.

## 🎨 Features

### Intern Dashboard
- Auto-fetched full name display
- Daily attendance status (On-Time/Late/Overtime)
- Time In/Out tracking with photo documentation
- Work documentation with file attachments (PDF, Word, Excel, images)
- Overtime logging (7:00 PM - 10:00 PM)
- Photo documentation per entry

### Head Coordinator Dashboard
- View all interns' attendance records
- Real-time monitoring
- Photo verification
- Transparent attendance tracking

## 🔧 Tech Stack

- **Backend**: Node.js, Express, Supabase
- **Frontend**: React
- **Authentication**: Supabase Auth
- **File Upload**: Multer

## 📦 Installation

### 1. Supabase Setup

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed instructions.

**Quick steps:**
1. Run `schema.sql` in Supabase SQL Editor
2. Create users in Authentication panel
3. Add profiles with user UUIDs

### 2. Backend Setup
```bash
cd backend
npm install
npm start
```

Server runs on `http://localhost:5000`

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

App runs on `http://localhost:3000`

## 🔐 Default Credentials

**Head Coordinator:**
- Email: `coordinator@tripleg.com`
- Password: `admin123`

**Intern:**
- Email: `intern1@tripleg.com`
- Password: `intern123`

## 📋 Attendance Rules

### Time In
- **Morning Session**: 5:00 AM - 12:00 PM (counted from 8:00 AM, late after 8:05 AM)
- **Afternoon Session**: 12:40 PM - 5:00 PM (cannot check in if morning session not closed)
- **Overtime**: 7:00 PM - 10:00 PM

### Time Out
- **Morning Session**: 12:00 PM onwards
- **Afternoon Session**: 5:00 PM onwards

### Work Documentation
- Required at checkout
- Describe tasks completed during the session
- Optional file attachments:
  - Screenshots (.png, .jpg, .jpeg)
  - Documents (.pdf, .doc, .docx)
  - Spreadsheets (.xls, .xlsx)
  - Text files (.txt)

## 🎨 Design

Uses official Triple G BuildHub color palette:
- Background: `#00273C` (Dark Navy Blue)
- Accent: `#FF7120` (Orange)
- Secondary: `#003a5c`

## 📁 Project Structure

```
tripleGattendance/
├── backend/
│   ├── server.js          # Express API
│   ├── schema.sql         # Supabase schema
│   ├── .env               # Supabase credentials
│   ├── package.json
│   └── uploads/           # Attendance photos
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── App.css        # Triple G styling
│   │   └── index.js
│   ├── public/
│   └── package.json
└── SUPABASE_SETUP.md      # Setup guide
```

## 🚀 Usage

### For Interns
1. Login with credentials
2. **Check In**: Upload photo → Click "Time In"
3. **Work**: Complete your tasks for the session
4. **Check Out**: 
   - Write work documentation (what you accomplished)
   - Attach files (optional): screenshots, documents, or images
   - Click "Time Out"
5. **View History**: See your attendance records with filters

### For Coordinators
1. Login with coordinator credentials
2. **Monitor**: View all interns' attendance in real-time
3. **Filter**: By intern name, session (Morning/Afternoon), or date
4. **Verify**: Check photos and work documentation
5. **Review**: View attached files and screenshots

## 📸 Photo & File Documentation

### Check-In Photo
- Required for every check-in
- Automatically compressed for storage
- Used for verification and accountability

### Checkout Attachments
- Optional file uploads at checkout
- Supported formats:
  - **Images**: PNG, JPG, JPEG (screenshots of work)
  - **Documents**: PDF, DOC, DOCX
  - **Spreadsheets**: XLS, XLSX
  - **Text**: TXT
- Multiple files can be attached per checkout
- Files are stored securely in Supabase Storage
