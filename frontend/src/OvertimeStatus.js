import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Alert from './components/Alert';
import { TableSkeleton } from './components/SkeletonLoader';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const statusLabel = (req) => {
  const sup = !!req.supervisor_signature;
  const mgmt = !!req.management_signature;
  if (sup && mgmt) return 'Approved';
  if (sup && !mgmt) return 'Waiting for Top Management Approval';
  if (!sup && mgmt) return 'Waiting for Supervisor Approval';
  return 'Pending';
};

function OvertimeStatus({ token }) {
  const [requests, setRequests] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedForView, setSelectedForView] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API}/overtime/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRequests(data);
      } catch (err) {
        setAlert({
          type: 'error',
          title: 'Load failed',
          message: err.response?.data?.error || 'Could not load OT requests.'
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const printReport = (req) => {
    if (!req) return;
    const doc = window.open('', '_blank');
    if (!doc) return;
    const periods = Array.isArray(req.periods) ? req.periods : [];

    const periodRows = [];
    for (let i = 0; i < 5; i++) {
      const period = periods[i];
      periodRows.push(`
        <tr>
          <td class="period-cell">${period ? escapeHtml(period.start_date || '') : ''}</td>
          <td class="period-cell">${period ? escapeHtml(period.start_time || '') : ''}</td>
          <td class="period-cell">${period ? escapeHtml(period.end_date || '') : ''}</td>
          <td class="period-cell">${period ? escapeHtml(period.end_time || '') : ''}</td>
        </tr>
      `);
    }

    const html = `
      <html>
        <head>
          <title>Overtime Request Form</title>
          <style>
            @page { size: A4; margin: 0.5in; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 15px; font-size: 10pt; line-height: 1.3; }
            .form-container { max-width: 800px; margin: 0 auto; border: 2px solid #000; padding: 0; }
            .header { display: flex; flex-direction: column; align-items: center; border-bottom: 2px solid #000; padding: 20px 20px; }
            .logo { width: 400px; height: auto; margin-top: -40px; margin-right: 80px; }
            .header-text { margin-top: -35px; flex: 1; text-align: center; }
            .form-title { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
            .section { padding: 10px 15px; border-bottom: 1px solid #000; }
            .section:last-child { border-bottom: none; }
            .section-title { font-weight: bold; font-size: 10pt; margin-bottom: 8px; text-transform: uppercase; background: #f0f0f0; padding: 3px 8px; margin: -10px -15px 8px -15px; }
            .field-row { display: flex; margin-bottom: 7px; align-items: flex-start; }
            .field-group { flex: 1; display: flex; align-items: baseline; }
            .field-label { font-weight: bold; min-width: 130px; font-size: 9pt; }
            .field-value { flex: 1; border-bottom: 1px solid #000; min-height: 15px; padding: 1px 3px; font-size: 9pt; }
            .periods-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .periods-table th { background: #e0e0e0; border: 1px solid #000; padding: 5px 3px; font-size: 9pt; font-weight: bold; text-align: center; }
            .periods-table td.period-cell { border: 1px solid #000; padding: 5px 3px; height: 20px; text-align: center; font-size: 9pt; }
            .explanation-box { border: 1px solid #000; min-height: 50px; padding: 6px; margin-top: 5px; font-size: 9pt; line-height: 1.3; }
            .signature-section { display: flex; justify-content: space-between; margin-top: 8px; }
            .signature-block { width: 45%; text-align: center; }
            .signature-block1 { margin-top: 60px; width: 45%; text-align: center; }
            .signature-line { border-bottom: 1px solid #000; height: 30px; margin-bottom: 3px; position: relative; }
            .signature-image { width: 100%; height: 60px; background: #fff; display: flex; align-items: center; justifyContent: center; margin-bottom: 0px; padding-top: 5px; }
            .signature-image img { max-width: 100%; max-height: 100%; display: block; }
            .signature-label { font-size: 8pt; font-weight: bold; }
            .approval-title { font-weight: bold; font-size: 10pt; margin-bottom: 8px; text-align: center; text-transform: uppercase; }
            .approval-signatures { display: flex; justify-content: space-around; }
            .approval-block { width: 40%; text-align: center; }
            .approval-note { font-weight: bold; margin-bottom: 5px; font-size: 9pt; }
            .total-hours { font-weight: bold; background: #f5f5f5; padding: 5px 10px; display: inline-block; border: 1px solid #000; margin-top: 5px; }
            @media print { body { padding: 0; } .form-container { border: 2px solid #000; } }
          </style>
        </head>
        <body>
          <div class="form-container">
            <div class="header">
              <img src="/imgs/formlogo.png" alt="Company Logo" class="logo" />
              <div class="header-text">
                <div class="form-title">Overtime Request Form</div>
              </div>
            </div>
            <div class="section">
              <div class="section-title">Employee Information</div>
              <div class="field-row"><div class="field-group"><span class="field-label">Employee Name:</span><span class="field-value">${escapeHtml(req.employee_name || req.full_name || '')}</span></div></div>
              <div class="field-row">
                <div class="field-group" style="flex:1; margin-right:20px;"><span class="field-label">Job Position:</span><span class="field-value">${escapeHtml(req.job_position || '')}</span></div>
                <div class="field-group" style="flex:1;"><span class="field-label">Department:</span><span class="field-value">${escapeHtml(req.department || '')}</span></div>
              </div>
              <div class="field-row"><div class="field-group"><span class="field-label">Date of Request:</span><span class="field-value">${escapeHtml(req.date_completed || '')}</span></div></div>
            </div>
            <div class="section">
              <div class="section-title">Overtime Schedule</div>
              <table class="periods-table">
                <thead><tr><th style="width:25%;">Start Date</th><th style="width:25%;">Start Time</th><th style="width:25%;">End Date</th><th style="width:25%;">End Time</th></tr></thead>
                <tbody>${periodRows.join('')}</tbody>
              </table>
              <div style="margin-top:15px; text-align:right;"><span class="total-hours">Total Anticipated Hours: ${escapeHtml(req.anticipated_hours || '0')} hours</span></div>
            </div>
            <div class="section">
              <div class="section-title">Reason / Justification for Overtime</div>
              <div class="explanation-box">${escapeHtml(req.explanation || '')}</div>
            </div>
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
            <div class="section">
              <div class="approval-title">For Official Use Only - Approval</div>
              <div class="field-row" style="margin-bottom:15px;"><div class="field-group"><span class="field-label">Approval Date:</span><span class="field-value">${escapeHtml(req.approval_date || '')}</span><div class="approval-note" style="margin-left:15px;">Approved</div></div></div>
              <div class="approval-signatures">
                <div class="approval-block"><div class="signature-line" style="margin-top:15px;"></div><div class="signature-label">Supervisor Signature</div></div>
                <div class="approval-block"><div class="signature-line" style="margin-top:15px;"></div><div class="signature-label">Management Signature</div></div>
              </div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `;

    doc.document.write(html);
    doc.document.close();
  };

  return (
    <div className="dashboard">
      {alert && (
        <Alert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
      <div className="welcome">
        <h2>OT Request Status</h2>
        <p>View your submitted overtime requests.</p>
      </div>
      <div className="attendance-table">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ margin: 0 }}>My OT Requests</h3>
        </div>
        {loading ? (
          <TableSkeleton />
        ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date Submitted</th>
                <th>Department</th>
                <th>Total Hours</th>
                <th>Explanation</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#a0a4a8', padding: '1.5rem' }}>
                    No overtime requests yet.
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id}>
                    <td>{req.date_completed || '-'}</td>
                    <td>{req.department || '-'}</td>
                    <td>{req.anticipated_hours || '-'}</td>
                    <td style={{ maxWidth: '320px', whiteSpace: 'normal' }}>
                      {req.explanation || '-'}
                    </td>
                    <td>
                      {statusLabel(req)}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedForView(req); }}
                        disabled={statusLabel(req) !== 'Approved'}
                        className={`px-3 py-1 rounded text-white text-xs font-semibold transition-all ${
                          statusLabel(req) === 'Approved'
                            ? 'bg-orange-500 cursor-pointer hover:bg-orange-600'
                            : 'bg-gray-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        View Form
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

      {selectedForView && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{
            background: '#00273C',
            borderRadius: '12px',
            border: '1px solid rgba(255, 113, 32, 0.2)',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{color: '#e8eaed', margin: 0, fontSize: '1.1rem', fontWeight: '600'}}>Overtime Request Form</h3>
              <button
                onClick={() => setSelectedForView(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#FF7120',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1
                }}
              >×</button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Employee Name</label>
                <div style={{color: '#e8eaed'}}>{selectedForView.employee_name || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Job Position</label>
                <div style={{color: '#e8eaed'}}>{selectedForView.job_position || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Department</label>
                <div style={{color: '#e8eaed'}}>{selectedForView.department || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Date Submitted</label>
                <div style={{color: '#e8eaed'}}>{selectedForView.date_completed || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Total Hours</label>
                <div style={{color: '#e8eaed'}}>{selectedForView.anticipated_hours || '-'}</div>
              </div>
              <div>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem'}}>Approval Date</label>
                <div style={{color: '#e8eaed'}}>{selectedForView.approval_date || '-'}</div>
              </div>
            </div>

            <div style={{marginBottom: '1rem'}}>
              <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem'}}>Explanation</label>
              <div style={{
                color: '#e8eaed',
                background: '#001a2b',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                lineHeight: '1.5'
              }}>
                {selectedForView.explanation || '-'}
              </div>
            </div>

            <div style={{marginBottom: '1rem'}}>
              <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem'}}>Overtime Periods</label>
              <div style={{
                background: '#00273C',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '0.75rem',
                overflowX: 'auto'
              }}>
                {Array.isArray(selectedForView.periods) && selectedForView.periods.length > 0 ? (
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem'}}>
                    <thead>
                      <tr>
                        <th style={{textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF7120', fontWeight: '600'}}>Start Date</th>
                        <th style={{textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF7120', fontWeight: '600'}}>Start Time</th>
                        <th style={{textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF7120', fontWeight: '600'}}>End Date</th>
                        <th style={{textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#FF7120', fontWeight: '600'}}>End Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedForView.periods.map((period, idx) => (
                        <tr key={`pv-${idx}`}>
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

            {selectedForView.employee_signature && (
              <div style={{marginBottom: '1rem'}}>
                <label style={{color: '#a0a4a8', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem'}}>Employee Signature</label>
                <div style={{
                  background: '#001a2b',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  textAlign: 'center'
                }}>
                  <img
                    src={selectedForView.employee_signature}
                    alt="Employee Signature"
                    style={{maxWidth: '200px', maxHeight: '100px', objectFit: 'contain'}}
                  />
                </div>
              </div>
            )}

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem'}}>
              <button
                onClick={() => printReport(selectedForView)}
                style={{
                  background: '#FF7120',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1.5rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#ff8a3a'}
                onMouseLeave={(e) => e.target.style.background = '#FF7120'}
              >
                Print Form
              </button>
              <button
                onClick={() => setSelectedForView(null)}
                style={{
                  background: 'transparent',
                  color: '#a0a4a8',
                  border: '1px solid rgba(255, 113, 32, 0.3)',
                  borderRadius: '8px',
                  padding: '0.5rem 1.5rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => {e.target.style.color = '#FF7120'; e.target.style.borderColor = 'rgba(255, 113, 32, 0.5)';}}
                onMouseLeave={(e) => {e.target.style.color = '#a0a4a8'; e.target.style.borderColor = 'rgba(255, 113, 32, 0.3)';}}  
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

export default OvertimeStatus;
