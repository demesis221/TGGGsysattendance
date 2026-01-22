import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, Clock, ListTodo, Bell } from 'lucide-react';
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import Dashboard from './Dashboard';
import Profile from './Profile';
import TodoList from './TodoList';
import Reports from './Reports';
import OvertimeForm from './OvertimeForm';
import OvertimeStatus from './OvertimeStatus';
import OvertimeRequests from './OvertimeRequests';
import NotificationPanel from './components/NotificationPanel';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [authView, setAuthView] = useState('login'); // 'login', 'forgot-password', 'reset-password'

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
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (token) {
      // Validate token immediately on mount
      validateAndFetchProfile();
      // Check token validity periodically
      const interval = setInterval(checkTokenValidity, 60000); // Check every minute
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const validateAndFetchProfile = async () => {
    try {
      await fetchUserProfile();
    } catch (err) {
      console.error('Token validation failed:', err);
      handleLogout();
    }
  };

  useEffect(() => {
    if (!token) return;
    const loadNotifications = async () => {
      try {
        const { data } = await axios.get(`${API}/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(data || []);
      } catch (err) {
        console.error('Notification load failed', err);
      }
    };
    loadNotifications();
    const interval = setInterval(loadNotifications, 30 * 1000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [token]);

  const checkTokenValidity = async () => {
    try {
      await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      if (err.response?.status === 401) {
        const rememberMe = localStorage.getItem('rememberMe');
        if (!rememberMe) {
          handleLogout();
        }
      }
    }
  };

  const fetchUserProfile = async () => {
    const { data } = await axios.get(`${API}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUserProfile(data);
  };

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    setAuthView('login');
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    setToken(null);
    setUser({});
    setCurrentPage('dashboard');
    setAuthView('login');
  };

  const handleNotificationClick = async (notification) => {
    try {
      await axios.put(`${API}/notifications/${notification.id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      if (notification.link) changePage(notification.link);
      setShowNotifMenu(false);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      await Promise.all(unreadIds.map(id => 
        axios.put(`${API}/notifications/${id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const changePage = (page) => {
    setCurrentPage(page);
    localStorage.setItem('currentPage', page);
    if (showOvertimeMenu) setShowOvertimeMenu(false);
  };

  // Handle URL-based routing for password reset
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/forgot-password') {
      setAuthView('forgot-password');
    } else if (path === '/reset-password') {
      setAuthView('reset-password');
    } else {
      setAuthView('login');
    }
  }, []);

  if (!token) {
    if (authView === 'forgot-password') {
      return <ForgotPassword onBack={() => { setAuthView('login'); window.history.pushState({}, '', '/'); }} />;
    }
    if (authView === 'reset-password') {
      return <ResetPassword onSuccess={() => { setAuthView('login'); window.history.pushState({}, '', '/'); }} />;
    }
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
      <div className="header" style={{ flexWrap: 'wrap', gap: '0.75rem', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', minWidth: '200px' }}>
          <img 
            src="/imgs/logostick.png" 
            alt="Triple G AOC Logo" 
            style={{ height: '32px', width: 'auto' }}
          />
          <h1 style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Triple<span style={{ color: '#FF7120', fontSize: '1.2em', fontWeight: '700' }}>G</span> AOC</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => changePage('dashboard')}
            style={{
              background: currentPage === 'dashboard' ? '#FF7120' : 'transparent',
              color: currentPage === 'dashboard' ? 'white' : '#FF7120',
              border: '1px solid rgba(255, 113, 32, 0.3)',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <LayoutDashboard size={16} />
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
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Clock size={16} />
                OT ▾
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
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Clock size={16} />
              OT Requests
            </button>
          )}
          {user.role === 'intern' && (
            <button 
              onClick={() => changePage('todos')}
              style={{
                background: currentPage === 'todos' ? '#FF7120' : 'transparent',
                color: currentPage === 'todos' ? 'white' : '#FF7120',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <ListTodo size={16} />
              Todo
            </button>
          )}
          
          {user.role === 'coordinator' && (
            <button 
              onClick={() => changePage('reports')}
              style={{
                background: currentPage === 'reports' ? '#FF7120' : 'transparent',
                color: currentPage === 'reports' ? 'white' : '#FF7120',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              Reports
            </button>
          )}

          {(user.role === 'intern' || user.role === 'coordinator') && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifMenu(prev => !prev)}
                title="Notifications"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 113, 32, 0.3)',
                  background: 'rgba(255, 113, 32, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FF7120',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#FF7120',
                    color: '#ffffff',
                    borderRadius: '999px',
                    padding: '0 5px',
                    fontSize: '10px',
                    fontWeight: '700',
                    lineHeight: '16px',
                    border: '1px solid rgba(0,0,0,0.15)',
                    minWidth: '16px',
                    textAlign: 'center'
                  }}>{unreadCount}</span>
                )}
              </button>
              {showNotifMenu && (
                <>
                  {/* Backdrop for mobile */}
                  <div 
                    onClick={() => setShowNotifMenu(false)}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.5)',
                      zIndex: 999,
                      display: window.innerWidth < 768 ? 'block' : 'none'
                    }}
                  />
                  <div className="header-dropdown-menu" style={{ 
                    position: window.innerWidth < 768 ? 'fixed' : 'absolute',
                    top: window.innerWidth < 768 ? '50%' : '110%',
                    right: window.innerWidth < 768 ? '1rem' : '0',
                    left: window.innerWidth < 768 ? '1rem' : 'auto',
                    transform: window.innerWidth < 768 ? 'translateY(-50%)' : 'none',
                    zIndex: 1000,
                    padding: 0,
                    width: window.innerWidth < 768 ? 'auto' : 'auto',
                    maxWidth: window.innerWidth < 768 ? 'calc(100vw - 2rem)' : '450px'
                  }}>
                    <NotificationPanel 
                      notifications={notifications}
                      onNotificationClick={handleNotificationClick}
                      onMarkAllRead={handleMarkAllRead}
                    />
                  </div>
                </>
              )}
            </div>
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
              width: '38px',
              height: '38px',
              transition: 'all 0.2s',
              boxShadow: currentPage === 'profile' ? '0 0 0 2px rgba(255, 113, 32, 0.2)' : 'none'
            }}
          >
            {userProfile?.profile_picture ? (
              <img 
                src={userProfile.profile_picture} 
                alt="Profile" 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FF7120, #e66310)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg 
                  width="18" 
                  height="18" 
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
