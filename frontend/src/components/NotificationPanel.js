import React, { useState } from 'react';
import { Clock, CheckCircle, Settings, Inbox } from 'lucide-react';

function NotificationPanel({ notifications, onNotificationClick, onMarkAllRead }) {
  const [activeTab, setActiveTab] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = {
    all: { label: 'All', Icon: Inbox },
    overtime: { label: 'Overtime', Icon: Clock },
    attendance: { label: 'Attendance', Icon: CheckCircle },
    system: { label: 'System', Icon: Settings }
  };

  const getCategoryFromType = (type) => {
    if (type.includes('ot_')) return 'overtime';
    if (type.includes('checkout') || type.includes('attendance')) return 'attendance';
    return 'system';
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesTab = activeTab === 'all' || 
                      (activeTab === 'unread' && !n.is_read) ||
                      (activeTab === 'read' && n.is_read);
    const matchesCategory = activeCategory === 'all' || getCategoryFromType(n.type) === activeCategory;
    return matchesTab && matchesCategory;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{ 
      width: '100%',
      maxWidth: '450px', 
      maxHeight: '600px', 
      display: 'flex', 
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid rgba(255,113,32,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            style={{
              background: 'none',
              border: 'none',
              color: '#FF7120',
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              whiteSpace: 'nowrap'
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid rgba(255,113,32,0.1)',
        flexWrap: 'wrap'
      }}>
        {['all', 'unread', 'read'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'rgba(255,113,32,0.1)' : 'transparent',
              border: activeTab === tab ? '1px solid #FF7120' : '1px solid transparent',
              color: activeTab === tab ? '#FF7120' : '#a0a4a8',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s',
              textTransform: 'capitalize',
              flex: '1 1 auto',
              minWidth: 'fit-content'
            }}
          >
            {tab} {tab === 'unread' && unreadCount > 0 && `(${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Categories */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid rgba(255,113,32,0.1)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {Object.entries(categories).map(([key, { label, Icon }]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            style={{
              background: activeCategory === key ? 'rgba(255,113,32,0.15)' : 'rgba(255,255,255,0.05)',
              border: 'none',
              color: activeCategory === key ? '#FF7120' : '#a0a4a8',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        maxHeight: '400px',
        minHeight: '200px'
      }}>
        {filteredNotifications.length === 0 ? (
          <div style={{ 
            padding: '2rem 1rem', 
            textAlign: 'center',
            color: '#a0a4a8',
            fontSize: '0.9rem'
          }}>
            {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
          </div>
        ) : (
          filteredNotifications.map(item => (
            <div
              key={item.id}
              onClick={() => onNotificationClick(item)}
              style={{
                padding: '0.875rem 1rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                background: item.is_read ? 'transparent' : 'rgba(255,113,32,0.05)',
                transition: 'background 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,113,32,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = item.is_read ? 'transparent' : 'rgba(255,113,32,0.05)'}
            >
              {!item.is_read && (
                <div style={{
                  position: 'absolute',
                  left: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#FF7120'
                }} />
              )}
              <div style={{ 
                marginLeft: !item.is_read ? '1rem' : '0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <div style={{ 
                  color: '#fff', 
                  fontSize: '0.9rem',
                  fontWeight: item.is_read ? 'normal' : '500'
                }}>
                  {item.title}
                </div>
                <div style={{ 
                  color: '#a0a4a8', 
                  fontSize: '0.85rem',
                  lineHeight: '1.4'
                }}>
                  {item.message}
                </div>
                <div style={{ 
                  color: '#6b7280', 
                  fontSize: '0.75rem',
                  marginTop: '0.25rem'
                }}>
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationPanel;
