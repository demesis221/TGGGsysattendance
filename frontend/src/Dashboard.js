import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Alert from './components/Alert';
import { TableSkeleton, CardSkeleton } from './components/SkeletonLoader';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

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
  const [approvedOvertimes, setApprovedOvertimes] = useState([]);

  // Coordinator management states
  const [showLeaderPanel, setShowLeaderPanel] = useState(false);
  const [groups, setGroups] = useState([]);
  const [allTodos, setAllTodos] = useState([]);

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

    // Check if user has approved overtime for today
    const hasApprovedOTToday = approvedOvertimes.some(ot => ot.date === today && ot.status === 'approved');
    const inOvertime = hasApprovedOTToday && minutes >= (18 * 60 + 50) && minutes < 22 * 60; // 6:50 PM - 10 PM

    if (todaysOpen) return false;

    // Count sessions for today
    const morningSession = todaysEntries.find(e => e.session === 'Morning');
    const afternoonSession = todaysEntries.find(e => e.session === 'Afternoon');
    const overtimeSession = todaysEntries.find(e => e.session === 'Overtime');

    // Allow check-in if current period is available and not yet checked in for that session
    if (inMorning && !morningSession) return true;
    if (inAfternoon && !afternoonSession) return true;
    if (inOvertime && !overtimeSession) return true;

    return false;
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
    
    // Determine session type
    const isMorning = startMinutes < 12 * 60;
    const isAfternoon = startMinutes >= 12 * 60 && startMinutes < 18 * 60;
    const isOvertime = startMinutes >= 18 * 60;
    
    if (isMorning) {
      return nowMinutes >= 12 * 60; // Can checkout at 12 PM
    } else if (isAfternoon) {
      return nowMinutes >= 17 * 60; // Can checkout at 5 PM
    } else if (isOvertime) {
      return nowMinutes >= 22 * 60; // Can checkout at 10 PM
    }
    return false;
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
        promises.push(fetchGroups());
        promises.push(fetchAllTodos());
      } else {
        promises.push(fetchApprovedOvertimes());
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
      let session = '-';
      if (hourNum < 12) {
        session = 'Morning';
      } else if (hourNum >= 12 && hourNum < 18) {
        session = 'Afternoon';
      } else if (hourNum >= 18) {
        session = 'Overtime';
      }
      return { ...entry, session };
    });
    // Consolidate attendance by date for daily view
    const consolidatedByDate = {};
    withSession.forEach(entry => {
      if (!consolidatedByDate[entry.date]) {
        consolidatedByDate[entry.date] = {
          date: entry.date,
          user_id: entry.user_id,
          full_name: entry.full_name,
          morning_time_in: null,
          morning_time_out: null,
          morning_status: null,
          morning_late_deduction: 0,
          afternoon_time_in: null,
          afternoon_time_out: null,
          afternoon_status: null,
          afternoon_late_deduction: 0,
          ot_time_in: null,
          ot_time_out: null,
          ot_status: null,
          ot_late_deduction: 0,
          total_deduction: 0,
          work_documentation: null,
          attachments: [],
          photo_path: null,
          allSessions: []
        };
      }
      
      // Determine overall status (worst of all sessions)
      let overallStatus = consolidatedByDate[entry.date].overall_status || 'On-Time';
      if (entry.status === 'Late') overallStatus = 'Late';
      
      if (entry.session === 'Morning') {
        consolidatedByDate[entry.date].morning_time_in = entry.time_in;
        consolidatedByDate[entry.date].morning_time_out = entry.actual_time_out || entry.time_out;
        consolidatedByDate[entry.date].morning_status = entry.status;
        consolidatedByDate[entry.date].morning_late_deduction = entry.late_deduction_hours || 0;
      } else if (entry.session === 'Afternoon') {
        consolidatedByDate[entry.date].afternoon_time_in = entry.time_in;
        consolidatedByDate[entry.date].afternoon_time_out = entry.actual_time_out || entry.time_out;
        consolidatedByDate[entry.date].afternoon_status = entry.status;
        consolidatedByDate[entry.date].afternoon_late_deduction = entry.late_deduction_hours || 0;
      } else if (entry.session === 'Overtime') {
        consolidatedByDate[entry.date].ot_time_in = entry.time_in;
        consolidatedByDate[entry.date].ot_time_out = entry.actual_time_out || entry.time_out;
        consolidatedByDate[entry.date].ot_status = entry.status;
        consolidatedByDate[entry.date].ot_late_deduction = entry.late_deduction_hours || 0;
      }
      
      consolidatedByDate[entry.date].overall_status = overallStatus;
      consolidatedByDate[entry.date].total_deduction += (entry.late_deduction_hours || 0) + (entry.early_checkout_deduction || 0);
      
      if (entry.work_documentation) {
        consolidatedByDate[entry.date].work_documentation = entry.work_documentation;
      }
      if (entry.attachments && Array.isArray(entry.attachments)) {
        consolidatedByDate[entry.date].attachments = [...new Set([...consolidatedByDate[entry.date].attachments, ...entry.attachments])];
      }
      if (entry.photo_path) {
        consolidatedByDate[entry.date].photo_path = entry.photo_path;
      }
      consolidatedByDate[entry.date].allSessions.push(entry);
    });
    
    const consolidated = Object.values(consolidatedByDate).sort((a, b) => new Date(b.date) - new Date(a.date));
    setAttendance(consolidated);
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

  const fetchApprovedOvertimes = async () => {
    try {
      const { data } = await axios.get(`${API}/overtime/my-approved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApprovedOvertimes(data);
      console.log('Approved overtimes:', data);
    } catch (err) {
      console.error('Failed to fetch approved overtimes:', err);
      setApprovedOvertimes([]);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data } = await axios.get(`${API}/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(data);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  const fetchAllTodos = async () => {
    try {
      // Fetch assigned tasks for coordinator monitoring (includes assigned + confirmed group tasks)
      const { data } = await axios.get(`${API}/todos?type=coordinator_overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllTodos(data);
    } catch (err) {
      console.error('Failed to fetch todos:', err);
    }
  };

  const toggleLeader = async (userId, isCurrentlyLeader) => {
    try {
      const endpoint = isCurrentlyLeader ? 'remove-leader' : 'make-leader';
      await axios.post(`${API}/users/${userId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInterns();
      fetchGroups();
      showAlert('success', 'Success', isCurrentlyLeader ? 'Leader role removed.' : 'Leader role assigned.');
    } catch (error) {
      showAlert('error', 'Error', error.response?.data?.error || 'Failed to update leader status.');
    }
  };

  const deleteGroup = async (groupId, groupName) => {
    if (!window.confirm(`Are you sure you want to delete the group "${groupName}"? This will remove all members from the group.`)) {
      return;
    }
    try {
      await axios.delete(`${API}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroups();
      fetchInterns();
      showAlert('success', 'Group Deleted', `"${groupName}" has been disbanded.`);
    } catch (error) {
      showAlert('error', 'Error', error.response?.data?.error || 'Failed to delete group.');
    }
  };

  // Helper to find intern's group
  const getInternGroup = (internId) => {
    for (const group of groups) {
      if (group.members?.some(m => m.user_id === internId)) {
        return group;
      }
    }
    return null;
  };

  // Helper to get leader's task count
  const getLeaderTaskCount = (leaderId) => {
    return allTodos.filter(t => t.assigned_by === leaderId && t.todo_type === 'assigned').length;
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
    const plainText = workDoc.replace(/<[^>]*>/g, '').trim();
    if (!plainText) {
      showAlert('error', 'Work Documentation Required', 'Please describe your work before checking out!');
      return;
    }

    setButtonLoading(true);
    try {
      const actualTimeOut = getPhilippinesTime();
      const formData = new FormData();
      formData.append('actual_time_out', actualTimeOut);
      formData.append('work_documentation', workDoc);

      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      const { data } = await axios.put(`${API}/attendance/checkout/${id}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (data.earlyCheckoutDeduction > 0) {
        showAlert('warning', 'Early Checkout',
          `You checked out early. ${data.earlyCheckoutDeduction} hour(s) deducted from this session.`);
      } else {
        showAlert('success', 'Checked Out!', 'You have successfully checked out.');
      }

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
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Coordinator Management Panel */}
        {user.role === 'coordinator' && (
          <div className="coordinator-panel" style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: 0, color: '#e8eaed' }}> Coordinator Panel</h3>
              <button
                onClick={() => setShowLeaderPanel(!showLeaderPanel)}
                style={{
                  background: showLeaderPanel ? '#FF7120' : 'transparent',
                  border: '1px solid #FF7120',
                  color: showLeaderPanel ? 'white' : '#FF7120',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {showLeaderPanel ? 'Hide Details' : 'Manage Leaders & Monitor'}
              </button>
            </div>

            {/* Quick Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginBottom: showLeaderPanel ? '1.5rem' : 0
            }}>
              <div style={{
                background: '#00273C',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FF7120' }}>
                  {interns.filter(i => i.is_leader).length}
                </div>
                <div style={{ color: '#a0a4a8', fontSize: '0.85rem' }}>Leaders</div>
              </div>
              <div style={{
                background: '#00273C',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>
                  {groups.length}
                </div>
                <div style={{ color: '#a0a4a8', fontSize: '0.85rem' }}>Groups</div>
              </div>
              <div style={{
                background: '#00273C',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#17a2b8' }}>
                  {allTodos.filter(t => !t.completed).length}
                </div>
                <div style={{ color: '#a0a4a8', fontSize: '0.85rem' }}>Active Tasks</div>
              </div>

            </div>

            {/* Expanded Panel */}
            {showLeaderPanel && (
              <div style={{
                background: '#001824',
                borderRadius: '12px',
                padding: '1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {/* Leader Management Section */}
                <div style={{ marginBottom: '2rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#e8eaed' }}>👤 Assign Leaders</h4>
                  <div style={{
                    display: 'grid',
                    gap: '0.5rem',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    {interns.map(intern => {
                      const internGroup = getInternGroup(intern.id);
                      const taskCount = intern.is_leader ? getLeaderTaskCount(intern.id) : 0;
                      return (
                        <div key={intern.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#00273C',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: intern.is_leader ? '1px solid rgba(255, 113, 32, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                            <span style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: intern.is_leader ? '#FF7120' : 'rgba(255, 255, 255, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '0.9rem',
                              flexShrink: 0
                            }}>
                              {intern.is_leader ? '👑' : intern.full_name?.charAt(0) || '?'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#e8eaed', fontSize: '0.9rem' }}>{intern.full_name}</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                                  {intern.is_leader ? '👑 Leader' : 'Intern'}
                                </span>
                                {internGroup && (
                                  <span style={{
                                    background: 'rgba(100, 100, 255, 0.1)',
                                    color: '#6b8cff',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem'
                                  }}>
                                    👥 {internGroup.name}
                                  </span>
                                )}
                                {intern.is_leader && taskCount > 0 && (
                                  <span style={{
                                    background: 'rgba(255, 113, 32, 0.1)',
                                    color: '#FF7120',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem'
                                  }}>
                                    📋 {taskCount} task{taskCount !== 1 ? 's' : ''} assigned
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleLeader(intern.id, intern.is_leader)}
                            style={{
                              background: intern.is_leader ? 'rgba(255, 80, 80, 0.1)' : 'rgba(40, 167, 69, 0.1)',
                              border: intern.is_leader ? '1px solid rgba(255, 80, 80, 0.3)' : '1px solid rgba(40, 167, 69, 0.3)',
                              color: intern.is_leader ? '#ff5050' : '#28a745',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              flexShrink: 0
                            }}
                          >
                            {intern.is_leader ? 'Remove Leader' : 'Make Leader'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Groups Overview */}
                <div style={{ marginBottom: '2rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#e8eaed' }}>👥 Groups Overview</h4>
                  {groups.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No groups created yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {groups.map(group => {
                        const leaderTaskCount = getLeaderTaskCount(group.leader_id);
                        return (
                          <div key={group.id} style={{
                            background: '#00273C',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                              <div>
                                <span style={{ color: '#e8eaed', fontWeight: '500', fontSize: '1rem' }}>{group.name}</span>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                  <span style={{
                                    background: 'rgba(255, 113, 32, 0.1)',
                                    color: '#FF7120',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem'
                                  }}>
                                    {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''}
                                  </span>
                                  {leaderTaskCount > 0 && (
                                    <span style={{
                                      background: 'rgba(100, 255, 100, 0.1)',
                                      color: '#28a745',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem'
                                    }}>
                                      📋 {leaderTaskCount} task{leaderTaskCount !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => deleteGroup(group.id, group.name)}
                                style={{
                                  background: 'rgba(255, 80, 80, 0.1)',
                                  border: '1px solid rgba(255, 80, 80, 0.3)',
                                  color: '#ff5050',
                                  padding: '0.35rem 0.6rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem'
                                }}
                              >
                                🗑️ Disband
                              </button>
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                              👑 Leader: <span style={{ color: '#FF7120' }}>{group.leader?.full_name || 'None'}</span>
                            </div>
                            {/* Members List */}
                            {group.members && group.members.length > 0 && (
                              <div style={{ marginTop: '0.5rem' }}>
                                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Members:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                  {group.members.map(member => (
                                    <span
                                      key={member.user_id}
                                      style={{
                                        background: member.user_id === group.leader_id ? 'rgba(255, 113, 32, 0.2)' : 'rgba(100, 100, 255, 0.1)',
                                        color: member.user_id === group.leader_id ? '#FF7120' : '#6b8cff',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                      }}
                                    >
                                      {member.user_id === group.leader_id && '👑'}
                                      {member.user?.full_name || 'Unknown'}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Assigned Tasks Monitor */}
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#e8eaed' }}>📋 Recent Assigned Tasks</h4>
                  {allTodos.filter(t => t.todo_type === 'assigned' || (t.todo_type === 'group' && t.is_confirmed)).length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No assigned tasks yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                      {allTodos.filter(t => t.todo_type === 'assigned' || (t.todo_type === 'group' && t.is_confirmed)).slice(0, 10).map(todo => (
                        <div key={todo.id} style={{
                          background: '#00273C',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: `1px solid ${todo.completed ? 'rgba(40, 167, 69, 0.3)' :
                            todo.pending_completion ? 'rgba(255, 165, 0, 0.3)' :
                              'rgba(255, 255, 255, 0.1)'
                            }`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              color: todo.completed ? '#6b7280' : '#e8eaed',
                              fontSize: '0.85rem',
                              textDecoration: todo.completed ? 'line-through' : 'none'
                            }}>
                              {todo.task.replace(/\[.*?\]\s*/, '').substring(0, 40)}...
                            </span>
                            <span style={{
                              background: todo.completed ? 'rgba(40, 167, 69, 0.2)' :
                                todo.pending_completion ? 'rgba(255, 165, 0, 0.2)' :
                                  'rgba(255, 113, 32, 0.2)',
                              color: todo.completed ? '#28a745' :
                                todo.pending_completion ? '#ffa500' :
                                  '#FF7120',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem'
                            }}>
                              {todo.completed ? '✓ Done' : todo.pending_completion ? '⏳ Pending' : 'Active'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            <span>To: {todo.assignee?.full_name || 'Unknown'}</span>
                            <span>By: {todo.assigner?.full_name || 'Unknown'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem' }}>
                    Upload Photo (Required)
                  </label>
                  <div style={{ position: 'relative' }}>
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
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                        <circle cx="12" cy="13" r="3" />
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
                      Time In available 5AM-12PM (counted 8AM-12PM), 12:40PM-5PM, and 6:50PM-10PM (approved overtime only).
                    </div>
                  )}
                </div>
              </div>

              <div className="checkin-form">
                <h3>Work Documentation</h3>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem' }}>
                  What did you accomplish today?
                </label>
                <div style={{ opacity: todaysOpen ? 1 : 0.5, pointerEvents: todaysOpen ? 'auto' : 'none' }}>
                  <ReactQuill
                    value={workDoc}
                    onChange={setWorkDoc}
                    readOnly={!todaysOpen}
                    placeholder="Example: Completed database design, attended team meeting, fixed bug #123..."
                    theme="snow"
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['clean']
                      ]
                    }}
                    style={{
                      background: '#00273C',
                      borderRadius: '8px',
                      minHeight: '150px'
                    }}
                  />
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem' }}>
                    Attachments (Optional)
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

                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem' }}>
                      Attachments (Optional)
                    </label>
                    <div style={{ position: 'relative' }}>
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
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        {attachments.length > 0 ? `${attachments.length} file(s) selected` : 'Attach files (PDF, Word, Excel, Images)'}
                      </label>
                    </div>
                    {attachments.length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                        {attachments.map((file, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📎 {file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem' }}>
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
            </div >
          )
        )
        }

        <div className="attendance-table">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.75rem 2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>{user.role === 'coordinator' ? 'All Interns Attendance' : 'My Attendance History'}</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
              {/* Session filter removed - now showing per-day consolidated view */}
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
              {(filterDate) && (
                <button
                  onClick={() => {
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
                      <th>Morning In</th>
                      <th>Morning Out</th>
                      <th>Afternoon In</th>
                      <th>Afternoon Out</th>
                      <th>OT In</th>
                      <th>OT Out</th>
                      <th>Status</th>
                      <th>Deduction</th>
                      <th>Work Done</th>
                      <th>Attachments</th>
                      <th>Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance
                      .filter(a => selectedIntern === 'all' || a.user_id === selectedIntern)
                      .filter(a => !filterDate || a.date === filterDate)
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((a) => (
                        <tr key={a.date + (a.user_id || '')}>
                          {user.role === 'coordinator' && <td>{a.full_name}</td>}
                          <td>{a.date}</td>
                          <td>{formatTime(a.morning_time_in) || '-'}</td>
                          <td>{formatTime(a.morning_time_out) || '-'}</td>
                          <td>{formatTime(a.afternoon_time_in) || '-'}</td>
                          <td>{formatTime(a.afternoon_time_out) || '-'}</td>
                          <td>{formatTime(a.ot_time_in) || '-'}</td>
                          <td>{formatTime(a.ot_time_out) || '-'}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {a.morning_time_in && (
                                <span className={`status-badge ${a.morning_status === 'On-Time' ? 'status-ontime' : 'status-late'}`}>
                                  {a.morning_status ? `Morning: ${a.morning_status}` : 'Morning: -'}
                                </span>
                              )}
                              {a.afternoon_time_in && (
                                <span className={`status-badge ${a.afternoon_status === 'On-Time' ? 'status-ontime' : 'status-late'}`}>
                                  {a.afternoon_status ? `Afternoon: ${a.afternoon_status}` : 'Afternoon: -'}
                                </span>
                              )}
                              {a.ot_time_in && (
                                <span className={`status-badge ${a.ot_status === 'On-Time' ? 'status-ontime' : 'status-late'}`}>
                                  {a.ot_status ? `OT: ${a.ot_status}` : 'OT: -'}
                                </span>
                              )}
                              {!a.morning_time_in && !a.afternoon_time_in && !a.ot_time_in && (
                                <span style={{ color: '#a0a4a8' }}>-</span>
                              )}
                            </div>
                          </td>
                          <td>
                            {a.total_deduction > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {a.morning_late_deduction > 0 && (
                                  <span style={{ color: '#ff9d5c', fontWeight: '600', fontSize: '0.85rem' }}>Morning: -{a.morning_late_deduction}hr</span>
                                )}
                                {a.afternoon_late_deduction > 0 && (
                                  <span style={{ color: '#ff9d5c', fontWeight: '600', fontSize: '0.85rem' }}>Afternoon: -{a.afternoon_late_deduction}hr</span>
                                )}
                                {a.ot_late_deduction > 0 && (
                                  <span style={{ color: '#ff9d5c', fontWeight: '600', fontSize: '0.85rem' }}>OT: -{a.ot_late_deduction}hr</span>
                                )}
                              </div>
                            ) : '-'}
                          </td>
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
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                    Page {currentPage} of {Math.ceil(attendance.filter(a => selectedIntern === 'all' || a.user_id === selectedIntern).filter(a => !filterDate || a.date === filterDate).length / itemsPerPage) || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage >= Math.ceil(attendance.filter(a => selectedIntern === 'all' || a.user_id === selectedIntern).filter(a => !filterDate || a.date === filterDate).length / itemsPerPage)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: currentPage >= Math.ceil(attendance.filter(a => selectedIntern === 'all' || a.user_id === selectedIntern).filter(a => !filterDate || a.date === filterDate).length / itemsPerPage) ? 'rgba(255, 113, 32, 0.3)' : '#FF7120',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: currentPage >= Math.ceil(attendance.filter(a => selectedIntern === 'all' || a.user_id === selectedIntern).filter(a => !filterDate || a.date === filterDate).length / itemsPerPage) ? 'not-allowed' : 'pointer',
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
            <div
              style={{ color: '#e8eaed', lineHeight: '1.6', marginBottom: '1.5rem' }}
              dangerouslySetInnerHTML={{ __html: modalDoc }}
            />
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
          </div >
        </div >
      )
      }

      {
        fullscreenPhoto && (
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
        )
      }
    </div >
  );
}

export default Dashboard;
