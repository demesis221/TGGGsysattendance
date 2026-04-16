import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Alert from './components/Alert';
import { CardSkeleton } from './components/SkeletonLoader';
import PrintAttendance from './PrintAttendance';
import { Printer } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const decodeHtmlEntities = (text) => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

function Reports({ token }) {
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminAction, setAdminAction] = useState({ type: '', record: null });
  const [alert, setAlert] = useState(null);
  const [expandedRecords, setExpandedRecords] = useState({});
  const [showPrintView, setShowPrintView] = useState(false);
  const [printFilter, setPrintFilter] = useState('all');
  const [printDate, setPrintDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedInternId, setSelectedInternId] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchInterns(), fetchAllAttendance()]);
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInterns = async () => {
    try {
      console.log('Fetching interns with token:', token);
      const { data } = await axios.get(`${API}/interns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Interns fetched:', data);
      console.log('Profile pictures:', data.map(i => ({ name: i.full_name, pic: i.profile_picture })));
      setInterns(data);
    } catch (error) {
      console.error('Error fetching interns:', error.response?.data || error.message);
      console.error('Status:', error.response?.status);
      if (error.response?.status === 403) {
        setAlert({ type: 'error', title: 'Access Denied', message: 'Your account role must be "coordinator" in the database.' });
      } else if (error.response?.status === 401) {
        setAlert({ type: 'error', title: 'Session Expired', message: 'Please log out and log in again.' });
      }
    }
  };

  const fetchAllAttendance = async () => {
    try {
      const { data } = await axios.get(`${API}/attendance/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllAttendance(data);
    } catch (error) {
      console.error('Error fetching all attendance:', error);
    }
  };

  const parseMinutes = (timeStr) => {
    if (!timeStr) return null;
    if (!timeStr.includes('AM') && !timeStr.includes('PM')) {
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return h * 60 + m;
    }
    const [time, meridiem] = timeStr.split(' ');
    if (!meridiem) return null;
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const calculateMinutesWorked = (timeIn, timeOut, session) => {
    if (!timeIn || !timeOut) return 0;
    const inMinutes = parseMinutes(timeIn);
    const outMinutes = parseMinutes(timeOut);
    if (inMinutes === null || outMinutes === null) return 0;
    
    if (inMinutes === outMinutes) return 0;
    
    const morningBaseline = 8 * 60; // 8:00 AM
    const afternoonBaseline = 13 * 60; // 1:00 PM
    const overtimeBaseline = 19 * 60; // 7:00 PM
    const morningGrace = 8 * 60 + 5; // 8:05 AM
    const afternoonGrace = 13 * 60 + 5; // 1:05 PM
    const overtimeGrace = 19 * 60 + 5; // 7:05 PM
    const morningEnd = 12 * 60; // 12:00 PM
    const afternoonEnd = 17 * 60; // 5:00 PM
    const overtimeEnd = 22 * 60; // 10:00 PM
    
    if (session === 'Morning') {
      // If within grace period (<=8:05 AM), count from baseline (8:00 AM)
      const effectiveStart = inMinutes <= morningGrace ? morningBaseline : inMinutes;
      const effectiveEnd = Math.min(outMinutes, morningEnd);
      return Math.max(0, effectiveEnd - effectiveStart);
    } else if (session === 'Afternoon') {
      // If within grace period (<=1:05 PM), count from baseline (1:00 PM)
      const effectiveStart = inMinutes <= afternoonGrace ? afternoonBaseline : inMinutes;
      const effectiveEnd = Math.min(outMinutes, afternoonEnd);
      return Math.max(0, effectiveEnd - effectiveStart);
    } else if (session === 'Overtime') {
      // If within grace period (<=7:05 PM), count from baseline (7:00 PM)
      const effectiveStart = inMinutes <= overtimeGrace ? overtimeBaseline : inMinutes;
      const effectiveEnd = Math.min(outMinutes, overtimeEnd);
      return Math.max(0, effectiveEnd - effectiveStart);
    }
    return 0;
  };

  const fetchInternAttendance = async (internId) => {
    const filtered = allAttendance.filter(a => a.user_id === internId);
    
    const consolidatedByDate = {};
    filtered.forEach(entry => {
      if (!consolidatedByDate[entry.date]) {
        consolidatedByDate[entry.date] = {
          date: entry.date,
          user_id: entry.user_id,
          work_mode: entry.work_mode || 'onsite',
          morning_time_in: null,
          morning_time_out: null,
          afternoon_time_in: null,
          afternoon_time_out: null,
          ot_time_in: null,
          ot_time_out: null,
          total_minutes_worked: 0,
          total_late_minutes: 0,
          work_documentation: null,
          attachments: [],
          morning_photo: null,
          afternoon_photo: null,
          ot_photo: null
        };
      }
      
      const record = consolidatedByDate[entry.date];
      const session = determineSession(entry.time_in);
      
      if (session === 'Morning') {
        record.morning_time_in = entry.time_in;
        record.morning_time_out = entry.time_out;
      } else if (session === 'Afternoon') {
        record.afternoon_time_in = entry.time_in;
        record.afternoon_time_out = entry.time_out;
      } else if (session === 'Overtime') {
        record.ot_time_in = entry.time_in;
        record.ot_time_out = entry.time_out;
      }
      
      let minutesWorked = 0;
      if (entry.total_minutes_worked) {
        minutesWorked = entry.total_minutes_worked;
      } else if (entry.time_out) {
        minutesWorked = calculateMinutesWorked(entry.time_in, entry.time_out, session);
      }
      
      record.total_minutes_worked += minutesWorked;
      record.total_late_minutes += (entry.late_minutes || 0);
      
      if (session === 'Morning' && entry.photo_path) record.morning_photo = entry.photo_path;
      if (session === 'Afternoon' && entry.photo_path) record.afternoon_photo = entry.photo_path;
      if (session === 'Overtime' && entry.photo_path) record.ot_photo = entry.photo_path;
      
      if (entry.work_documentation) record.work_documentation = entry.work_documentation;
      if (entry.attachments) record.attachments = [...record.attachments, ...entry.attachments];
    });
    
    setAttendance(Object.values(consolidatedByDate).sort((a, b) => new Date(b.date) - new Date(a.date)));
    setSelectedIntern(interns.find(i => i.id === internId));
    setShowModal(true);
  };

  const determineSession = (timeIn) => {
    if (!timeIn) return null;
    
    // Handle both 24-hour format (07:40:00) and 12-hour format (7:40 AM)
    let hour;
    if (timeIn.includes('AM') || timeIn.includes('PM')) {
      const [time] = timeIn.split(' ');
      const [h] = time.split(':');
      hour = parseInt(h, 10);
      if (timeIn.includes('PM') && hour !== 12) hour += 12;
      if (timeIn.includes('AM') && hour === 12) hour = 0;
    } else {
      // 24-hour format
      const [h] = timeIn.split(':');
      hour = parseInt(h, 10);
    }
    
    if (hour < 12) return 'Morning';
    if (hour >= 12 && hour < 18) return 'Afternoon';
    return 'Overtime';
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

  const capTimeOut = (timeOut, session) => {
    if (!timeOut || timeOut === '-') return timeOut;
    
    const outMinutes = parseMinutes(timeOut);
    if (outMinutes === null) return timeOut;
    
    const morningEnd = 12 * 60; // 12:00 PM
    const afternoonEnd = 17 * 60; // 5:00 PM
    const overtimeEnd = 22 * 60; // 10:00 PM
    
    let cappedMinutes = outMinutes;
    
    if (session === 'Morning' && outMinutes > morningEnd) {
      cappedMinutes = morningEnd;
    } else if (session === 'Afternoon' && outMinutes > afternoonEnd) {
      cappedMinutes = afternoonEnd;
    } else if (session === 'Overtime' && outMinutes > overtimeEnd) {
      cappedMinutes = overtimeEnd;
    }
    
    const hours = Math.floor(cappedMinutes / 60);
    const mins = cappedMinutes % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHour}:${mins.toString().padStart(2, '0')} ${ampm}`;
  };

  const calculateRecordMetrics = (record) => {
    return {
      hours: Math.floor(record.total_minutes_worked / 60),
      minutes: record.total_minutes_worked % 60,
      lateMinutes: record.total_late_minutes
    };
  };



  const calculateStats = (internId) => {
    const intern = interns.find(i => i.id === internId);
    const additionalMinutes = intern?.additional_hours || 0;
    const internAttendance = allAttendance.filter(a => a.user_id === internId);
    
    const uniqueDates = new Set(internAttendance.map(a => a.date));
    const total = uniqueDates.size;
    
    // Group by date to count on-time/late days correctly
    const dateGroups = {};
    internAttendance.forEach(record => {
      if (!dateGroups[record.date]) {
        dateGroups[record.date] = { hasLate: false };
      }
      if (record.status === 'Late') {
        dateGroups[record.date].hasLate = true;
      }
    });
    
    const late = Object.values(dateGroups).filter(d => d.hasLate).length;
    const onTime = total - late;
    
    let totalLateMinutes = 0;
    let totalMinutesWorked = 0;
    
    internAttendance.forEach(record => {
      totalLateMinutes += (record.late_minutes || 0);
      
      if (record.total_minutes_worked) {
        totalMinutesWorked += record.total_minutes_worked;
      } else if (record.time_out) {
        const session = determineSession(record.time_in);
        totalMinutesWorked += calculateMinutesWorked(record.time_in, record.time_out, session);
      }
    });
    
    // Deduct late minutes FIRST, then show additional hours separately
    const baseMinutesWorked = Math.max(0, totalMinutesWorked - totalLateMinutes);
    const totalHours = Math.floor(baseMinutesWorked / 60);
    const totalMinutes = baseMinutesWorked % 60;
    const totalLateHours = Math.floor(totalLateMinutes / 60);
    const totalLateMinutesRemainder = totalLateMinutes % 60;
    const additionalHours = Math.floor(additionalMinutes / 60);
    
    return { total, onTime, late, totalLateMinutes, totalLateHours, totalLateMinutesRemainder, totalHours, totalMinutes, additionalHours };
  };

  const handleAdminCheckIn = async () => {
    const phTime = toZonedTime(new Date(), 'Asia/Manila');
    const timeIn = format(phTime, 'hh:mm a');
    const date = format(phTime, 'yyyy-MM-dd');
    try {
      await axios.post(`${API}/admin/checkin/${selectedIntern.id}`, 
        { time_in: timeIn, date },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAlert({ type: 'success', title: 'Success', message: 'Check-in successful' });
      await fetchAllAttendance();
      await fetchInternAttendance(selectedIntern.id);
      setShowAdminModal(false);
    } catch (err) {
      setAlert({ type: 'error', title: 'Error', message: err.response?.data?.error || 'Failed to check in' });
    }
  };

  const handleAdminCheckOut = async (attendanceId) => {
    const phTime = toZonedTime(new Date(), 'Asia/Manila');
    const timeOut = format(phTime, 'hh:mm a');
    try {
      await axios.put(`${API}/admin/checkout/${attendanceId}`, 
        { time_out: timeOut },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAlert({ type: 'success', title: 'Success', message: 'Check-out successful' });
      await fetchAllAttendance();
      await fetchInternAttendance(selectedIntern.id);
      setShowAdminModal(false);
    } catch (err) {
      setAlert({ type: 'error', title: 'Error', message: err.response?.data?.error || 'Failed to check out' });
    }
  };

  return (
    <>
      {alert && (
        <Alert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
      
      {showPrintView ? (
        <PrintAttendance
          token={token}
          internId={selectedIntern.id}
          internName={selectedIntern.full_name}
          filterType={printFilter}
          selectedDate={printDate}
          onClose={() => setShowPrintView(false)}
        />
      ) : (
    <div className="dashboard">
      <div className="welcome">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2>Intern Reports</h2>
            <p>View attendance reports for all interns</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedInternId}
              onChange={(e) => {
                setSelectedInternId(e.target.value);
                if (e.target.value) {
                  const intern = interns.find(i => i.id === e.target.value);
                  setSelectedIntern(intern);
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#00273C',
                color: '#e8eaed',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                borderRadius: '6px',
                fontSize: '0.85rem',
                minWidth: '200px',
                cursor: 'pointer'
              }}
            >
              <option value="">Select Intern...</option>
              {interns.map(intern => (
                <option key={intern.id} value={intern.id}>{intern.full_name}</option>
              ))}
            </select>
            <select
              value={printFilter}
              onChange={(e) => setPrintFilter(e.target.value)}
              disabled={!selectedInternId}
              style={{
                padding: '0.5rem',
                background: '#00273C',
                color: '#e8eaed',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: selectedInternId ? 'pointer' : 'not-allowed',
                opacity: selectedInternId ? 1 : 0.5
              }}
            >
              <option value="all">All Time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            {(printFilter === 'daily' || printFilter === 'weekly') && (
              <input
                type="date"
                value={printDate}
                onChange={(e) => setPrintDate(e.target.value)}
                disabled={!selectedInternId}
                style={{
                  padding: '0.5rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 113, 32, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  cursor: selectedInternId ? 'pointer' : 'not-allowed',
                  opacity: selectedInternId ? 1 : 0.5
                }}
              />
            )}
            <button
              onClick={() => setShowPrintView(true)}
              disabled={!selectedInternId}
              style={{
                background: selectedInternId ? '#28a745' : '#6c757d',
                border: 'none',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: selectedInternId ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem',
                fontWeight: '600',
                opacity: selectedInternId ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Printer size={16} />
              Print
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {loading ? (
          [...Array(6)].map((_, i) => <CardSkeleton key={i} />)
        ) : interns.length === 0 ? (
          <div className="checkin-form">
            <p style={{ textAlign: 'center', color: '#6b7280' }}>No interns found. Make sure you're logged in as a coordinator.</p>
          </div>
        ) : (
          interns
            .filter(intern => !selectedInternId || intern.id === selectedInternId)
            .map(intern => {
            const stats = calculateStats(intern.id);
            return (
              <div
                key={intern.id}
                className="checkin-form"
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: selectedIntern?.id === intern.id ? '2px solid #FF7120' : '2px solid transparent',
                  transform: 'scale(1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 113, 32, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onClick={() => fetchInternAttendance(intern.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  {intern.profile_picture ? (
                    <img
                      src={intern.profile_picture}
                      alt={intern.full_name}
                      loading="lazy"
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #FF7120'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FF7120, #e66310)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      color: 'white'
                    }}>
                      {intern.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{intern.full_name}</h3>
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Intern</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ background: '#00273C', padding: '0.75rem', borderRadius: '8px' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Total Days</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{stats.total}</p>
                  </div>
                  <div style={{ background: '#00273C', padding: '0.75rem', borderRadius: '8px' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Total Hours</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#FF7120', margin: 0 }}>
                      {stats.totalHours}h {stats.totalMinutes}m
                      {stats.additionalHours > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#28a745', marginLeft: '0.5rem' }}>
                          +{stats.additionalHours}h
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ background: '#00273C', padding: '0.75rem', borderRadius: '8px' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>On-Time</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#FF7120', margin: 0 }}>{stats.onTime}</p>
                  </div>
                  <div style={{ background: '#00273C', padding: '0.75rem', borderRadius: '8px' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Late</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ff9d5c', margin: 0 }}>{stats.late}</p>
                  </div>
                  <div style={{ background: '#00273C', padding: '0.75rem', borderRadius: '8px', gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Total Late</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ff9d5c', margin: 0 }}>
                      {stats.totalLateHours}h {stats.totalLateMinutesRemainder}m 
                      <span style={{ fontSize: '0.85rem', color: '#6b7280', marginLeft: '0.5rem' }}>({stats.totalLateMinutes}m)</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && selectedIntern && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{
            background: '#001f35',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflow: 'hidden',
            border: '1px solid rgba(255, 113, 32, 0.2)'
          }}>
            <div style={{
              padding: '2rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ color: '#ffffff', margin: 0 }}>{selectedIntern.full_name}'s Attendance Records</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button 
                  onClick={() => {
                    setAdminAction({ type: 'checkin', record: null });
                    setShowAdminModal(true);
                  }}
                  style={{
                    background: '#FF7120',
                    border: 'none',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                >
                  + Check In
                </button>
                <button 
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#FF7120',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    padding: '0.5rem'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div style={{ padding: '2rem', maxHeight: '70vh', overflow: 'auto' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {attendance.map(record => {
                  const isExpanded = expandedRecords[record.date];
                  const metrics = calculateRecordMetrics(record);
                  return (
                  <div key={record.date} style={{
                    background: '#00273C',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s'
                  }}>
                    {/* Header with toggle and photos */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {record.morning_photo && (
                            <div style={{ textAlign: 'center' }}>
                              <img
                                src={record.morning_photo}
                                alt="Morning"
                                style={{
                                  width: '50px',
                                  height: '50px',
                                  borderRadius: '8px',
                                  objectFit: 'cover',
                                  border: '2px solid #FF7120',
                                  cursor: 'pointer'
                                }}
                                onClick={() => window.open(record.morning_photo, '_blank')}
                              />
                              <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>AM</div>
                            </div>
                          )}
                          {record.afternoon_photo && (
                            <div style={{ textAlign: 'center' }}>
                              <img
                                src={record.afternoon_photo}
                                alt="Afternoon"
                                style={{
                                  width: '50px',
                                  height: '50px',
                                  borderRadius: '8px',
                                  objectFit: 'cover',
                                  border: '2px solid #FF7120',
                                  cursor: 'pointer'
                                }}
                                onClick={() => window.open(record.afternoon_photo, '_blank')}
                              />
                              <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>PM</div>
                            </div>
                          )}
                          {record.ot_photo && (
                            <div style={{ textAlign: 'center' }}>
                              <img
                                src={record.ot_photo}
                                alt="Overtime"
                                style={{
                                  width: '50px',
                                  height: '50px',
                                  borderRadius: '8px',
                                  objectFit: 'cover',
                                  border: '2px solid #FF7120',
                                  cursor: 'pointer'
                                }}
                                onClick={() => window.open(record.ot_photo, '_blank')}
                              />
                              <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>OT</div>
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 style={{ color: '#ffffff', margin: 0, fontSize: '1.1rem' }}>
                            {new Date(record.date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </h4>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            marginTop: '4px',
                            background: record.work_mode === 'online' ? 'rgba(100, 150, 255, 0.1)' : 'rgba(255, 113, 32, 0.1)',
                            color: record.work_mode === 'online' ? '#6496ff' : '#FF7120',
                            border: `1px solid ${record.work_mode === 'online' ? 'rgba(100, 150, 255, 0.3)' : 'rgba(255, 113, 32, 0.3)'}`
                          }}>
                            {record.work_mode === 'online' ? '💻 Online' : '🏢 Onsite'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedRecords(prev => ({ ...prev, [record.date]: !prev[record.date] }))}
                        className="view-details-btn"
                        style={{
                          background: 'transparent',
                          border: '1px solid #FF7120',
                          color: '#FF7120',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        {isExpanded ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="18 15 12 9 6 15"></polyline>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        )}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#28a745', fontWeight: '600' }}>
                        Total: {metrics.hours}h {metrics.minutes}m
                      </span>
                      {metrics.lateMinutes > 0 && (
                        <span style={{ fontSize: '0.85rem', color: '#ff9d5c', fontWeight: '600' }}>
                          Late: {metrics.lateMinutes}m
                        </span>
                      )}
                    </div>
                    
                    {isExpanded && (
                    <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Morning In</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{formatTime(record.morning_time_in) || '-'}</p>
                      </div>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Morning Out</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{capTimeOut(record.morning_time_out, 'Morning') || '-'}</p>
                      </div>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Afternoon In</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{formatTime(record.afternoon_time_in) || '-'}</p>
                      </div>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Afternoon Out</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{capTimeOut(record.afternoon_time_out, 'Afternoon') || '-'}</p>
                      </div>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>OT In</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{formatTime(record.ot_time_in) || '-'}</p>
                      </div>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>OT Out</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{capTimeOut(record.ot_time_out, 'Overtime') || '-'}</p>
                      </div>
                    </div>


                    
                    {record.work_documentation && (
                      <div style={{ background: '#001a2b', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 113, 32, 0.2)', marginBottom: '1rem' }}>
                        <p style={{ fontSize: '0.75rem', color: '#FF7120', margin: '0 0 0.5rem 0', fontWeight: '600' }}>Work Documentation</p>
                        <div 
                          className="work-doc-content"
                          style={{ fontSize: '0.9rem', color: '#e8eaed', lineHeight: '1.6', maxHeight: '400px', overflowY: 'auto' }}
                          dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(record.work_documentation) }}
                        />
                      </div>
                    )}

                    {record.attachments && record.attachments.length > 0 && (
                      <div style={{ background: '#001a2b', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 113, 32, 0.2)' }}>
                        <p style={{ fontSize: '0.75rem', color: '#FF7120', margin: '0 0 0.75rem 0', fontWeight: '600' }}>Attachments</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {record.attachments.map((url, idx) => {
                            const fileName = url.split('/').pop().split('?')[0];
                            const decodedName = decodeURIComponent(fileName);
                            const ext = fileName.split('.').pop().toLowerCase();
                            const getFileIcon = (extension) => {
                              if (['png', 'jpg', 'jpeg'].includes(extension)) return '🖼️';
                              if (['pdf'].includes(extension)) return '📄';
                              if (['doc', 'docx'].includes(extension)) return '📝';
                              if (['xls', 'xlsx'].includes(extension)) return '📊';
                              if (['txt'].includes(extension)) return '📃';
                              return '📎';
                            };
                            return (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={decodedName}
                                style={{
                                  color: '#FF7120',
                                  textDecoration: 'none',
                                  fontSize: '0.9rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '0.5rem 0.75rem',
                                  background: 'rgba(255, 113, 32, 0.1)',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255, 113, 32, 0.2)',
                                  transition: 'all 0.2s',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 113, 32, 0.2)';
                                  e.currentTarget.style.borderColor = '#FF7120';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 113, 32, 0.1)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 113, 32, 0.2)';
                                }}
                              >
                                <span style={{ fontSize: '1.2rem' }}>{getFileIcon(ext)}</span>
                                <span style={{ flex: 1 }}>{decodedName}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    </>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            background: '#001f35',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            border: '1px solid rgba(255, 113, 32, 0.2)'
          }}>
            <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>
              {adminAction.type === 'checkin' ? 'Manual Check-In' : 'Manual Check-Out'}
            </h3>
            <p style={{ color: '#a0a4a8', marginBottom: '1.5rem' }}>
              {adminAction.type === 'checkin' 
                ? `Check in ${selectedIntern?.full_name} for today?`
                : `Check out ${selectedIntern?.full_name} for this session?`
              }
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => adminAction.type === 'checkin' ? handleAdminCheckIn() : handleAdminCheckOut(adminAction.record.id)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#FF7120',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowAdminModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'transparent',
                  color: '#FF7120',
                  border: '1px solid #FF7120',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )}
    </>
  );
}

export default Reports;
