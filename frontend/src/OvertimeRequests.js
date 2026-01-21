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

  const isSelectedApproved = selected ? statusLabel(selected) === 'Approved' : false;

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
    
    // Generate period rows for the table (5 rows minimum)
    const periodRows = [];
    for (let i = 0; i < 5; i++) {
      const period = periods[i];
      periodRows.push(`
        <tr>
          <td class="period-cell">${period ? escapeHtml(period.start_date || '') : ''}</td>
          <td class="period-cell">${period ? escapeHtml(period.end_date || '') : ''}</td>
          <td class="period-cell">${period ? escapeHtml(period.start_time || '') : ''}</td>
          <td class="period-cell">${period ? escapeHtml(period.end_time || '') : ''}</td>
        </tr>
      `);
    }

    const html = `
      <html>
        <head>
          <title>Overtime Request Form</title>
          <style>
            @page {
              size: A4;
              margin: 0.5in;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              background: #fff;
              color: #000;
              padding: 15px;
              font-size: 10pt;
              line-height: 1.3;
            }
            .form-container {
              max-width: 800px;
              margin: 0 auto;
              border: 2px solid #000;
              padding: 0;
            }
            .header {
              display: flex;
              flex-direction: column;
              align-items: center;
              border-bottom: 2px solid #000;
              padding: 20px 20px;
            }
            .logo {
              width: 400px;
              height: auto;
              margin-top: -40px;
              margin-right: 80px;
            }
            .header-text {
              margin-top: -35px;
              flex: 1;
              text-align: center;
            }
            .company-name {
              font-size: 16pt;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .form-title {
              font-size: 14pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .section {
              padding: 10px 15px;
              border-bottom: 1px solid #000;
            }
            .section:last-child {
              border-bottom: none;
            }
            .section-title {
              font-weight: bold;
              font-size: 10pt;
              margin-bottom: 8px;
              text-transform: uppercase;
              background: #f0f0f0;
              padding: 3px 8px;
              margin: -10px -15px 8px -15px;
            }
            .field-row {
              display: flex;
              margin-bottom: 7px;
              align-items: flex-start;
            }
            .field-row:last-child {
              margin-bottom: 0;
            }
            .field-group {
              flex: 1;
              display: flex;
              align-items: baseline;
            }
            .field-label {
              font-weight: bold;
              min-width: 130px;
              font-size: 9pt;
            }
            .field-value {
              flex: 1;
              border-bottom: 1px solid #000;
              min-height: 15px;
              padding: 1px 3px;
              font-size: 9pt;
            }
            .field-value.short-date {
              flex: none;
              width: 90px;
            }
            .periods-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            .periods-table th {
              background: #e0e0e0;
              border: 1px solid #000;
              padding: 5px 3px;
              font-size: 9pt;
              font-weight: bold;
              text-align: center;
            }
            .periods-table td.period-cell {
              border: 1px solid #000;
              padding: 5px 3px;
              height: 20px;
              text-align: center;
              font-size: 9pt;
            }
            .explanation-box {
              border: 1px solid #000;
              min-height: 50px;
              padding: 6px;
              margin-top: 5px;
              font-size: 9pt;
              line-height: 1.3;
            }
            .signature-section {
              display: flex;
              justify-content: space-between;
              margin-top: 8px;
            }

            .signature-block {
              width: 45%;
              text-align: center;
            }
            .signature-block1 {
              margin-top: 60px;
              width: 45%;
              text-align: center;
            }
            .signature-line {
              border-bottom: 1px solid #000;
              height: 30px;
              margin-bottom: 3px;
              position: relative;
            }
            .signature-image {
              width: 100%;
              height: 60px;
              background: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 0px;
              padding-top: 5px;
            }
            .signature-image img {
              max-width: 100%;
              max-height: 100%;
              display: block;
            }
            .signature-label {
              font-size: 8pt;
              font-weight: bold;
            }
            .date-line {
              margin-top: 10px;
            }
            .date-label {
              font-size: 9pt;
            }
            .approval-section {
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px dashed #000;
            }
            .approval-title {
              font-weight: bold;
              font-size: 10pt;
              margin-bottom: 8px;
              text-align: center;
              text-transform: uppercase;
            }
            .approval-signatures {
              display: flex;
              justify-content: space-around;
            }
            .approval-block {
              width: 40%;
              text-align: center;
            }
            .approval-note {
              font-weight: bold;
              margin-bottom: 5px;
              font-size: 9pt;
              
            }
            .total-hours {
              font-weight: bold;
              background: #f5f5f5;
              padding: 5px 10px;
              display: inline-block;
              border: 1px solid #000;
              margin-top: 5px;
            }
            @media print {
              body {
                padding: 0;
              }
              .form-container {
                border: 2px solid #000;
              }
            }
          </style>
        </head>
        <body>
          <div class="form-container">
            <!-- Header with Logo -->
            <div class="header">
              <img src="/imgs/formlogo.png" alt="Company Logo" class="logo" />
              <div class="header-text">
                <div class="form-title">Overtime Request Form</div>
              </div>
            </div>

            <!-- Employee Information Section -->
            <div class="section">
              <div class="section-title">Employee Information</div>
              <div class="field-row">
                <div class="field-group">
                  <span class="field-label">Employee Name:</span>
                  <span class="field-value">${escapeHtml(req.employee_name || req.full_name || '')}</span>
                </div>
              </div>
              <div class="field-row">
                <div class="field-group" style="flex: 1; margin-right: 20px;">
                  <span class="field-label">Job Position:</span>
                  <span class="field-value">${escapeHtml(req.job_position || '')}</span>
                </div>
                <div class="field-group" style="flex: 1;">
                  <span class="field-label">Department:</span>
                  <span class="field-value">${escapeHtml(req.department || '')}</span>
                </div>
              </div>
              <div class="field-row">
                <div class="field-group">
                  <span class="field-label">Date of Request:</span>
                  <span class="field-value">${escapeHtml(req.date_completed || '')}</span>
                </div>
              </div>
            </div>

            <!-- Overtime Details Section -->
            <div class="section">
              <div class="section-title">Overtime Schedule</div>
              <table class="periods-table">
                <thead>
                  <tr>
                    <th style="width: 25%;">Start Date</th>
                    <th style="width: 25%;">Start Time</th>
                    <th style="width: 25%;">End Date</th>
                    <th style="width: 25%;">End Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${periodRows.join('')}
                </tbody>
              </table>
              <div style="margin-top: 15px; text-align: right;">
                <span class="total-hours">Total Anticipated Hours: ${escapeHtml(req.anticipated_hours || '0')} hours</span>
              </div>
            </div>

            <!-- Explanation Section -->
            <div class="section">
              <div class="section-title">Reason / Justification for Overtime</div>
              <div class="explanation-box">
                ${escapeHtml(req.explanation || '')}
              </div>
            </div>

            <!-- Employee Signature Section -->
            <div class="section">
              <div class="section-title">Employee Acknowledgment</div>
              <div class="signature-section">
                <div class="signature-block">
                  ${req.employee_signature ? `<div class="signature-image"><img src="${req.employee_signature}" alt="Employee Signature" /></div>` : ''}
                  <div class="signature-line"></div>
                  <div class="signature-label">Employee Signature</div>
                </div>
                <div class="signature-block1">
                  <div class="signature-line">${escapeHtml(req.date_completed || '')}</div>
                  <div class="signature-label">Date</div>
                </div>
              </div>
            </div>

            <!-- Approval Section -->
            <div class="section">
              <div class="approval-title">For Official Use Only - Approval</div>
              <div class="field-row" style="margin-bottom: 15px;">
                <div class="field-group">
                  <span class="field-label">Approval Date:</span>
                  <span class="field-value short-date">${escapeHtml(req.approval_date || '')}</span>
                  <div class="approval-note" style="margin-left: 15px;">Approved</div>
                </div>
              </div>
              <div class="approval-signatures">
                <div class="approval-block">
                  <div class="signature-line" style="margin-top: 15px;"></div>
                  <div class="signature-label">Supervisor Signature</div>
                </div>
                <div class="approval-block">
                  <div class="signature-line" style="margin-top: 15px;"></div>
                  <div class="signature-label">Management Signature</div>
                </div>
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    doc.document.write(html);
    doc.document.close();
  };

  return (
    <div className="dashboard overflow-x-hidden">
      {alert && (
        <Alert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
      <div className="welcome box-border w-full">
        <h2>Overtime Requests</h2>
        <p>Coordinator view of all overtime submissions</p>
      </div>
      <div className="attendance-table box-border w-full">
        <div className="flex justify-between items-center p-5 border-b border-white/5 flex-wrap gap-4">
          <h3 className="m-0">All Requests</h3>
          <div className="flex gap-3 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-blue-950 text-gray-300 border border-orange-500/30 rounded-lg text-sm cursor-pointer hover:border-orange-500/50"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
            </select>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="px-4 py-2 bg-blue-950 text-gray-300 border border-orange-500/30 rounded-lg text-sm cursor-pointer hover:border-orange-500/50"
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
              min="2000-01-01"
              max="2026-12-31"
              className="px-4 py-2 bg-blue-950 text-gray-300 border border-orange-500/30 rounded-lg text-sm cursor-pointer hover:border-orange-500/50"
            />
            {(filterStatus !== 'all' || filterEmployee !== 'all' || filterDate) && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterEmployee('all');
                  setFilterDate('');
                }}
                className="px-4 py-2 bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded-lg text-sm cursor-pointer font-semibold hover:bg-orange-500/30"
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
                  <td colSpan="6" className="text-center text-gray-500 p-6">
                    No requests yet.
                  </td>
                </tr>
              ) : (
                requests
                  .filter(req => filterStatus === 'all' || statusLabel(req) === filterStatus)
                  .filter(req => filterEmployee === 'all' || (req.full_name || req.employee_name) === filterEmployee)
                  .filter(req => !filterDate || req.date_completed === filterDate)
                  .map(req => (
                  <tr key={req.id} onClick={() => openDetail(req)} className="cursor-pointer">
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
                        className={`px-3 py-1 rounded text-white text-xs font-semibold transition-all ${
                          statusLabel(req) === 'Approved'
                            ? 'bg-orange-500 cursor-pointer hover:bg-orange-600'
                            : 'bg-gray-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        Print Form
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
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'}}>
          <div style={{background: '#00273C', borderRadius: '12px', border: '1px solid rgba(255, 113, 32, 0.2)', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <h3 style={{color: '#e8eaed', margin: 0, fontSize: '1.1rem', fontWeight: '600'}}>{selected.full_name || selected.employee_name}</h3>
              <button
                onClick={() => setSelected(null)}
                style={{background: 'transparent', border: 'none', color: '#FF7120', fontSize: '2rem', cursor: 'pointer', padding: 0, lineHeight: 1}}
              >×</button>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Employee Name</label>
                <div style={{color: '#e8eaed'}}>{selected.full_name || selected.employee_name || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Job Position</label>
                <div style={{color: '#e8eaed'}}>{selected.job_position || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Department</label>
                <div style={{color: '#e8eaed'}}>{selected.department || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Date Completed</label>
                <div style={{color: '#e8eaed'}}>{selected.date_completed || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Anticipated Hours</label>
                <div style={{color: '#e8eaed'}}>{selected.anticipated_hours || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Approval Date</label>
                <div style={{color: '#e8eaed'}}>{selected.approval_date || '-'}</div>
              </div>
            </div>
            <div style={{marginBottom: '1rem'}}>
              <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem'}}>Explanation</label>
              <div style={{color: '#e8eaed', background: '#001a2b', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)'}}>
                {selected.explanation || '-'}
              </div>
            </div>
            <div style={{marginBottom: '1rem'}}>
              <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem'}}>Overtime Periods</label>
              <div style={{background: '#00273C', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '0.75rem'}}>
                {Array.isArray(selected.periods) && selected.periods.length > 0 ? (
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem'}}>
                    <thead>
                      <tr>
                        <th style={{textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF7120', fontWeight: '600'}}>#</th>
                        <th style={{textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF7120', fontWeight: '600'}}>Start Date</th>
                        <th style={{textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF7120', fontWeight: '600'}}>Start Time</th>
                        <th style={{textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF7120', fontWeight: '600'}}>End Date</th>
                        <th style={{textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF7120', fontWeight: '600'}}>End Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.periods.map((period, idx) => (
                        <tr key={`pv-${idx}`}>
                          <td style={{borderBottom: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.5rem', color: '#e8eaed'}}>{idx + 1}</td>
                          <td style={{borderBottom: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.5rem', color: '#e8eaed'}}>{period.start_date || '-'}</td>
                          <td style={{borderBottom: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.5rem', color: '#e8eaed'}}>{period.start_time || '-'}</td>
                          <td style={{borderBottom: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.5rem', color: '#e8eaed'}}>{period.end_date || '-'}</td>
                          <td style={{borderBottom: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.5rem', color: '#e8eaed'}}>{period.end_time || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{color: '#e8eaed'}}>No periods recorded.</div>
                )}
              </div>
            </div>
            <div style={{marginBottom: '1rem', maxWidth: '300px'}}>
              <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem'}}>Date of Approval</label>
              <input
                type="date"
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
                min="2000-01-01"
                max="2026-12-31"
                style={{width: '100%', padding: '0.5rem', background: '#001a2b', color: '#e8eaed', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'inherit'}}
              />
            </div>
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem'}}>
              <button
                onClick={submitApproval}
                disabled={isSelectedApproved}
                style={{
                  background: isSelectedApproved ? 'rgba(255, 113, 32, 0.4)' : '#FF7120',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1.5rem',
                  fontWeight: '600',
                  cursor: isSelectedApproved ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  opacity: isSelectedApproved ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { if (!isSelectedApproved) e.target.style.background = '#ff8a3a'; }}
                onMouseLeave={(e) => { if (!isSelectedApproved) e.target.style.background = '#FF7120'; }}
              >
                {isSelectedApproved ? 'Already Approved' : 'Approve Request'}
              </button>
              <button
                onClick={() => setSelected(null)}
                style={{background: 'transparent', color: '#a0a4a8', border: '1px solid rgba(255, 113, 32, 0.3)', borderRadius: '8px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.9rem'}}
                onMouseEnter={(e) => {e.target.style.color = '#FF7120'; e.target.style.borderColor = 'rgba(255, 113, 32, 0.5)'}}
                onMouseLeave={(e) => {e.target.style.color = '#a0a4a8'; e.target.style.borderColor = 'rgba(255, 113, 32, 0.3)'}}
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
