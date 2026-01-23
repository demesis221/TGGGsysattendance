import React from 'react';
import { Icon } from './Icon';

export const ManageTab = ({ 
  ongoingTodos, 
  renderStandardCard,
  todos,
  groups,
  userProfile,
  loading 
}) => {
  if (loading) return null;

  return (
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
          Pending Tasks
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
          <Icon name="team" size={16} color="#6495ED" strokeWidth={2} />
          Member Task Stats
        </h3>
        {(() => {
          const leaderGroup = groups.find(g => g.leader_id === userProfile?.id);
          if (!leaderGroup || !leaderGroup.members || leaderGroup.members.length === 0) {
            return (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>
                No members in your group.
              </p>
            );
          }

          const allMembers = [
            { user: leaderGroup.leader || userProfile },
            ...(leaderGroup.members || [])
          ].filter(m => m.user);

          const memberStats = allMembers.map(member => {
            const memberTodos = todos.filter(t =>
              t.todo_type === 'assigned' &&
              t.assigned_to === member.user?.id &&
              t.assigned_by === userProfile?.id
            );
            return {
              id: member.user?.id,
              name: member.user?.full_name || 'Unknown',
              total: memberTodos.length,
              completed: memberTodos.filter(t => t.completed).length,
              pending: memberTodos.filter(t => t.pending_completion).length,
              ongoing: memberTodos.filter(t => !t.completed && !t.pending_completion && t.is_confirmed).length
            };
          });

          return memberStats.map(member => (
            <div
              key={member.id}
              style={{
                padding: '0.75rem',
                background: '#00273C',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ color: '#e8eaed', fontWeight: '500' }}>{member.name}</span>
                <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{member.ongoing} new</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  background: 'rgba(40, 167, 69, 0.2)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: '#28a745'
                }}>
                  {member.completed} done
                </span>
                <span style={{
                  background: 'rgba(255, 165, 0, 0.2)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: '#ffa500'
                }}>
                  {member.pending} pending
                </span>
                <span style={{
                  background: 'rgba(255, 113, 32, 0.2)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: '#FF7120'
                }}>
                  {member.ongoing} ongoing
                </span>
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
};
