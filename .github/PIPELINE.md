# CI/CD Pipeline Documentation

## Overview
This pipeline automatically tests and validates the Triple G Attendance System on every push and pull request.

## Pipeline Stages

### 1. Test Backend
- Installs Node.js 18
- Installs backend dependencies
- Validates backend setup

### 2. Test Frontend
- Installs Node.js 18
- Installs frontend dependencies
- Builds React application
- Validates build success

### 3. Deploy Notification
- Runs only on main branch pushes
- Confirms all tests passed
- Indicates deployment readiness

## Triggers
- **Push to main branch**: Full pipeline runs
- **Pull requests to main**: Full pipeline runs for validation

## Status Badge
Add this to your README.md:
```markdown
![CI/CD](https://github.com/demesis221/TGGGsysattendance/workflows/Triple%20G%20Attendance%20CI%2FCD/badge.svg)
```

## Local Testing
Before pushing, test locally:

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run build
npm start
```

## Environment Variables Required
- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_SUPABASE_URL` - Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Supabase anonymous key

## Notes
- Pipeline runs on Ubuntu latest
- Uses Node.js 18
- Frontend build runs with CI=false to ignore warnings
