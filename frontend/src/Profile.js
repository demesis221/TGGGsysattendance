import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Alert from './components/Alert';
import { CardSkeleton } from './components/SkeletonLoader';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Profile({ token, user, onLogout }) {
  const [profile, setProfile] = useState({ full_name: '', email: '' });
  const [profilePic, setProfilePic] = useState(null);
  const [alert, setAlert] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [password, setPassword] = useState({ new: '', confirm: '' });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

  const showAlert = (type, title, message) => {
    setAlert({ type, title, message });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchAttendanceHours()]);
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseHours = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(' ');
    // Handles "HH:MM AM/PM" and also "HH:MM" or "HH:MM:SS" 24-hour strings
    if (parts.length === 2) {
      const [time, meridiem] = parts;
      let [h, m] = time.split(':').map(Number);
      if (meridiem.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;
      return h + m / 60;
    }
    // Fallback: assume 24-hour "HH:MM" or "HH:MM:SS"
    const [hRaw, mRaw] = timeStr.split(':');
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h + m / 60;
  };

  const fetchAttendanceHours = async () => {
    try {
      const { data } = await axios.get(`${API}/attendance/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let total = 0;
      data.forEach(a => {
        const start = parseHours(a.time_in);
        const end = parseHours(a.time_out);
        let sessionHours = 0;
        
        // Calculate actual hours worked for this session
        if (start !== null && end !== null) {
          sessionHours = Math.max(0, end - start);
        }
        
        // Subtract late deduction for this session
        if (a.late_deduction_hours) {
          sessionHours = Math.max(0, sessionHours - a.late_deduction_hours);
        }
        
        total += sessionHours;
        
        // Add overtime hours if present
        if (a.ot_time_in && a.ot_time_out) {
          const otStart = parseHours(a.ot_time_in);
          const otEnd = parseHours(a.ot_time_out);
          if (otStart !== null && otEnd !== null) {
            total += Math.max(0, otEnd - otStart);
          }
        }
      });
      setTotalHours(total);
    } catch (err) {
      console.error('Failed to compute total hours', err);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data } = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const updateProfile = async () => {
    try {
      await axios.put(`${API}/profile`, profile, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('success', 'Profile Updated', 'Your profile has been updated successfully.');
      setIsEditing(false);
    } catch (err) {
      showAlert('error', 'Update Failed', 'Failed to update profile.');
    }
  };

  const uploadProfilePic = async () => {
    if (!profilePic) return;

    const formData = new FormData();
    formData.append('profile_pic', profilePic);

    try {
      await axios.post(`${API}/profile/picture`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      showAlert('success', 'Picture Updated', 'Profile picture updated successfully.');
      setProfilePic(null);
      fetchProfile();
    } catch (err) {
      showAlert('error', 'Upload Failed', 'Failed to upload profile picture.');
    }
  };

  const updatePassword = async () => {
    if (password.new !== password.confirm) {
      showAlert('error', 'Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (password.new.length < 6) {
      showAlert('error', 'Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    try {
      await axios.put(`${API}/profile/password`, { password: password.new }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('success', 'Password Set', 'Your password has been set successfully.');
      setPassword({ new: '', confirm: '' });
      setShowPasswordSection(false);
    } catch (err) {
      showAlert('error', 'Update Failed', err.response?.data?.error || 'Failed to set password.');
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
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {loading ? (
            <CardSkeleton />
          ) : (
          <div className="checkin-form">
            <h3>Profile Information</h3>
            
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: '#00273C',
                border: '3px solid #FF7120',
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {profile.profile_picture ? (
                  <img 
                    src={profile.profile_picture} 
                    alt="Profile" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF7120" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
              </div>
              
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setProfilePic(e.target.files[0])}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer'
                  }}
                  id="profile-pic-upload"
                />
                <label 
                  htmlFor="profile-pic-upload"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.5rem 1rem',
                    background: '#FF7120',
                    color: 'white',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                    <circle cx="12" cy="13" r="3"/>
                  </svg>
                  Change Picture
                </label>
              </div>
              
              {profilePic && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ color: '#FF7120', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    Selected: {profilePic.name}
                  </p>
                  <button 
                    onClick={uploadProfilePic}
                    style={{
                      background: '#FF7120',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Upload Picture
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem' }}>
                Full Name
              </label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                disabled={!isEditing}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: isEditing ? '#00273C' : '#001a2b',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem' }}>
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#001a2b',
                  color: '#6b7280',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem' }}>
                Role
              </label>
              <input
                type="text"
                value={user.role === 'coordinator' ? 'Head Coordinator' : 'Intern'}
                disabled
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#001a2b',
                  color: '#6b7280',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: '#00273C',
              borderRadius: '8px',
              border: '1px solid rgba(255, 113, 32, 0.2)',
              color: '#e8eaed',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#e8eaed' }}>Total Hours</h4>
                <p style={{ margin: 0, color: '#a0a4a8', fontSize: '0.9rem' }}>
                  Based on attendance, deductions, and overtime.
                </p>
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFB36B' }}>
                {totalHours.toFixed(2)} hrs
              </span>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#00273C', borderRadius: '8px', border: '1px solid rgba(255, 113, 32, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPasswordSection ? '1rem' : '0' }}>
                <div>
                  <h4 style={{ color: '#e8eaed', fontSize: '1rem', marginBottom: '0.25rem' }}>Password</h4>
                  <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>Set a password for your account</p>
                </div>
                <button
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent',
                    color: '#FF7120',
                    border: '1px solid rgba(255, 113, 32, 0.3)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {showPasswordSection ? 'Cancel' : 'Set Password'}
                </button>
              </div>

              {showPasswordSection && (
                <div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={password.new}
                      onChange={(e) => setPassword({ ...password, new: e.target.value })}
                      placeholder="Enter new password"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: '#001a2b',
                        color: '#e8eaed',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem' }}>
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={password.confirm}
                      onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                      placeholder="Confirm new password"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: '#001a2b',
                        color: '#e8eaed',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                  <button
                    onClick={updatePassword}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#FF7120',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      width: '100%'
                    }}
                  >
                    Update Password
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              {!isEditing ? (
                <>
                  <button 
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#FF7120',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Edit Profile
                  </button>
                  <button 
                    onClick={onLogout}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'transparent',
                      color: '#FF7120',
                      border: '1px solid rgba(255, 113, 32, 0.3)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255, 113, 32, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={updateProfile}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#FF7120',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      fetchProfile();
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'transparent',
                      color: '#a0a4a8',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
