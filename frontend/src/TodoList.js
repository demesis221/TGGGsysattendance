import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function TodoList({ token }) {
  const [todos, setTodos] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateTask, setDateTask] = useState('');
  const itemsPerPage = 5;

  useEffect(() => {
    fetchTodos();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  const fetchTodos = async () => {
    const { data } = await axios.get(`${API}/todos`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setTodos(data);
  };

  const addDateTodo = async (e) => {
    e.preventDefault();
    if (!dateTask.trim()) return;
    
    try {
      const taskWithDate = `[${selectedDate.toLocaleDateString()}] ${dateTask}`;
      await axios.post(`${API}/todos`, { task: taskWithDate }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDateTask('');
      await fetchTodos();
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task. Please make sure the todos table exists in Supabase.');
    }
  };

  const toggleTodo = async (id, completed) => {
    await axios.put(`${API}/todos/${id}`, { completed: !completed }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchTodos();
  };

  const deleteTodo = async (id) => {
    await axios.delete(`${API}/todos/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchTodos();
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const changeMonth = (offset) => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
  };

  const getFilteredTodos = () => {
    const dateStr = selectedDate.toLocaleDateString();
    return todos.filter(todo => todo.task.includes(`[${dateStr}]`));
  };

  const filteredTodos = getFilteredTodos();
  const { firstDay, daysInMonth } = getDaysInMonth(selectedDate);
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="dashboard">
      <div className="todo-layout" style={{display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap'}}>
        <div className="welcome todo-sidebar" style={{flex: '0 0 280px'}}>
          <h2>My Todo List</h2>
          <p>Keep track of your daily tasks</p>
          <div style={{marginTop: '1rem', padding: '1rem', background: 'rgba(255, 113, 32, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 113, 32, 0.2)'}}>
            <p style={{fontSize: '0.85rem', color: '#e8eaed', marginBottom: '0.5rem'}}>
              Select a date from the calendar to view and manage tasks for that day.
            </p>
            <p style={{fontSize: '0.85rem', color: '#e8eaed', marginBottom: '0.5rem'}}>
              Check off completed tasks to track your progress.
            </p>
            <p style={{fontSize: '0.85rem', color: '#e8eaed', marginBottom: '0'}}>
              Delete tasks you no longer need.
            </p>
          </div>

          <div className="checkin-form" style={{marginTop: '1rem', padding: '1rem'}}>
            <h3 style={{fontSize: '1rem', marginBottom: '0.75rem'}}>GitHub Issues</h3>
            <p style={{fontSize: '0.85rem', color: '#e8eaed', marginBottom: '1rem'}}>
              Check or add issues to the project repository
            </p>
            <button
              onClick={() => window.open('https://github.com/demesis221/TGGGsysattendance/issues', '_blank')}
              style={{
                width: '100%',
                background: '#FF7120',
                color: 'white',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span>↗</span>
              View GitHub Issues
            </button>
          </div>
        </div>

        <div className="checkin-form todo-main" style={{flex: 1, minWidth: 0}}>
        <h3>Tasks for {selectedDate.toLocaleDateString()}</h3>
        <form onSubmit={addDateTodo} className="todo-form" style={{display: 'flex', gap: '1rem', marginBottom: '2rem'}}>
          <input
            type="text"
            value={dateTask}
            onChange={(e) => setDateTask(e.target.value)}
            placeholder="Enter your task..."
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#00273C',
              color: '#e8eaed',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              fontSize: '0.9rem'
            }}
          />
          <button type="submit" className="todo-add-btn">Add Task</button>
        </form>

        <div>
          {filteredTodos.length === 0 ? (
            <p style={{textAlign: 'center', color: '#6b7280', padding: '2rem'}}>
              No tasks for this date. Add your first task above!
            </p>
          ) : (
            <>
            {filteredTodos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(todo => (
              <div
                key={todo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: '#00273C',
                  borderRadius: '8px',
                  marginBottom: '0.75rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id, todo.completed)}
                  style={{
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    accentColor: '#FF7120'
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    color: todo.completed ? '#6b7280' : '#e8eaed',
                    textDecoration: todo.completed ? 'line-through' : 'none',
                    fontSize: '0.95rem'
                  }}
                >
                  {todo.task.replace(/\[.*?\]\s*/, '')}
                </span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 113, 32, 0.3)',
                    color: '#FF7120',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
            {filteredTodos.length > itemsPerPage && (
              <div style={{display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem'}}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    background: currentPage === 1 ? 'transparent' : '#FF7120',
                    color: currentPage === 1 ? '#6b7280' : 'white',
                    border: '1px solid rgba(255, 113, 32, 0.3)',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Previous
                </button>
                <span style={{padding: '0.5rem 1rem', color: '#e8eaed'}}>
                  Page {currentPage} of {Math.ceil(filteredTodos.length / itemsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredTodos.length / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil(filteredTodos.length / itemsPerPage)}
                  style={{
                    background: currentPage === Math.ceil(filteredTodos.length / itemsPerPage) ? 'transparent' : '#FF7120',
                    color: currentPage === Math.ceil(filteredTodos.length / itemsPerPage) ? '#6b7280' : 'white',
                    border: '1px solid rgba(255, 113, 32, 0.3)',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: currentPage === Math.ceil(filteredTodos.length / itemsPerPage) ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Next
                </button>
              </div>
            )}
            </>
          )}
        </div>
        </div>

        <div className="checkin-form todo-calendar" style={{flex: '0 0 350px'}}>
          <h3>Calendar</h3>
          <div style={{marginBottom: '1rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <button onClick={() => changeMonth(-1)} style={{background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer'}}>‹</button>
              <span style={{color: '#e8eaed', fontSize: '0.95rem', fontWeight: '500'}}>{monthName}</span>
              <button onClick={() => changeMonth(1)} style={{background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer'}}>›</button>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.5rem'}}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} style={{textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', padding: '0.25rem'}}>{day}</div>
              ))}
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem'}}>
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                const isSelected = date.toDateString() === selectedDate.toDateString();
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    style={{
                      padding: '0.5rem',
                      background: isSelected ? '#FF7120' : isToday ? 'rgba(255, 113, 32, 0.2)' : 'transparent',
                      color: isSelected ? 'white' : '#e8eaed',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TodoList;
