import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Alert from './components/Alert';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function OvertimeRequests({ token }) {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [alert, setAlert] = useState(null);
  const supervisorPadRef = useRef(null);
  const managementPadRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState({ supervisor: false, management: false });
  const [approvalDate, setApprovalDate] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
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
    }
  };

  const openDetail = (req) => {
    setSelected(req);
    setApprovalDate(req.approval_date || new Date().toISOString().split('T')[0]);
    clearPad('supervisor');
    clearPad('management');
  };

  const getPos = (event, pad) => {
    const canvas = pad.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDraw = (event, who) => {
    event.preventDefault();
    const pad = who === 'supervisor' ? supervisorPadRef : managementPadRef;
    setIsDrawing(prev => ({ ...prev, [who]: true }));
    const ctx = pad.current.getContext('2d');
    const { x, y } = getPos(event, pad);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event, who) => {
    if (!isDrawing[who]) return;
    event.preventDefault();
    const pad = who === 'supervisor' ? supervisorPadRef : managementPadRef;
    const ctx = pad.current.getContext('2d');
    const { x, y } = getPos(event, pad);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const endDraw = (who) => {
    if (!isDrawing[who]) return;
    setIsDrawing(prev => ({ ...prev, [who]: false }));
  };

  const clearPad = (who) => {
    const pad = who === 'supervisor' ? supervisorPadRef : managementPadRef;
    if (pad.current) {
      const ctx = pad.current.getContext('2d');
      ctx.clearRect(0, 0, pad.current.width, pad.current.height);
    }
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
      const supervisorSig = supervisorPadRef.current.toDataURL('image/png');
      const managementSig = managementPadRef.current.toDataURL('image/png');
      await axios.put(`${API}/overtime/${selected.id}/approve`, {
        supervisor_signature: supervisorSig,
        management_signature: managementSig,
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
        <h2>Overtime Requests</h2>
        <p>Coordinator view of all overtime submissions</p>
      </div>
      <div className="attendance-table">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ margin: 0 }}>All Requests</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Date Completed</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#a0a4a8', padding: '1.5rem' }}>
                    No requests yet.
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id} onClick={() => openDetail(req)} style={{ cursor: 'pointer' }}>
                    <td>{req.full_name || req.employee_name}</td>
                    <td>{req.department || '-'}</td>
                    <td>{req.date_completed || '-'}</td>
                    <td>{req.anticipated_hours || '-'}</td>
                    <td>{statusLabel(req)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div><label style={{ color: '#a0a4a8' }}>Job Position</label><div style={{ color: '#fff' }}>{selected.job_position}</div></div>
              <div><label style={{ color: '#a0a4a8' }}>Department</label><div style={{ color: '#fff' }}>{selected.department || '-'}</div></div>
              <div><label style={{ color: '#a0a4a8' }}>Date Completed</label><div style={{ color: '#fff' }}>{selected.date_completed || '-'}</div></div>
              <div><label style={{ color: '#a0a4a8' }}>Anticipated Hours</label><div style={{ color: '#fff' }}>{selected.anticipated_hours || '-'}</div></div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#a0a4a8' }}>Explanation</label>
              <div style={{ color: '#fff', background: '#00273C', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                {selected.explanation || '-'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#a0a4a8' }}>Supervisor Signature</label>
                <div className="signature-pad">
                  <canvas
                    ref={supervisorPadRef}
                    width={360}
                    height={120}
                    onMouseDown={(e) => startDraw(e, 'supervisor')}
                    onMouseMove={(e) => draw(e, 'supervisor')}
                    onMouseUp={() => endDraw('supervisor')}
                    onMouseLeave={() => endDraw('supervisor')}
                    onTouchStart={(e) => startDraw(e, 'supervisor')}
                    onTouchMove={(e) => draw(e, 'supervisor')}
                    onTouchEnd={() => endDraw('supervisor')}
                  />
                  <div className="signature-actions">
                    <button type="button" className="ghost" onClick={() => clearPad('supervisor')}>Clear</button>
                    <span className="signature-hint">Sign with mouse or finger</span>
                  </div>
                </div>
              </div>
              <div>
                <label style={{ color: '#a0a4a8' }}>Top Management Signature</label>
                <div className="signature-pad">
                  <canvas
                    ref={managementPadRef}
                    width={360}
                    height={120}
                    onMouseDown={(e) => startDraw(e, 'management')}
                    onMouseMove={(e) => draw(e, 'management')}
                    onMouseUp={() => endDraw('management')}
                    onMouseLeave={() => endDraw('management')}
                    onTouchStart={(e) => startDraw(e, 'management')}
                    onTouchMove={(e) => draw(e, 'management')}
                    onTouchEnd={() => endDraw('management')}
                  />
                  <div className="signature-actions">
                    <button type="button" className="ghost" onClick={() => clearPad('management')}>Clear</button>
                    <span className="signature-hint">Sign with mouse or finger</span>
                  </div>
                </div>
              </div>
              <div>
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
