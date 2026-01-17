import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Reports({ token }) {
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

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
        alert('Access denied. Your account role must be "coordinator" in the database.');
      } else if (error.response?.status === 401) {
        alert('Session expired. Please log out and log in again.');
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

  const fetchInternAttendance = async (internId) => {
    const filtered = allAttendance.filter(a => a.user_id === internId);
    setAttendance(filtered);
    setSelectedIntern(interns.find(i => i.id === internId));
    setShowModal(true);
  };

  const calculateStats = (internId) => {
    const internAttendance = allAttendance.filter(a => a.user_id === internId);
    const total = internAttendance.length;
    const onTime = internAttendance.filter(a => a.status === 'On-Time').length;
    const late = internAttendance.filter(a => a.status === 'Late').length;
    const totalLateHours = internAttendance.reduce((sum, a) => sum + (a.late_deduction_hours || 0), 0);
    
    // Calculate total work hours (8 hours per day minus late deductions)
    const totalHours = (total * 8) - totalLateHours;
    
    return { total, onTime, late, totalLateHours, totalHours };
  };

  return (
    <div className="dashboard">
      <div className="welcome">
        <h2>Intern Reports</h2>
        <p>View attendance reports for all interns</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {loading ? (
          <div className="checkin-form">
            <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading interns...</p>
          </div>
        ) : interns.length === 0 ? (
          <div className="checkin-form">
            <p style={{ textAlign: 'center', color: '#6b7280' }}>No interns found. Make sure you're logged in as a coordinator.</p>
          </div>
        ) : (
          interns.map(intern => {
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
                    <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#FF7120', margin: 0 }}>{stats.totalHours}h</p>
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
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>Late Deductions</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{stats.totalLateHours}h</p>
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
            <div style={{ padding: '2rem', maxHeight: '70vh', overflow: 'auto' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {attendance.map(record => (
                  <div key={record.id} style={{
                    background: '#00273C',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <h4 style={{ color: '#ffffff', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                          {new Date(record.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </h4>
                        <span className={`status-badge ${record.status === 'On-Time' ? 'status-ontime' : 'status-late'}`}>
                          {record.status}
                        </span>
                      </div>
                      {record.photo_path && (
                        <img
                          src={record.photo_path}
                          alt="Check-in"
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '8px',
                            objectFit: 'cover',
                            border: '2px solid #FF7120',
                            cursor: 'pointer'
                          }}
                          onClick={() => window.open(record.photo_path, '_blank')}
                        />
                      )}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Time In</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{record.time_in || '-'}</p>
                      </div>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Time Out</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{record.time_out || '-'}</p>
                      </div>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>OT In</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{record.ot_time_in || '-'}</p>
                      </div>
                      <div style={{ background: '#001a2b', padding: '0.75rem', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>OT Out</p>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#e8eaed', margin: 0 }}>{record.ot_time_out || '-'}</p>
                      </div>
                      {record.late_deduction_hours > 0 && (
                        <div style={{ background: '#2d1b1b', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 157, 92, 0.3)' }}>
                          <p style={{ fontSize: '0.75rem', color: '#ff9d5c', margin: '0 0 0.25rem 0' }}>Late Deduction</p>
                          <p style={{ fontSize: '1rem', fontWeight: '600', color: '#ff9d5c', margin: 0 }}>{record.late_deduction_hours}h</p>
                        </div>
                      )}
                    </div>
                    
                    {record.work_documentation && (
                      <div style={{ background: '#001a2b', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 113, 32, 0.2)' }}>
                        <p style={{ fontSize: '0.75rem', color: '#FF7120', margin: '0 0 0.5rem 0', fontWeight: '600' }}>Work Documentation</p>
                        <p style={{ fontSize: '0.9rem', color: '#e8eaed', margin: 0, lineHeight: '1.5' }}>
                          {record.work_documentation}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
