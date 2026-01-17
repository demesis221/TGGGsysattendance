import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './Login';
import Dashboard from './Dashboard';
import Profile from './Profile';
import TodoList from './TodoList';
import Reports from './Reports';
import OvertimeForm from './OvertimeForm';
import OvertimeStatus from './OvertimeStatus';
import OvertimeRequests from './OvertimeRequests';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [token, setToken] = useState(
    localStorage.getItem('token') || sessionStorage.getItem('token')
  );
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')
  );
  const [currentPage, setCurrentPage] = useState(localStorage.getItem('currentPage') || 'dashboard');
  const [userProfile, setUserProfile] = useState(null);
  const [showOvertimeMenu, setShowOvertimeMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (token) {
      fetchUserProfile();
      // Check token validity periodically
      const interval = setInterval(checkTokenValidity, 60000); // Check every minute
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const loadNotifications = async () => {
      try {
        const { data } = await axios.get(`${API}/attendance/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const today = new Date().toISOString().split('T')[0];
        const pendingCheckouts = data.filter(a => !a.time_out && a.date < today);
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        const otReminder = nowMinutes >= 14 * 60 + 30 && nowMinutes < 16 * 60;

        const items = [];
        if (pendingCheckouts.length > 0) {
          items.push({
            id: 'pending-checkout',
            title: 'Pending checkouts',
            detail: `${pendingCheckouts.length} older check-in(s) need checkout`
          });
        }
        if (otReminder && user.role === 'intern') {
          items.push({
            id: 'ot-reminder',
            title: 'OT reminder',
            detail: 'Submit overtime between 3:00 PM and 4:00 PM.'
          });
        }
        setNotifications(items);
      } catch (err) {
        console.error('Notification load failed', err);
      }
    };
    loadNotifications();
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, user.role]);

  const checkTokenValidity = async () => {
    try {
      await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      if (err.response?.status === 401) {
        // Token expired, check if remember me was enabled
        const rememberMe = localStorage.getItem('rememberMe');
        if (!rememberMe) {
          handleLogout();
          alert('Your session has expired. Please log in again.');
        }
      }
    }
  };

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

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    setToken(null);
    setUser({});
    setCurrentPage('dashboard');
  };

  const changePage = (page) => {
    setCurrentPage(page);
    localStorage.setItem('currentPage', page);
    if (showOvertimeMenu) setShowOvertimeMenu(false);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch(currentPage) {
      case 'profile':
        return <Profile token={token} user={user} onLogout={handleLogout} />;
      case 'todos':
        return <TodoList token={token} />;
      case 'reports':
        return <Reports token={token} />;
      case 'overtime-requests':
        return <OvertimeRequests token={token} />;
      case 'overtime-status':
        return <OvertimeStatus token={token} />;
      case 'overtime':
        return <OvertimeForm token={token} />;
      default:
        return <Dashboard token={token} user={user} onLogout={handleLogout} />;
    }
  };

  return (
    <div className="app">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img 
            src="/imgs/logostick.png" 
            alt="Triple G BuildHub Logo" 
            style={{ height: '40px', width: 'auto' }}
          />
          <h1>Triple<span style={{ color: '#FF7120', fontSize: '1.5rem', fontWeight: '700' }}>G</span> BuildHub - OJT Attendance</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={() => changePage('dashboard')}
            style={{
              background: currentPage === 'dashboard' ? '#FF7120' : 'transparent',
              color: currentPage === 'dashboard' ? 'white' : '#FF7120',
              border: '1px solid rgba(255, 113, 32, 0.3)',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            Dashboard
          </button>
          {user.role === 'intern' && (
            <div style={{ position: 'relative' }} className="header-dropdown">
              <button 
                onClick={() => setShowOvertimeMenu(prev => !prev)}
                style={{
                  background: (currentPage === 'overtime' || currentPage === 'overtime-status') ? '#FF7120' : 'transparent',
                  color: (currentPage === 'overtime' || currentPage === 'overtime-status') ? 'white' : '#FF7120',
                  border: '1px solid rgba(255, 113, 32, 0.3)',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s'
                }}
              >
                Overtime ▾
              </button>
              {showOvertimeMenu && (
                <div className="header-dropdown-menu">
                  <button
                    onClick={() => changePage('overtime')}
                    className={currentPage === 'overtime' ? 'active' : ''}
                  >
                    Overtime Form
                  </button>
                  <button
                    onClick={() => changePage('overtime-status')}
                    className={currentPage === 'overtime-status' ? 'active' : ''}
                  >
                    OT Request Status
                  </button>
                </div>
              )}
            </div>
          )}
          {user.role === 'coordinator' && (
            <button 
              onClick={() => changePage('overtime-requests')}
              style={{
                background: currentPage === 'overtime-requests' ? '#FF7120' : 'transparent',
                color: currentPage === 'overtime-requests' ? 'white' : '#FF7120',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              Overtime Requests
            </button>
          )}
          {user.role === 'intern' && (
            <button 
              onClick={() => changePage('todos')}
              style={{
                background: currentPage === 'todos' ? '#FF7120' : 'transparent',
                color: currentPage === 'todos' ? 'white' : '#FF7120',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              Todo List
            </button>
          )}
          {user.role === 'intern' && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifMenu(prev => !prev)}
                title="Notifications"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 113, 32, 0.3)',
                  background: 'rgba(255, 113, 32, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FF7120',
                  fontSize: '18px',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {notifications.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#FF7120',
                    color: '#ffffff',
                    borderRadius: '999px',
                    padding: '0 6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    lineHeight: '18px',
                    border: '1px solid rgba(0,0,0,0.15)'
                  }}>{notifications.length}</span>
                )}
              </button>
              {showNotifMenu && (
                <div className="header-dropdown-menu" style={{ right: '-60px', minWidth: '240px' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '0.75rem 1rem', color: '#a0a4a8' }}>No notifications</div>
                  ) : (
                    notifications.map(item => (
                      <div key={item.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#e8eaed' }}>
                        <div style={{ fontWeight: '700', marginBottom: '4px' }}>{item.title}</div>
                        <div style={{ fontSize: '0.9rem', color: '#a0a4a8' }}>{item.detail}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {user.role === 'coordinator' && (
            <button 
              onClick={() => changePage('reports')}
              style={{
                background: currentPage === 'reports' ? '#FF7120' : 'transparent',
                color: currentPage === 'reports' ? 'white' : '#FF7120',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              Reports
            </button>
          )}
          <button 
            onClick={() => changePage('profile')}
            style={{
              background: 'transparent',
              border: `2px solid ${currentPage === 'profile' ? '#FF7120' : 'rgba(255, 113, 32, 0.3)'}`,
              padding: '2px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              transition: 'all 0.2s',
              boxShadow: currentPage === 'profile' ? '0 0 0 2px rgba(255, 113, 32, 0.2)' : 'none'
            }}
          >
            {userProfile?.profile_picture ? (
              <img 
                src={userProfile.profile_picture} 
                alt="Profile" 
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FF7120, #e66310)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>
      <div style={{ paddingTop: 0 }}>
        {renderPage()}
      </div>
    </div>
  );
}

export default App;
