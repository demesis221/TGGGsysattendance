import React from 'react';

export const TabNavigation = ({ tabs, activeTab, setActiveTab, Icon }) => (
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', padding: '0.5rem', background: '#00273C', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
    <div style={{ display: 'flex', flex: '1 1 auto', gap: '0.5rem', flexWrap: 'wrap' }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: '1 1 auto', minWidth: '100px', padding: '0.75rem 1rem', background: activeTab === tab.id ? '#FF7120' : 'transparent', color: activeTab === tab.id ? 'white' : '#e8eaed', border: '1px solid rgba(255, 113, 32, 0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Icon name={tab.icon} size={16} color={activeTab === tab.id ? 'white' : '#a0a4a8'} strokeWidth={1.6} />
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);

export const ManagementButtons = ({ isLeader, isCoordinator, leaderHasGroup, onCreateGroup, onManageGroups, onManageLeaders, groups, Icon }) => {
  if (!isLeader) return null;
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      {(isCoordinator || (isLeader && !leaderHasGroup)) && (
        <button onClick={onCreateGroup} style={{ padding: '0.75rem 1rem', background: 'transparent', color: '#FF7120', border: '1px solid rgba(255, 113, 32, 0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon name="plus" size={16} color="#FF7120" />Create Group
        </button>
      )}
      {groups.length > 0 && (
        <button onClick={onManageGroups} style={{ padding: '0.75rem 1rem', background: 'transparent', color: '#FF7120', border: '1px solid rgba(255, 113, 32, 0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Manage Groups
        </button>
      )}
      {isCoordinator && (
        <button onClick={onManageLeaders} style={{ padding: '0.75rem 1rem', background: 'transparent', color: '#FF7120', border: '1px solid rgba(255, 113, 32, 0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon name="crown" size={16} color="#FF7120" />Manage Leaders
        </button>
      )}
    </div>
  );
};

export const Calendar = ({ show, selectedDate, setSelectedDate, changeMonth, Icon }) => {
  if (!show) return null;
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };
  const { firstDay, daysInMonth } = getDaysInMonth(selectedDate);
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  return (
    <div className="checkin-form todo-calendar" style={{ marginBottom: '1rem', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon name="calendar" size={22} color="#FF7120" strokeWidth={2.2} />Calendar
        </h3>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.35rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>‹</button>
          <button onClick={() => changeMonth(1)} style={{ background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.35rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>›</button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
        <span style={{ color: '#e8eaed', fontSize: '0.95rem', fontWeight: '500' }}>{monthName}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3rem', marginBottom: '0.5rem' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', padding: '0.3rem', fontWeight: '600' }}>{day}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3rem' }}>
        {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
          const isSelected = date.toDateString() === selectedDate.toDateString();
          const isToday = date.toDateString() === new Date().toDateString();
          return (
            <button key={day} onClick={() => setSelectedDate(date)} style={{ padding: '0.5rem', background: isSelected ? '#FF7120' : isToday ? 'rgba(255, 113, 32, 0.2)' : 'transparent', color: isSelected ? 'white' : '#e8eaed', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: isSelected || isToday ? '600' : '400', transition: 'all 0.2s', minWidth: 0 }}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const GroupInfo = ({ groups, userProfile, Icon }) => {
  const userGroup = groups.find(g => g.members?.some(m => m.user?.id === userProfile?.id) || g.leader_id === userProfile?.id);
  if (!userGroup) return null;
  
  return (
    <div style={{ marginBottom: '1rem', padding: '1rem', background: '#00273C', borderRadius: '12px', border: '1px solid rgba(255, 113, 32, 0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Icon name="team" size={22} color="#FF7120" strokeWidth={2} />
        <span style={{ fontSize: '1.15rem', color: '#FF7120', fontWeight: '700' }}>{userGroup.name}</span>
      </div>
      {userGroup.description && (
        <p style={{ fontSize: '0.9rem', color: '#a0a4a8', margin: '0 0 1rem 0', fontStyle: 'italic', lineHeight: '1.4' }}>"{userGroup.description}"</p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', borderRadius: '6px', color: '#ffc107', fontSize: '0.8rem', fontWeight: '500' }}>Leader:</span>
        <span style={{ color: '#e8eaed', fontSize: '0.9rem' }}>{userGroup.leader?.full_name || 'None'}</span>
      </div>
      <div>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.5rem 0', fontWeight: '500' }}>Team Members ({userGroup.members?.length || 0})</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {userGroup.members?.map(m => (
            <span key={m.user?.id || m.id} style={{ background: 'rgba(100, 149, 237, 0.15)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', color: '#6495ED' }}>
              {m.user?.full_name || 'Unknown'}
            </span>
          ))}
          {(!userGroup.members || userGroup.members.length === 0) && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>No members yet</span>}
        </div>
      </div>
    </div>
  );
};

export const TaskForm = ({ activeTab, isLeader, canAddTodo, dateTask, setDateTask, selectedAssignee, setSelectedAssignee, selectedDate, setSelectedDate, deadlineDate, setDeadlineDate, onSubmit, getGroupMembersForAssign }) => (
  <div className="checkin-form" style={{ marginTop: '1rem', padding: '1rem' }}>
    <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{activeTab === 'team' ? 'Suggest Task' : 'Add Task'}</h3>
    {canAddTodo ? (
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input type="text" value={dateTask} onChange={(e) => setDateTask(e.target.value)} placeholder={activeTab === 'assigned' ? 'Enter task to assign...' : 'Enter your task...'} style={{ width: '100%', padding: '0.75rem', background: '#001824', color: '#e8eaed', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }} required />
        {activeTab === 'group' && (
          <select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} style={{ width: '100%', padding: '0.75rem', background: '#001824', color: '#e8eaed', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }} required>
            <option value="">Select assignee...</option>
            {getGroupMembersForAssign().map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
          </select>
        )}
        {(activeTab === 'group' || activeTab === 'personal') && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', color: '#e8eaed', fontSize: '0.8rem' }}>Start Date</label>
              <input type="date" value={selectedDate ? new Date(selectedDate).toISOString().split('T')[0] : ''} onChange={(e) => setSelectedDate(new Date(e.target.value))} style={{ width: '100%', padding: '0.6rem', background: '#001824', color: '#e8eaed', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '0.9rem' }} required />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', color: '#e8eaed', fontSize: '0.8rem' }}>Deadline</label>
              <input type="date" value={deadlineDate ? new Date(deadlineDate).toISOString().split('T')[0] : ''} onChange={(e) => setDeadlineDate(new Date(e.target.value))} style={{ width: '100%', padding: '0.6rem', background: '#001824', color: '#e8eaed', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '0.9rem' }} required />
            </div>
          </div>
        )}
        <button type="submit" className="todo-add-btn" style={{ width: '100%', padding: '0.75rem' }}>
          {activeTab === 'team' ? 'Suggest Task' : activeTab === 'group' ? 'Assign Task' : 'Add Task'}
        </button>
      </form>
    ) : (
      <div style={{ padding: '0.75rem', background: 'rgba(255, 113, 32, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 113, 32, 0.2)' }}>
        <p style={{ margin: 0, color: '#e8eaed', fontSize: '0.9rem' }}>
          {activeTab === 'group' && (isLeader) && 'Leaders assign tasks via the Group tab.'}
          {activeTab === 'group' && !isLeader && 'You need to be in a group to add group tasks.'}
          {activeTab === 'assigned' && 'Only leaders and coordinators can assign tasks.'}
        </p>
      </div>
    )}
  </div>
);

export const TeamFilter = ({ filterText, setFilterText, filterMember, setFilterMember, groups, Icon }) => (
  <div style={{ background: '#001f35', padding: '1rem', marginBottom: '1rem', borderRadius: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
    <input type="text" placeholder="Search tasks..." value={filterText} onChange={(e) => setFilterText(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', background: '#001219', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#e8eaed', fontSize: '0.9rem', height: '42px', boxSizing: 'border-box' }} />
    <div style={{ position: 'relative', width: '100%' }}>
      <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', background: '#001219', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#e8eaed', fontSize: '0.9rem', appearance: 'none', cursor: 'pointer', height: '42px', boxSizing: 'border-box' }}>
        <option value="">All Members</option>
        {(() => {
          const allUsers = groups.flatMap(g => {
            const members = (g.members || []).map(m => m.user);
            if (g.leader) members.push(g.leader);
            return members;
          });
          const uniqueUsers = allUsers.filter((u, i, self) => u && self.findIndex(t => t.id === u.id) === i);
          return uniqueUsers.map(user => <option key={user.id} value={user.id}>{user.full_name}</option>);
        })()}
      </select>
      <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}>
        <Icon name="chevronDown" size={14} color="#a0a4a8" />
      </div>
    </div>
  </div>
);
