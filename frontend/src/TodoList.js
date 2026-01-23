import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CardSkeleton } from './components/SkeletonLoader';
import { CreateGroupModal, ManageGroupsModal, ManageLeadersModal, ConfirmTaskModal } from './components/modals/TodoModals';
import { TabNavigation, ManagementButtons, Calendar, GroupInfo, TaskForm, TeamFilter } from './components/TodoUI';
import { TaskCard, MemberStats } from './components/TodoCards';
import Icon from './components/Icon';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function TodoList({ token, user }) {
  const [todos, setTodos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [interns, setInterns] = useState([]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateTask, setDateTask] = useState('');
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('personal');
  const [userProfile, setUserProfile] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showManageGroupModal, setShowManageGroupModal] = useState(false);
  const [showLeaderModal, setShowLeaderModal] = useState(false);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  // Team Tab Filters
  const [filterText, setFilterText] = useState('');
  const [filterMember, setFilterMember] = useState('');

  const [deadlineDate, setDeadlineDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingTodo, setConfirmingTodo] = useState(null);
  const [confirmStartDate, setConfirmStartDate] = useState('');
  const [confirmDeadline, setConfirmDeadline] = useState('');
  const [confirmAssignee, setConfirmAssignee] = useState('');
  const [confirmTask, setConfirmTask] = useState('');


  const fetchUserProfile = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }, [token]);

  const fetchGroups = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(data);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  }, [token]);

  const fetchTodos = useCallback(async (tab = activeTab) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/todos?type=${tab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodos(data);
    } catch (err) {
      console.error('Failed to fetch todos:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, token]);

  const fetchAvailableUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/users/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableUsers(data);
    } catch (err) {
      console.error('Failed to fetch available users:', err);
    }
  }, [token]);

  const fetchInterns = useCallback(async () => {
    if (user?.role !== 'coordinator') return;
    try {
      const { data } = await axios.get(`${API}/users/interns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInterns(data);
    } catch (err) {
      console.error('Failed to fetch interns:', err);
    }
  }, [token, user?.role]);

  useEffect(() => {
    fetchUserProfile();
    fetchTodos(activeTab);
    fetchGroups();
    if (user?.role === 'coordinator' || userProfile?.is_leader) {
      fetchAvailableUsers();
    }
    if (user?.role === 'coordinator') {
      fetchInterns();
    }
    // eslint-disable-next-line
  }, [activeTab]);



  const isCoordinator = user?.role === 'coordinator';
  const isLeader = userProfile?.is_leader;
  const leaderHasGroup = groups.some(g => g.leader_id === userProfile?.id);

  const addDateTodo = async (e) => {
    e.preventDefault();
    if (!dateTask.trim()) return;

    try {
      const taskWithDate = `[${selectedDate.toLocaleDateString()}] ${dateTask}`;
      const todoData = {
        task: taskWithDate,
        todo_type: 'personal'
      };

      if (activeTab === 'team') {
        // Team tab: members suggest tasks (submitted as group todo, needs leader confirmation)
        const userGroupId = groups.find(g =>
          g.members?.some(m =>
            String(m.user?.id) === String(userProfile?.id) ||
            String(m.user_id) === String(userProfile?.id)
          ) || String(g.leader_id) === String(userProfile?.id)
        )?.id;

        if (userGroupId) {
          todoData.todo_type = 'group';
          todoData.group_id = userGroupId;
        }
      } else if (activeTab === 'group' && isLeader) {
        // Group tab (Manage): leader creates assigned tasks with dates
        const leaderGroupId = groups.find(g => g.leader_id === userProfile?.id)?.id;

        if (selectedAssignee) {
          todoData.todo_type = 'assigned';
          todoData.assigned_to = selectedAssignee;
        } else if (leaderGroupId) {
          todoData.todo_type = 'group';
          todoData.group_id = leaderGroupId;
        }
      }

      // Add dates if they exist (for Personal and Manage tabs)
      if (selectedDate) {
        todoData.start_date = selectedDate.toISOString().split('T')[0];
      }
      if (deadlineDate) {
        todoData.deadline = deadlineDate.toISOString().split('T')[0];
      }

      await axios.post(`${API}/todos`, todoData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDateTask('');
      setSelectedAssignee('');
      await fetchTodos(activeTab);
    } catch (error) {
      console.error('Error adding task:', error);
      alert(error.response?.data?.error || 'Failed to add task.');
    }
  };

  const toggleTodo = async (id, completed) => {
    try {
      await axios.put(`${API}/todos/${id}`, { completed: !completed }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update task.');
    }
  };

  const deleteTodo = async (id) => {
    try {
      await axios.delete(`${API}/todos/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete task.');
    }
  };

  const openConfirmModal = (todo) => {
    setConfirmingTodo(todo);
    setConfirmTask(todo.task.replace(/\[.*?\]\s*/, '')); // Remove date prefix
    setConfirmStartDate(new Date().toISOString().split('T')[0]);
    setConfirmDeadline('');
    setConfirmAssignee('');
    setShowConfirmModal(true);
  };

  const submitConfirmTodo = async () => {
    if (!confirmingTodo) return;
    try {
      await axios.post(`${API}/todos/${confirmingTodo.id}/confirm`, {
        task: `[${selectedDate.toLocaleDateString()}] ${confirmTask}`,
        start_date: confirmStartDate || null,
        deadline: confirmDeadline || null,
        assigned_to: confirmAssignee || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowConfirmModal(false);
      setConfirmingTodo(null);
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to confirm task.');
    }
  };



  const confirmCompletion = async (id) => {
    try {
      await axios.post(`${API}/todos/${id}/confirm-completion`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to confirm completion.');
    }
  };

  const rejectCompletion = async (id) => {
    try {
      await axios.post(`${API}/todos/${id}/reject-completion`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to reject completion.');
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    if (isLeader && leaderHasGroup) {
      alert('You already lead a group. Leaders can only own one group.');
      return;
    }
    try {
      await axios.post(`${API}/groups`, {
        name: newGroupName,
        description: newGroupDesc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowGroupModal(false);
      fetchGroups();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create group.');
    }
  };

  const addMemberToGroup = async (groupId, userId) => {
    try {
      await axios.post(`${API}/groups/${groupId}/members`, { user_id: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroups();
      fetchAvailableUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add member.');
    }
  };

  const removeMemberFromGroup = async (groupId, userId) => {
    try {
      await axios.delete(`${API}/groups/${groupId}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroups();
      fetchAvailableUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to remove member.');
    }
  };

  const deleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group? All group todos will be deleted.')) {
      return;
    }
    try {
      await axios.delete(`${API}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroups();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete group.');
    }
  };

  const toggleLeader = async (userId, isCurrentlyLeader) => {
    try {
      const endpoint = isCurrentlyLeader ? 'remove-leader' : 'make-leader';
      await axios.post(`${API}/users/${userId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInterns();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update leader status.');
    }
  };



  const changeMonth = (offset) => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
  };

  const getFilteredTodos = () => {
    let filtered = todos;

    // Only apply date filter for non-Team tabs
    if (activeTab !== 'team') {
      const dateStr = selectedDate.toLocaleDateString();
      filtered = filtered.filter(todo => todo.task.includes(`[${dateStr}]`));
    }



    // Apply Team Tab Filters
    if (activeTab === 'team') {
      if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        filtered = filtered.filter(todo => todo.task.toLowerCase().includes(lowerFilter));
      }
      if (filterMember) {
        filtered = filtered.filter(todo =>
          (todo.assignee?.id && String(todo.assignee.id) === String(filterMember)) ||
          (todo.suggester?.id && String(todo.suggester.id) === String(filterMember))
        );
      }
    }

    return filtered;
  };

  const canAddTodo = () => {
    if (activeTab === 'personal') return true;
    // Team tab: only members can suggest tasks (leaders use Manage tab)
    if (activeTab === 'team') return !isLeader && groups.length > 0;
    // Group tab (Manage): only leaders can add/assign tasks
    if (activeTab === 'group') return isLeader && leaderHasGroup;
    return false;
  };

  const canEditTodo = (todo) => {
    if (todo.todo_type === 'personal') return todo.user_id === userProfile?.id;
    if (todo.todo_type === 'group') {
      const group = groups.find(g => g.id === todo.group_id);
      return group?.leader_id === userProfile?.id;
    }
    if (todo.todo_type === 'assigned') {
      return todo.assigned_by === userProfile?.id || isCoordinator;
    }
    return false;
  };

  const canDeleteTodo = (todo) => {
    return canEditTodo(todo);
  };



  const getGroupMembersForAssign = () => {
    if (isCoordinator) {
      return interns;
    }
    const myGroups = groups.filter(g => g.leader_id === userProfile?.id);
    const members = [];
    // Add the leader themselves first (for self-assign)
    if (userProfile && isLeader) {
      members.push({ id: userProfile.id, full_name: `${userProfile.full_name} (Myself)` });
    }
    myGroups.forEach(g => {
      g.members?.forEach(m => {
        if (m.user && !members.find(mem => mem.id === m.user.id)) {
          members.push(m.user);
        }
      });
    });
    return members;
  };





  const filteredTodos = getFilteredTodos();
  const ongoingTodos = filteredTodos.filter(todo => !todo.completed);
  const doneTodos = filteredTodos.filter(todo => todo.completed);

  const tabs = [
    { id: 'personal', label: 'Personal', icon: 'user' },
    { id: 'team', label: 'Team', icon: 'team' },
    // Group tab only visible to leaders - shows pending suggestions and pending completions
    ...(isLeader ? [{ id: 'group', label: 'Manage', icon: 'clipboard' }] : [])
  ];

  // eslint-disable-next-line no-unused-vars
  const activeTabConfig = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <div className="dashboard" style={{ overflowX: 'hidden' }}>
      <TabNavigation tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} Icon={Icon} />
      {activeTab === 'group' && (
        <ManagementButtons isLeader={isLeader} isCoordinator={isCoordinator} leaderHasGroup={leaderHasGroup} onCreateGroup={() => { setShowGroupModal(true); fetchAvailableUsers(); }} onManageGroups={() => { setShowManageGroupModal(true); fetchAvailableUsers(); }} onManageLeaders={() => { setShowLeaderModal(true); fetchInterns(); }} groups={groups} Icon={Icon} />
      )}

      <div className="todo-layout" style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', flexWrap: 'wrap', maxWidth: '100%' }}>
        <div className="welcome todo-sidebar" style={{ flex: '1 1 300px', maxWidth: '350px', order: 1, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>
              {activeTabConfig.label} Todo List
            </h2>
            <button
              onClick={() => setShowCalendar(s => !s)}
              title="Toggle calendar"
              aria-label="Toggle calendar"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                color: '#FF7120',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.02em'
              }}
            >
              <Icon name="calendar" size={20} color="#FF7120" strokeWidth={2} />
            </button>
          </div>
          <p style={{ marginBottom: '1rem' }}>
            {activeTab === 'personal' && 'Your private tasks - only you can see these'}
            {activeTab === 'team' && 'Team tasks - ongoing and completed tasks from your group'}
            {activeTab === 'group' && 'Manage pending suggestions and task completions'}
          </p>

          <Calendar show={showCalendar} selectedDate={selectedDate} setSelectedDate={setSelectedDate} changeMonth={changeMonth} Icon={Icon} />

          {/* Message for leaders without groups */}
          {activeTab === 'group' && isLeader && !leaderHasGroup && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              background: 'rgba(255, 113, 32, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 113, 32, 0.3)',
              marginBottom: '1rem'
            }}>
              <Icon name="team" size={48} color="#FF7120" strokeWidth={1.5} />
              <h3 style={{ margin: '1rem 0 0.5rem', color: '#e8eaed' }}>Create a Group</h3>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                You need to create a group before you can manage team tasks.
              </p>
              <button
                onClick={() => { setShowGroupModal(true); fetchAvailableUsers(); }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#FF7120',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon name="plus" size={16} color="white" />
                  Create Group
                </span>
              </button>
            </div>
          )}



          {activeTab !== 'team' && (
            <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255, 113, 32, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 113, 32, 0.2)' }}>
              <p style={{ fontSize: '0.85rem', color: '#e8eaed', marginBottom: '0.5rem' }}>
                {activeTab === 'personal' && 'These tasks are private to you.'}
                {activeTab === 'group' && 'Team members can suggest tasks; leaders confirm before work starts.'}
              </p>
            </div>
          )}

          {activeTab === 'team' && groups.length > 0 && <GroupInfo groups={groups} userProfile={userProfile} Icon={Icon} />}

          {(activeTab !== 'team' || !isLeader) && (
            <TaskForm activeTab={activeTab} isLeader={isLeader} canAddTodo={canAddTodo()} dateTask={dateTask} setDateTask={setDateTask} selectedAssignee={selectedAssignee} setSelectedAssignee={setSelectedAssignee} selectedDate={selectedDate} setSelectedDate={setSelectedDate} deadlineDate={deadlineDate} setDeadlineDate={setDeadlineDate} onSubmit={addDateTodo} getGroupMembersForAssign={getGroupMembersForAssign} />
          )}
        </div>

        {/* Calendar card removed from center; calendar lives in the sidebar via icon toggle */}

        <div className="checkin-form todo-main" style={{ flex: '1 1 500px', order: 3, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', maxHeight: '650px', overflow: 'hidden' }}>
          {loading ? (
            <CardSkeleton />
          ) : (
            <>
              <h3 style={{ flexShrink: 0 }}>Tasks for {selectedDate.toLocaleDateString()}</h3>

              {activeTab === 'team' && <TeamFilter filterText={filterText} setFilterText={setFilterText} filterMember={filterMember} setFilterMember={setFilterMember} groups={groups} Icon={Icon} />}

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                {activeTab === 'assigned' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                    <div>
                      <h3 style={{ color: '#e8eaed', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Icon name="clock" size={16} color="#5ecda5" strokeWidth={2} />Ongoing Tasks<span style={{ background: 'rgba(255, 113, 32, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem' }}>{ongoingTodos.length}</span>
                      </h3>
                      {ongoingTodos.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>No ongoing assigned tasks for this date.</p>
                      ) : (
                        ongoingTodos.map(todo => <TaskCard key={todo.id} todo={todo} isCompleted={false} activeTab={activeTab} userProfile={userProfile} groups={groups} isCoordinator={isCoordinator} onToggle={toggleTodo} onDelete={deleteTodo} onConfirm={openConfirmModal} onReject={deleteTodo} onConfirmCompletion={confirmCompletion} onRejectCompletion={rejectCompletion} />)
                      )}
                    </div>
                    <div>
                      <h3 style={{ color: '#e8eaed', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Icon name="checkCircle" size={16} color="#28a745" strokeWidth={2} />Done / Completed<span style={{ background: 'rgba(40, 167, 69, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', color: '#28a745' }}>{doneTodos.length}</span>
                      </h3>
                      {doneTodos.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>No completed tasks for this date.</p>
                      ) : (
                        doneTodos.map(todo => <TaskCard key={todo.id} todo={todo} isCompleted={true} activeTab={activeTab} userProfile={userProfile} groups={groups} isCoordinator={isCoordinator} onToggle={toggleTodo} onDelete={deleteTodo} onConfirm={openConfirmModal} onReject={deleteTodo} onConfirmCompletion={confirmCompletion} onRejectCompletion={rejectCompletion} />)
                      )}
                    </div>
                  </div>
                ) : (
                  <>
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
                          {activeTab === 'group' ? 'Pending Tasks' : 'Ongoing Tasks'}
                          <span style={{ background: 'rgba(255, 113, 32, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem' }}>
                            {ongoingTodos.length}
                          </span>
                        </h3>
                      {ongoingTodos.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>No ongoing tasks for this date.</p>
                      ) : (
                        ongoingTodos.map(todo => <TaskCard key={todo.id} todo={todo} isCompleted={false} activeTab={activeTab} userProfile={userProfile} groups={groups} isCoordinator={isCoordinator} onToggle={toggleTodo} onDelete={deleteTodo} onConfirm={openConfirmModal} onReject={deleteTodo} onConfirmCompletion={confirmCompletion} onRejectCompletion={rejectCompletion} />)
                      )}
                      </div>

                      <div>
                        {activeTab === 'group' ? (
                          /* Manage Tab - Member Stats */
                          <>
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
                            <MemberStats groups={groups} userProfile={userProfile} todos={todos} />
                          </>
                        ) : (
                          /* Other Tabs - Done/Completed */
                          <>
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
                              <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>No completed tasks for this date.</p>
                            ) : (
                              doneTodos.map(todo => <TaskCard key={todo.id} todo={todo} isCompleted={true} activeTab={activeTab} userProfile={userProfile} groups={groups} isCoordinator={isCoordinator} onToggle={toggleTodo} onDelete={deleteTodo} onConfirm={openConfirmModal} onReject={deleteTodo} onConfirmCompletion={confirmCompletion} onRejectCompletion={rejectCompletion} />)
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <CreateGroupModal show={showGroupModal} onClose={() => setShowGroupModal(false)} onCreate={createGroup} groupName={newGroupName} setGroupName={setNewGroupName} groupDesc={newGroupDesc} setGroupDesc={setNewGroupDesc} />

      <ManageGroupsModal show={showManageGroupModal} onClose={() => setShowManageGroupModal(false)} groups={groups} isCoordinator={isCoordinator} userProfile={userProfile} availableUsers={availableUsers} onDeleteGroup={deleteGroup} onRemoveMember={removeMemberFromGroup} onAddMember={addMemberToGroup} Icon={Icon} />

      <ManageLeadersModal show={showLeaderModal && isCoordinator} onClose={() => setShowLeaderModal(false)} interns={interns} onToggleLeader={toggleLeader} Icon={Icon} />

      <ConfirmTaskModal show={showConfirmModal} onClose={() => { setShowConfirmModal(false); setConfirmingTodo(null); }} onConfirm={submitConfirmTodo} todo={confirmingTodo} task={confirmTask} setTask={setConfirmTask} startDate={confirmStartDate} setStartDate={setConfirmStartDate} deadline={confirmDeadline} setDeadline={setConfirmDeadline} assignee={confirmAssignee} setAssignee={setConfirmAssignee} members={getGroupMembersForAssign()} Icon={Icon} />
    </div>

  );
}

export default TodoList;
