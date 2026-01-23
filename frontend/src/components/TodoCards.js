import React from 'react';
import Icon from './Icon';

export const TaskCard = ({ todo, isCompleted, activeTab, userProfile, groups, isCoordinator, onToggle, onDelete, onConfirm, onReject, onConfirmCompletion, onRejectCompletion, disabled }) => {
  const isLeader = groups.find(g => g.id === todo.group_id)?.leader_id === userProfile?.id;
  
  return (
    <div key={todo.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: isCompleted ? 'rgba(0, 39, 60, 0.5)' : '#00273C', borderRadius: '8px', marginBottom: '0.75rem', border: `1px solid ${todo.pending_completion ? 'rgba(255, 165, 0, 0.5)' : todo.is_confirmed === false ? 'rgba(255, 193, 7, 0.5)' : isCompleted ? 'rgba(40, 167, 69, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`, opacity: todo.is_confirmed === false ? 0.8 : isCompleted ? 0.8 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <Icon name={isCompleted ? "checkCircle" : todo.pending_completion ? "clock" : "clipboard"} size={18} color={isCompleted ? "#28a745" : todo.pending_completion ? "#ffa500" : "#FF7120"} strokeWidth={2} style={{ marginTop: '0.2rem', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <span style={{ color: isCompleted ? '#6b7280' : todo.pending_completion ? '#ffa500' : '#e8eaed', textDecoration: isCompleted ? 'line-through' : 'none', fontSize: '0.95rem', fontWeight: '500', wordBreak: 'break-word', display: 'block' }}>
            {todo.task.replace(/\[.*?\]\s*/, '')}
          </span>
          {todo.description && (
            <p style={{ margin: '0.5rem 0 0 0', color: '#9ca3af', fontSize: '0.85rem', lineHeight: '1.4', wordBreak: 'break-word' }}>
              {todo.description}
            </p>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
        {todo.todo_type === 'assigned' && <span style={{ background: 'rgba(100, 149, 237, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#6495ED', fontWeight: '500' }}>Assigned Task</span>}
        {todo.todo_type === 'group' && todo.group && <span style={{ background: 'rgba(255, 113, 32, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>Group: {todo.group.name}</span>}
        {todo.todo_type === 'group' && todo.suggester && <span style={{ background: 'rgba(100, 100, 255, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>Suggested by: {todo.suggester.full_name}</span>}
        {todo.todo_type === 'assigned' && todo.assignee && <span style={{ background: 'rgba(100, 255, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>Assigned to: {todo.assignee.full_name}</span>}
        {todo.todo_type === 'assigned' && todo.assigner && <span style={{ background: 'rgba(255, 100, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>Assigned by: {todo.assigner.full_name}</span>}
        {todo.date_assigned && <span style={{ background: 'rgba(150, 150, 150, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>Date: {new Date(todo.date_assigned).toLocaleDateString()}</span>}
        {todo.start_date && <span style={{ background: 'rgba(52, 152, 219, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#3498db' }}>Start: {new Date(todo.start_date).toLocaleDateString()}</span>}
        {todo.deadline && <span style={{ background: 'rgba(231, 76, 60, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#e74c3c' }}>Deadline: {new Date(todo.deadline).toLocaleDateString()}</span>}
        {todo.is_confirmed === false && <span style={{ background: 'rgba(255, 193, 7, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#ffc107' }}>Pending Confirmation</span>}
        {todo.pending_completion && <span style={{ background: 'rgba(255, 165, 0, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#ffa500' }}>Pending Approval</span>}
        {isCompleted && <span style={{ background: 'rgba(40, 167, 69, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#28a745', fontWeight: '500' }}>Completed</span>}
      </div>
      {!isCompleted && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {activeTab === 'group' && todo.todo_type === 'group' && todo.is_confirmed === false && isLeader && (
            <>
              <button onClick={() => onConfirm(todo)} disabled={disabled} style={{ flex: 1, background: disabled ? '#6b7280' : '#28a745', border: 'none', color: 'white', padding: '0.65rem 1rem', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: disabled ? 0.6 : 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}><Icon name="check" size={14} color="white" strokeWidth={2} />Confirm Task</span>
              </button>
              <button onClick={() => { if (window.confirm('Are you sure you want to reject this suggested task? This will delete it.')) onDelete(todo.id); }} disabled={disabled} style={{ flex: 1, background: disabled ? '#6b7280' : '#dc3545', border: 'none', color: 'white', padding: '0.65rem 1rem', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: disabled ? 0.6 : 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}><Icon name="x" size={14} color="white" strokeWidth={2} />Reject</span>
              </button>
            </>
          )}
          {(((activeTab === 'group' || activeTab === 'team') && todo.todo_type === 'assigned' && todo.assigned_to === userProfile?.id) || (activeTab === 'personal' && todo.todo_type === 'personal')) && !todo.pending_completion && !todo.completed && (
            <button onClick={() => onToggle(todo.id, todo.completed)} disabled={disabled} style={{ flex: 1, background: disabled ? '#6b7280' : '#FF7120', border: 'none', color: 'white', padding: '0.65rem 1rem', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: disabled ? 0.6 : 1 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}><Icon name="check" size={14} color="white" strokeWidth={2} />Mark Complete</span>
            </button>
          )}
          {activeTab === 'group' && todo.todo_type === 'assigned' && todo.assigned_to === userProfile?.id && todo.pending_completion && (
            <button onClick={() => onRejectCompletion(todo.id)} disabled={disabled} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255, 165, 0, 0.5)', color: '#ffa500', padding: '0.65rem 1rem', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: disabled ? 0.6 : 1 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}><Icon name="x" size={14} color="#ffa500" strokeWidth={2} />Cancel</span>
            </button>
          )}
          {activeTab === 'group' && todo.todo_type === 'assigned' && todo.pending_completion && (todo.assigned_by === userProfile?.id || isCoordinator) && (
            <>
              <button onClick={() => onConfirmCompletion(todo.id)} disabled={disabled} style={{ flex: 1, background: disabled ? '#6b7280' : '#28a745', border: 'none', color: 'white', padding: '0.65rem 1rem', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: disabled ? 0.6 : 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}><Icon name="check" size={14} color="white" strokeWidth={2} />Confirm Completion</span>
              </button>
              <button onClick={() => onRejectCompletion(todo.id)} disabled={disabled} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#ef4444', padding: '0.65rem 1rem', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: disabled ? 0.6 : 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}><Icon name="x" size={14} color="#ef4444" strokeWidth={2} />Reject</span>
              </button>
            </>
          )}
          {((todo.todo_type === 'personal' && todo.user_id === userProfile?.id) || (todo.todo_type === 'group' && isLeader) || (todo.todo_type === 'assigned' && (todo.assigned_by === userProfile?.id || isCoordinator))) && activeTab !== 'group' && (
            <button onClick={() => onDelete(todo.id)} disabled={disabled} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.65rem 1rem', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: disabled ? 0.6 : 1 }}>Delete</button>
          )}
        </div>
      )}
    </div>
  );
};

export const MemberStats = ({ groups, userProfile, todos }) => {
  const leaderGroup = groups.find(g => g.leader_id === userProfile?.id);
  if (!leaderGroup || !leaderGroup.members || leaderGroup.members.length === 0) {
    return <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>No members in your group.</p>;
  }

  const allMembers = [{ user: leaderGroup.leader || userProfile }, ...(leaderGroup.members || [])].filter(m => m.user);
  const memberStats = allMembers.map(member => {
    const memberTodos = todos.filter(t => t.todo_type === 'assigned' && t.assigned_to === member.user?.id && t.assigned_by === userProfile?.id);
    return {
      id: member.user?.id,
      name: member.user?.full_name || 'Unknown',
      completed: memberTodos.filter(t => t.completed).length,
      pending: memberTodos.filter(t => t.pending_completion).length,
      ongoing: memberTodos.filter(t => !t.completed && !t.pending_completion && t.is_confirmed).length
    };
  });

  return memberStats.map(member => (
    <div key={member.id} style={{ padding: '0.75rem', background: '#00273C', borderRadius: '8px', marginBottom: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ color: '#e8eaed', fontWeight: '500' }}>{member.name}</span>
        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{member.ongoing} new</span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ background: 'rgba(40, 167, 69, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#28a745' }}>{member.completed} done</span>
        <span style={{ background: 'rgba(255, 165, 0, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#ffa500' }}>{member.pending} pending</span>
        <span style={{ background: 'rgba(255, 113, 32, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#FF7120' }}>{member.ongoing} ongoing</span>
      </div>
    </div>
  ));
};
