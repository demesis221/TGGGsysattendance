import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Alert from './components/Alert';
import { TableSkeleton } from './components/SkeletonLoader';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const escapeHtml = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

function OvertimeRequests({ token }) {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approvalDate, setApprovalDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/overtime/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(data);
    } catch (err) {
      setAlert({
        type: 'error',
        title: 'Load failed',
        message: err.response?.data?.error || 'Could not load overtime requests.'
      });
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (req) => {
    setSelected(req);
    setApprovalDate(req.approval_date || new Date().toISOString().split('T')[0]);
  };

  const statusLabel = (req) => {
    const sup = !!req.supervisor_signature;
    const mgmt = !!req.management_signature;
    if (sup && mgmt) return 'Approved';
    if (sup && !mgmt) return 'Waiting for Top Management Approval';
    if (!sup && mgmt) return 'Waiting for Supervisor Approval';
    return 'Pending';
  };

  const submitApproval = async () => {
    if (!selected) return;
    try {
      await axios.put(`${API}/overtime/${selected.id}/approve`, {
        supervisor_signature: 'approved',
        management_signature: 'approved',
        approval_date: approvalDate
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlert({ type: 'success', title: 'Saved', message: 'Approval updated.' });
      setSelected(null);
      await load();
    } catch (err) {
      setAlert({ type: 'error', title: 'Save failed', message: err.response?.data?.error || 'Could not save approval.' });
    }
  };

  const printReport = (req) => {
    if (!req) return;
    const doc = window.open('', '_blank');
    if (!doc) return;
    const periods = Array.isArray(req.periods) ? req.periods : [];
    const periodRows = periods.map((period, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(period.start_date || '-')}</td>
        <td>${escapeHtml(period.start_time || '-')}</td>
        <td>${escapeHtml(period.end_date || '-')}</td>
        <td>${escapeHtml(period.end_time || '-')}</td>
      </tr>
    `).join('');
    const html = `
      <html>
        <head>
          <title>Overtime Report</title>
          <style>
            body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 2rem; }
            h1 { font-size: 1.5rem; margin-bottom: 1rem; }
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            th, td { border: 1px solid #222; padding: 0.5rem; text-align: left; font-size: 0.9rem; }
            .field { margin-bottom: 0.5rem; }
            .field-label { font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>Overtime Request</h1>
          <div class="field"><span class="field-label">Employee Name:</span> ${escapeHtml(req.employee_name || req.full_name || '-')}</div>
          <div class="field"><span class="field-label">Job Position:</span> ${escapeHtml(req.job_position || '-')}</div>
          <div class="field"><span class="field-label">Department:</span> ${escapeHtml(req.department || '-')}</div>
          <div class="field"><span class="field-label">Date Completed:</span> ${escapeHtml(req.date_completed || '-')}</div>
          <div class="field"><span class="field-label">Anticipated Hours:</span> ${escapeHtml(req.anticipated_hours || '-')}</div>
          <div class="field"><span class="field-label">Explanation:</span> ${escapeHtml(req.explanation || '-')}</div>
          <div class="field"><span class="field-label">Approval Date:</span> ${escapeHtml(req.approval_date || '-')}</div>
          <h2>Periods</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Start Date</th>
                <th>Start Time</th>
                <th>End Date</th>
                <th>End Time</th>
              </tr>
            </thead>
            <tbody>
              ${periods.length ? periodRows : '<tr><td colspan="5" style="text-align:center;">No periods provided.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;
    doc.document.write(html);
    doc.document.close();
    doc.focus();
    doc.print();
  };

  return (
    <div className="dashboard" style={{overflowX: 'hidden'}}>
      {alert && (
        <Alert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
      <div className="welcome" style={{boxSizing: 'border-box', maxWidth: '100%'}}>
        <h2>Overtime Requests</h2>
        <p>Coordinator view of all overtime submissions</p>
      </div>
      <div className="attendance-table" style={{boxSizing: 'border-box', maxWidth: '100%'}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>All Requests</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                background: '#00273C',
                color: '#e8eaed',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
            </select>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                background: '#00273C',
                color: '#e8eaed',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Employees</option>
              {[...new Set(requests.map(r => r.full_name || r.employee_name))].map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                background: '#00273C',
                color: '#e8eaed',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            />
            {(filterStatus !== 'all' || filterEmployee !== 'all' || filterDate) && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterEmployee('all');
                  setFilterDate('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(255, 113, 32, 0.2)',
                  color: '#FF7120',
                  border: '1px solid rgba(255, 113, 32, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <TableSkeleton />
        ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Date Completed</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#a0a4a8', padding: '1.5rem' }}>
                    No requests yet.
                  </td>
                </tr>
              ) : (
                requests
                  .filter(req => filterStatus === 'all' || statusLabel(req) === filterStatus)
                  .filter(req => filterEmployee === 'all' || (req.full_name || req.employee_name) === filterEmployee)
                  .filter(req => !filterDate || req.date_completed === filterDate)
                  .map(req => (
                  <tr key={req.id} onClick={() => openDetail(req)} style={{ cursor: 'pointer' }}>
                    <td>{req.full_name || req.employee_name}</td>
                    <td>{req.department || '-'}</td>
                    <td>{req.date_completed || '-'}</td>
                    <td>{req.anticipated_hours || '-'}</td>
                    <td>{statusLabel(req)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); printReport(req); }}
                        disabled={statusLabel(req) !== 'Approved'}
                        style={{
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#FF7120',
                          color: '#fff',
                          cursor: statusLabel(req) === 'Approved' ? 'pointer' : 'not-allowed',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        Print Report
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {selected && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#001f35',
            borderRadius: '12px',
            border: '1px solid rgba(255,113,32,0.3)',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#fff', margin: 0 }}>{selected.full_name || selected.employee_name}</h3>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'transparent', border: 'none', color: '#FF7120', fontSize: '1.5rem', cursor: 'pointer' }}
              >×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ color: '#a0a4a8' }}>Employee Name</label>
                <div style={{ color: '#fff' }}>{selected.full_name || selected.employee_name || '-'}</div>
              </div>
              <div>
                <label style={{ color: '#a0a4a8' }}>Job Position</label>
                <div style={{ color: '#fff' }}>{selected.job_position || '-'}</div>
              </div>
              <div>
                <label style={{ color: '#a0a4a8' }}>Department</label>
                <div style={{ color: '#fff' }}>{selected.department || '-'}</div>
              </div>
              <div>
                <label style={{ color: '#a0a4a8' }}>Date Completed</label>
                <div style={{ color: '#fff' }}>{selected.date_completed || '-'}</div>
              </div>
              <div>
                <label style={{ color: '#a0a4a8' }}>Anticipated Hours</label>
                <div style={{ color: '#fff' }}>{selected.anticipated_hours || '-'}</div>
              </div>
              <div>
                <label style={{ color: '#a0a4a8' }}>Approval Date</label>
                <div style={{ color: '#fff' }}>{selected.approval_date || '-'}</div>
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#a0a4a8' }}>Explanation</label>
              <div style={{ color: '#fff', background: '#00273C', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                {selected.explanation || '-'}
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#a0a4a8' }}>Overtime Periods</label>
              <div style={{ background: '#001b30', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem' }}>
                {Array.isArray(selected.periods) && selected.periods.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Start Date</th>
                        <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Start Time</th>
                        <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>End Date</th>
                        <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>End Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.periods.map((period, idx) => (
                        <tr key={`pv-${idx}`}>
                          <td style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.25rem' }}>{idx + 1}</td>
                          <td style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.25rem' }}>{period.start_date || '-'}</td>
                          <td style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.25rem' }}>{period.start_time || '-'}</td>
                          <td style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.25rem' }}>{period.end_date || '-'}</td>
                          <td style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.25rem' }}>{period.end_time || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ color: '#fff' }}>No periods recorded.</div>
                )}
              </div>
            </div>
            <div style={{ marginBottom: '1rem', maxWidth: '360px' }}>
              <label style={{ color: '#a0a4a8' }}>Date of Approval</label>
              <input
                type="date"
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.95rem'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={submitApproval}
                style={{
                  background: '#FF7120',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.8rem 1.4rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Save Approval
              </button>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'transparent',
                  color: '#a0a4a8',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '0.8rem 1.4rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OvertimeRequests;
