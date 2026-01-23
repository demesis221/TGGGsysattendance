import React from 'react';
import { Icon } from './Icon';

export const PersonalTab = ({ 
  ongoingTodos, 
  doneTodos, 
  renderStandardCard, 
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
  );
};
