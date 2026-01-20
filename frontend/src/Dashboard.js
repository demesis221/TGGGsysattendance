import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Alert from './components/Alert';
import { TableSkeleton, CardSkeleton } from './components/SkeletonLoader';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Dashboard({ token, user, onLogout }) {
  const [attendance, setAttendance] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [alert, setAlert] = useState(null);
  const [workDoc, setWorkDoc] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [modalDoc, setModalDoc] = useState(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState('all');
  const [buttonLoading, setButtonLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [filterSession, setFilterSession] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  
  // Get current date/time in Philippines timezone (UTC+8)
  const getPhilippinesDate = () => {
    const phTime = toZonedTime(new Date(), 'Asia/Manila');
    return format(phTime, 'yyyy-MM-dd');
  };
  
  const getPhilippinesTime = () => {
    const phTime = toZonedTime(new Date(), 'Asia/Manila');
    return format(phTime, 'hh:mm a');
  };
  
  const today = getPhilippinesDate();
  const todaysOpen = attendance.find(a => a.date === today && !a.time_out);
  const todaysEntries = attendance.filter(a => a.date === today);
  
  // Debug logging
  useEffect(() => {
    console.log('DEBUG - Today:', today);
    console.log('DEBUG - Current time:', new Date().toLocaleTimeString());
    console.log('DEBUG - Attendance data:', attendance);
    console.log('DEBUG - Todays entries:', todaysEntries);
    console.log('DEBUG - Todays open session:', todaysOpen);
    if (attendance.length > 0) {
      console.log('DEBUG - All dates:', attendance.map(a => a.date));
    }
  }, [attendance, today, todaysEntries, todaysOpen]);
  
  const canCheckInNow = () => {
    const phTime = toZonedTime(new Date(), 'Asia/Manila');
    const minutes = phTime.getHours() * 60 + phTime.getMinutes();
    const inMorning = minutes >= 5 * 60 && minutes < 12 * 60;
    const inAfternoon = minutes >= (12 * 60 + 40) && minutes < 17 * 60;
    const inOvertime = minutes >= 19 * 60 && minutes < 22 * 60;
    
    if (todaysOpen) return false;
    if (todaysEntries.length >= 2) return false;
    
    return inMorning || inAfternoon || inOvertime;
  };

  const parseMinutes = (timeStr) => {
    if (!timeStr) return null;
    
    // Check if it's in 24-hour format (HH:MM:SS or HH:MM)
    if (!timeStr.includes('AM') && !timeStr.includes('PM')) {
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return h * 60 + m;
    }
    
    // Parse 12-hour format (HH:MM AM/PM)
    const [time, meridiem] = timeStr.split(' ');
    if (!meridiem) return null;
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const canCheckOutNow = (entry) => {
    if (!entry || !entry.time_in) return false;
    const phTime = toZonedTime(new Date(), 'Asia/Manila');
    const nowMinutes = phTime.getHours() * 60 + phTime.getMinutes();
    const startMinutes = parseMinutes(entry.time_in);
    if (startMinutes === null) return false;
    const isMorning = startMinutes < 12 * 60;
    if (isMorning) {
      return nowMinutes >= 12 * 60;
    }
    return nowMinutes >= 17 * 60;
  };

  const showAlert = (type, title, message) => {
    setAlert({ type, title, message });
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const maxWidth = 600;
        const maxHeight = 400;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', 0.6);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const truncateText = (text, maxLength = 8) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '-') return '-';
    
    // If already in AM/PM format, return as is
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      return timeStr;
    }
    
    // Convert 24-hour to 12-hour format
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const promises = [fetchAttendance(), fetchUserProfile()];
      if (user.role === 'coordinator') {
        promises.push(fetchInterns());
      }
      await Promise.all(promises);
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data } = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile(data);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const fetchAttendance = async () => {
    const endpoint = user.role === 'coordinator' ? '/attendance/all' : '/attendance/my';
    const { data } = await axios.get(`${API}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const withSession = data.map(entry => {
      if (!entry.time_in) return { ...entry, session: '-' };
      const [h] = entry.time_in.split(':');
      const hourNum = parseInt(h, 10);
      const session = hourNum < 12 ? 'Morning' : 'Afternoon';
      return { ...entry, session };
    });
    setAttendance(withSession);
  };

  const fetchInterns = async () => {
    try {
      const { data } = await axios.get(`${API}/interns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched interns:', data);
      setInterns(data);
    } catch (err) {
      console.error('Failed to fetch interns:', err);
    }
  };

  const checkIn = async () => {
    if (todaysOpen) {
      showAlert('error', 'Already Checked In', 'Please check out your current session before checking in again.');
      return;
    }

    if (!canCheckInNow()) {
      showAlert('error', 'Not available', 'Time In is available 5AM-12PM (counted 8AM-12PM), 12:40PM-5PM, and 7PM-10PM for overtime.');
      return;
    }

    if (todaysEntries.length >= 2) {
      showAlert('warning', 'Limit Reached', 'You have already completed both check-ins for today.');
      return;
    }

    if (!photo) {
      showAlert('error', 'Photo Required', 'Please upload a photo before checking in!');
      return;
    }

    setButtonLoading(true);
    try {
      const timeIn = getPhilippinesTime();
      const formData = new FormData();
      formData.append('time_in', timeIn);
      
      const compressedPhoto = await compressImage(photo);
      formData.append('photo', compressedPhoto, 'photo.jpg');

      const { data } = await axios.post(`${API}/attendance/checkin`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      
      if (data.lateDeduction > 0) {
        showAlert('warning', 'Late Check-In', 
          `You are late by ${data.lateMinutes} minutes. You have been deducted ${data.lateDeduction} hour today.`);
      } else {
        showAlert('success', 'Checked In!', 'Your attendance has been recorded successfully.');
      }
      
      fetchAttendance();
      setPhoto(null);
    } finally {
      setButtonLoading(false);
    }
  };

  const checkOut = async (id) => {
    if (!canCheckOutNow(todaysOpen)) {
      showAlert('error', 'Not available', 'Time Out is available 12PM-5PM for morning session, and after 5PM for afternoon session.');
      return;
    }

    if (!workDoc.trim()) {
      showAlert('error', 'Work Documentation Required', 'Please describe your work before checking out!');
      return;
    }

    setButtonLoading(true);
    try {
      const timeOut = getPhilippinesTime();
      const formData = new FormData();
      formData.append('time_out', timeOut);
      formData.append('work_documentation', workDoc);
      
      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      await axios.put(`${API}/attendance/checkout/${id}`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      showAlert('success', 'Checked Out!', 'You have successfully checked out.');
      fetchAttendance();
      setWorkDoc('');
      setAttachments([]);
    } finally {
      setButtonLoading(false);
    }
  };



  return (
    <div>
      {alert && (
        <Alert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
      <div className="dashboard">
        <div className="welcome">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>Welcome, {user.name}</h2>
              <p>Role: {user.role === 'coordinator' ? 'Head Coordinator' : 'Intern'}</p>
            </div>
            <div style={{
              width: '50px',
              height: '50px',
              minWidth: '50px',
              minHeight: '50px',
              borderRadius: '50%',
              border: '3px solid #FF7120',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              background: '#00273C',
              flexShrink: 0
            }}>
              {userProfile?.profile_picture ? (
                <img 
                  src={userProfile.profile_picture} 
                  alt="Profile" 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#FF7120" 
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </div>
          </div>
        </div>

        {user.role === 'intern' && (
          loading ? (
            <div className="intern-grid">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
          <div className="intern-grid">
            <div className="checkin-form">
              <h3>Attendance</h3>
              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem'}}>
                  Upload Photo (Required)
                </label>
                <div style={{position: 'relative'}}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file && file.size > 5 * 1024 * 1024) {
                        showAlert('error', 'File Too Large', 'Image must be less than 5MB.');
                        e.target.value = '';
                        return;
                      }
                      setPhoto(file);
                    }}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer'
                    }}
                    id="photo-upload"
                  />
                  <label 
                    htmlFor="photo-upload"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '0.75rem 1rem',
                      background: photo ? 'rgba(255, 113, 32, 0.1)' : '#00273C',
                      border: `2px dashed ${photo ? '#FF7120' : 'rgba(255, 113, 32, 0.3)'}`,
                      borderRadius: '8px',
                      color: photo ? '#FF7120' : '#a0a4a8',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => {
                      if (!photo) {
                        e.target.style.borderColor = '#FF7120';
                        e.target.style.background = 'rgba(255, 113, 32, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!photo) {
                        e.target.style.borderColor = 'rgba(255, 113, 32, 0.3)';
                        e.target.style.background = '#00273C';
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                      <circle cx="12" cy="13" r="3"/>
                    </svg>
                    {photo ? `Selected: ${photo.name}` : 'Choose Photo File'}
                  </label>
                </div>
              </div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button 
                    onClick={checkIn}
                    disabled={
                      buttonLoading ||
                      !canCheckInNow() ||
                      todaysEntries.length >= 2
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      opacity: !canCheckInNow() ? 0.6 : 1,
                      cursor: !canCheckInNow() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {buttonLoading ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid transparent',
                          borderTop: '2px solid white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                        Processing...
                      </>
                    ) : 'Time In'}
                  </button>
                  {!canCheckInNow() && (
                    <div style={{ color: '#a0a4a8', fontSize: '0.9rem' }}>
                      Time In available 5AM-12PM (counted 8AM-12PM), 12:40PM-5PM, and 7PM-10PM (overtime).
                    </div>
                  )}
                </div>
            </div>

            <div className="checkin-form">
              <h3>Work Documentation</h3>
              <label style={{display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem'}}>
                What did you accomplish today?
              </label>
              <textarea
                value={workDoc}
                onChange={(e) => setWorkDoc(e.target.value)}
                placeholder="Example: Completed database design, attended team meeting, fixed bug #123..."
                disabled={!todaysOpen}
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '0.75rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  opacity: todaysOpen ? 1 : 0.5
                }}
              />
              
              <div style={{marginTop: '1rem'}}>
                <label style={{display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem'}}>
                  Attachments (Optional)
                </label>
                <div style={{position: 'relative'}}>
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" 
                    multiple
                    onChange={(e) => setAttachments(Array.from(e.target.files))}
                    disabled={!todaysOpen}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: todaysOpen ? 'pointer' : 'not-allowed'
                    }}
                    id="attachment-upload"
                  />
                  <label 
                    htmlFor="attachment-upload"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '0.75rem 1rem',
                      background: attachments.length > 0 ? 'rgba(255, 113, 32, 0.1)' : '#00273C',
                      border: `2px dashed ${attachments.length > 0 ? '#FF7120' : 'rgba(255, 113, 32, 0.3)'}`,
                      borderRadius: '8px',
                      color: attachments.length > 0 ? '#FF7120' : '#a0a4a8',
                      textAlign: 'center',
                      cursor: todaysOpen ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      opacity: todaysOpen ? 1 : 0.5
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    {attachments.length > 0 ? `${attachments.length} file(s) selected` : 'Attach files (PDF, Word, Excel, Images)'}
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div style={{marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280'}}>
                    {attachments.map((file, idx) => (
                      <div key={idx} style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                        <span>📎 {file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <p style={{color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem'}}>
                    {todaysOpen
                      ? canCheckOutNow(todaysOpen)
                        ? 'You can check out now'
                        : 'Time Out available 12PM-5PM (morning) and after 5PM (afternoon)'
                      : 'Check in first to document your work'}
              </p>
              <div style={{ display: 'flex', gap: '20px', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => todaysOpen && checkOut(todaysOpen.id)}
                  disabled={buttonLoading || !todaysOpen || !canCheckOutNow(todaysOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: (!todaysOpen || !canCheckOutNow(todaysOpen)) ? 0.6 : 1,
                    cursor: (!todaysOpen || !canCheckOutNow(todaysOpen)) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {buttonLoading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Processing...
                    </>
                  ) : 'Time Out'}
                </button>
              </div>
            </div>
          </div>
          )
        )}

        <div className="attendance-table">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.75rem 2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', flexWrap: 'wrap', gap: '1rem'}}>
            <h3 style={{margin: 0}}>{user.role === 'coordinator' ? 'All Interns Attendance' : 'My Attendance History'}</h3>
            <div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
              {user.role === 'coordinator' && (
                <select
                  value={selectedIntern}
                  onChange={(e) => setSelectedIntern(e.target.value)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#00273C',
                    color: '#e8eaed',
                    border: '1px solid rgba(255, 113, 32, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Interns</option>
                  {interns.map(intern => (
                    <option key={intern.id} value={intern.id}>
                      {intern.full_name}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={filterSession}
                onChange={(e) => setFilterSession(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 113, 32, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Sessions</option>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 113, 32, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              />
              {(filterSession !== 'all' || filterDate) && (
                <button
                  onClick={() => {
                    setFilterSession('all');
                    setFilterDate('');
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(255, 113, 32, 0.2)',
                    color: '#FF7120',
                    border: '1px solid rgba(255, 113, 32, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
          <div className="table-wrapper">
            {loading ? (
              <TableSkeleton />
            ) : (
            <>
            <table>
            <thead>
              <tr>
                {user.role === 'coordinator' && <th>Intern Name</th>}
                <th>Date</th>
                <th>Session</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Status</th>
                <th>Deduction</th>
                <th>OT In</th>
                <th>OT Out</th>
                <th>Work Done</th>
                <th>Attachments</th>
                <th>Photo</th>
              </tr>
            </thead>
            <tbody>
              {attendance
                .filter(a => selectedIntern === 'all' || a.user_id === selectedIntern)
                .filter(a => filterSession === 'all' || a.session === filterSession)
                .filter(a => !filterDate || a.date === filterDate)
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((a) => (
                <tr key={a.id}>
                  {user.role === 'coordinator' && <td>{a.full_name}</td>}
                  <td>{a.date}</td>
                  <td>{a.session || '-'}</td>
                  <td>{formatTime(a.time_in)}</td>
                  <td>{formatTime(a.time_out)}</td>
                  <td>
                    <span className={`status-badge ${a.status === 'On-Time' ? 'status-ontime' : 'status-late'}`}>
                      {a.status || '-'}
                    </span>
                  </td>
                  <td>
                    {a.late_deduction_hours > 0 ? (
                      <span style={{color: '#ff9d5c', fontWeight: '600'}}>-{a.late_deduction_hours}hr</span>
                    ) : '-'}
                  </td>
                  <td>{formatTime(a.ot_time_in)}</td>
                  <td>{formatTime(a.ot_time_out)}</td>
                  <td>
                    {a.work_documentation ? (
                      <div>
                        {truncateText(a.work_documentation)}
                        {a.work_documentation.length > 20 && (
                          <button 
                            onClick={() => setModalDoc(a.work_documentation)}
                            style={{
                              marginLeft: '8px',
                              background: '#FF7120',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '0.7rem',
                              cursor: 'pointer'
                            }}
                          >
                            ...
                          </button>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    {a.attachments && a.attachments.length > 0 ? (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                        {a.attachments.map((url, idx) => {
                          const fileName = url.split('/').pop().split('?')[0];
                          const ext = fileName.split('.').pop().toLowerCase();
                          return (
                            <a 
                              key={idx}
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                color: '#FF7120',
                                textDecoration: 'none',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              📎 {ext}
                            </a>
                          );
                        })}
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    {a.photo_path && (
                      <img 
                        src={a.photo_path} 
                        alt="Attendance" 
                        className="photo-thumb" 
                        onClick={() => setFullscreenPhoto(a.photo_path)}
                        style={{ cursor: 'pointer' }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.5rem 1rem',
                background: currentPage === 1 ? 'rgba(255, 113, 32, 0.3)' : '#FF7120',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              Previous
            </button>
            <span style={{ color: '#e8eaed', fontSize: '0.9rem' }}>
              Page {currentPage} of {Math.ceil(attendance.filter(a => selectedIntern === 'all' || a.user_id === selectedIntern).filter(a => filterSession === 'all' || a.session === filterSession).filter(a => !filterDate || a.date === filterDate).length / itemsPerPage) || 1}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= Math.ceil(attendance.filter(a => selectedIntern === 'all' || a.user_id === selectedIntern).filter(a => filterSession === 'all' || a.session === filterSession).filter(a => !filterDate || a.date === filterDate).length / itemsPerPage)}
              style={{
                padding: '0.5rem 1rem',
                background: currentPage >= Math.ceil(attendance.filter(a => selectedIntern === 'all' || a.user_id === selectedIntern).filter(a => filterSession === 'all' || a.session === filterSession).filter(a => !filterDate || a.date === filterDate).length / itemsPerPage) ? 'rgba(255, 113, 32, 0.3)' : '#FF7120',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage >= Math.ceil(attendance.filter(a => selectedIntern === 'all' || a.user_id === selectedIntern).filter(a => filterSession === 'all' || a.session === filterSession).filter(a => !filterDate || a.date === filterDate).length / itemsPerPage) ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              Next
            </button>
          </div>
          </>
            )}
          </div>
        </div>
      </div>
      
      {modalDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#001f35',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: '1px solid rgba(255, 113, 32, 0.2)'
          }}>
            <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>Work Documentation</h3>
            <p style={{ color: '#e8eaed', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              {modalDoc}
            </p>
            <button 
              onClick={() => setModalDoc(null)}
              style={{
                background: '#FF7120',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {fullscreenPhoto && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => setFullscreenPhoto(null)}
        >
          <img 
            src={fullscreenPhoto} 
            alt="Fullscreen" 
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
          />
          <button 
            onClick={() => setFullscreenPhoto(null)}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: '#FF7120',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '1.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
