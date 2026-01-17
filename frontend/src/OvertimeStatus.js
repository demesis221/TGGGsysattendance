import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Alert from './components/Alert';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function OvertimeStatus({ token }) {
  const [requests, setRequests] = useState([]);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const load = async () => {
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
      }
    };
    load();
  }, [token]);

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
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date Submitted</th>
                <th>Department</th>
                <th>Total Hours</th>
                <th>Explanation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#a0a4a8', padding: '1.5rem' }}>
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
                      {req.approval_date
                        ? `Approved ${req.approval_date}`
                        : req.supervisor_signature || req.management_signature
                          ? 'Pending final approval'
                          : 'Pending'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default OvertimeStatus;
