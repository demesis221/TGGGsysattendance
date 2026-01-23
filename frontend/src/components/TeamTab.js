import React from 'react';
import { Icon } from './Icon';

export const TeamTab = ({ 
  ongoingTodos, 
  doneTodos, 
  renderStandardCard,
  filterText,
  setFilterText,
  filterMember,
  setFilterMember,
  groups,
  loading 
}) => {
  if (loading) return null;

  return (
    <>
      {/* Filter Bar */}
      <div style={{
        background: '#001f35',
        padding: '1rem',
        marginBottom: '1rem',
        borderRadius: '12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        alignItems: 'center',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <input
          type="text"
          placeholder="Search tasks..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            background: '#001219',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#e8eaed',
            fontSize: '0.9rem',
            height: '42px',
            boxSizing: 'border-box'
          }}
        />

        <div style={{ position: 'relative', width: '100%' }}>
          <select
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: '#001219',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#e8eaed',
              fontSize: '0.9rem',
              appearance: 'none',
              cursor: 'pointer',
              height: '42px',
              boxSizing: 'border-box'
            }}
          >
            <option value="">All Members</option>
            {(() => {
              const allUsers = groups.flatMap(g => {
                const members = (g.members || []).map(m => m.user);
                if (g.leader) members.push(g.leader);
                return members;
              });
              const uniqueUsers = allUsers.filter((u, i, self) => u && self.findIndex(t => t.id === u.id) === i);
              return uniqueUsers.map(user => (
                <option key={user.id} value={user.id}>{user.full_name}</option>
              ));
            })()}
          </select>
        </div>
      </div>

      {/* Tasks Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <div>
          <h3 style={{
            color: '#e8eaed',
            fontSize: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: '#001f35',
            padding: '1rem 0'
          }}>
            <Icon name="clock" size={16} color="#f5a524" strokeWidth={2} />
            Ongoing Tasks
            <span style={{ background: 'rgba(255, 113, 32, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem' }}>
              {ongoingTodos.length}
            </span>
          </h3>
          {ongoingTodos.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>
              No ongoing tasks for this date.
            </p>
          ) : (
            ongoingTodos.map(todo => renderStandardCard(todo, false))
          )}
        </div>

        <div>
          <h3 style={{
            color: '#e8eaed',
            fontSize: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: '#001f35',
            padding: '1rem 0'
          }}>
            <Icon name="checkCircle" size={16} color="#28a745" strokeWidth={2} />
            Done / Completed
            <span style={{ background: 'rgba(40, 167, 69, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', color: '#28a745' }}>
              {doneTodos.length}
            </span>
          </h3>
          {doneTodos.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>
              No completed tasks for this date.
            </p>
          ) : (
            doneTodos.map(todo => renderStandardCard(todo, true))
          )}
        </div>
      </div>
    </>
  );
};
