import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import Alert from './components/Alert';
import { CardSkeleton } from './components/SkeletonLoader';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL',
  process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
);

const getTodayDate = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().split('T')[0];
};

const TIME_SLOTS = [
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
  { value: '22:00', label: '10:00 PM' }
];

const calculateTotalHoursFromPeriods = (periods) => {
  let totalMilliseconds = 0;
  periods.forEach(({ start_date, start_time, end_date, end_time }) => {
    if (!start_date || !start_time || !end_date || !end_time) {
      return;
    }
    const start = new Date(`${start_date}T${start_time}`);
    const end = new Date(`${end_date}T${end_time}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }
    const diff = end - start;
    if (diff > 0) {
      totalMilliseconds += diff;
    }
  });
  return totalMilliseconds / (1000 * 60 * 60);
};

const getInitialFormState = () => ({
  employee_name: '',
  job_position: '',
  date_completed: getTodayDate(),
  department: '',
  anticipated_hours: '',
  explanation: '',
  employee_signature: '',
  supervisor_signature: '',
  management_signature: '',
  approval_date: ''
});

function OvertimeForm({ token }) {
  const sigCanvasRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([
    {
      start_date: '',
      end_date: '',
      start_time: '',
      end_time: ''
    }
  ]);
  const [form, setForm] = useState(getInitialFormState);

  useEffect(() => {
    const totalHours = calculateTotalHoursFromPeriods(periods);
    const hoursText = totalHours > 0 ? totalHours.toFixed(2) : '';
    setForm(prev => {
      if (prev.anticipated_hours === hoursText) {
        return prev;
      }
      return { ...prev, anticipated_hours: hoursText };
    });
  }, [periods]);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setForm(prev => ({
          ...prev,
          employee_name: data.full_name || prev.employee_name,
          job_position: data.role === 'coordinator' ? 'Head Coordinator' : 'Intern',
          employee_signature: data.full_name || prev.employee_signature
        }));
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [token]);

  const updateFormField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updatePeriod = (index, field, value) => {
    setPeriods(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const validateForm = () => {
    if (!form.employee_name.trim()) {
      return 'Employee name is required.';
    }
    if (!form.job_position.trim()) {
      return 'Job position is required.';
    }
    if (!form.date_completed) {
      return 'Date of completion is required.';
    }
    if (!form.department) {
      return 'Please select a department.';
    }
    const todayIso = getTodayDate();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const cutoffMinutes = 15 * 60;
    const hasSameDayPeriod = periods.some(period =>
      period.start_date === todayIso && period.end_date === todayIso
    );
    if (hasSameDayPeriod && nowMinutes >= cutoffMinutes) {
      return 'Same-day overtime requests must be submitted before 3:00 PM.';
    }
    const hasAnyPeriod = periods.some(period => period.start_date || period.end_date || period.start_time || period.end_time);
    if (!hasAnyPeriod) {
      return 'Add at least one overtime period.';
    }
    for (let index = 0; index < periods.length; index += 1) {
      const period = periods[index];
      const hasEntry = period.start_date || period.end_date || period.start_time || period.end_time;
      if (!hasEntry) {
        continue;
      }
      if (!period.start_date || !period.end_date || !period.start_time || !period.end_time) {
        return `Period ${index + 1} is incomplete. Please fill all date and time fields.`;
      }
      const start = new Date(`${period.start_date}T${period.start_time}`);
      const end = new Date(`${period.end_date}T${period.end_time}`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return `Period ${index + 1} has an invalid date or time.`;
      }
      if (end <= start) {
        return `Period ${index + 1} must end after it starts.`;
      }
    }
    const totalHours = calculateTotalHoursFromPeriods(periods);
    if (totalHours <= 0) {
      return 'Anticipated overtime hours could not be calculated. Please review your periods.';
    }
    if (!form.explanation.trim()) {
      return 'Please provide an explanation for the overtime.';
    }
    if (!form.employee_signature) {
      return 'Please sign the form before submitting.';
    }
    return '';
  };

  const addRow = () => {
    setPeriods(prev => [...prev, { start_date: '', end_date: '', start_time: '', end_time: '' }]);
  };

  const removeRow = (index) => {
    setPeriods(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    const validationError = validateForm();
    if (validationError) {
      setAlert({ type: 'error', title: 'Validation error', message: validationError });
      return;
    }
    setSaving(true);
    try {
      let signatureUrl = form.employee_signature;

      // Upload signature to Supabase bucket if it's a data URL
      if (form.employee_signature && form.employee_signature.startsWith('data:')) {
        try {
          const canvas = sigCanvasRef.current;
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          const timestamp = Date.now();
          const fileName = `signature_${timestamp}_${form.employee_name.replace(/\s+/g, '_')}.png`;
          
          const { data, error } = await supabase.storage
            .from('signature')
            .upload(fileName, blob, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) {
            console.error('Signature upload error:', error);
            setAlert({ type: 'error', title: 'Upload warning', message: 'Signature uploaded locally but bucket save failed. Proceeding with submission.' });
          } else {
            // Get public URL
            const { data: publicData } = supabase.storage
              .from('signature')
              .getPublicUrl(data.path);
            signatureUrl = publicData.publicUrl;
          }
        } catch (uploadErr) {
          console.error('Signature upload failed:', uploadErr);
          // Continue with data URL if bucket upload fails
        }
      }

      const payload = {
        ...form,
        employee_signature: signatureUrl,
        periods: periods.filter(p => p.start_date || p.end_date || p.start_time || p.end_time)
      };
      await axios.post(`${API}/overtime`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlert({ type: 'success', title: 'Submitted', message: 'Overtime request submitted successfully.' });
      setPeriods([{
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: ''
      }]);
      if (sigCanvasRef.current) {
        clearSignature();
      }
      setForm(getInitialFormState());
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit overtime request.';
      setAlert({ type: 'error', title: 'Error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const getPos = (event) => {
    const canvas = sigCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (event) => {
    event.preventDefault();
    setIsDrawing(true);
    const ctx = sigCanvasRef.current.getContext('2d');
    const { x, y } = getPos(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event) => {
    if (!isDrawing) return;
    event.preventDefault();
    const ctx = sigCanvasRef.current.getContext('2d');
    const { x, y } = getPos(event);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const dataUrl = sigCanvasRef.current.toDataURL('image/png');
    updateFormField('employee_signature', dataUrl);
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateFormField('employee_signature', '');
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
      <div className="overtime-card" style={{boxSizing: 'border-box', maxWidth: '100%'}}>
        {loading ? (
          <CardSkeleton />
        ) : (
          <>
        <div className="overtime-heading">
          <h2>Overtime Request Form</h2>
          <p>Submit overtime details for approval.</p>
        </div>

        <form onSubmit={handleSubmit} className="overtime-form">
          <div className="overtime-grid">
            <div className="overtime-field">
              <label>Employee Name</label>
              <input
                type="text"
                value={form.employee_name}
                onChange={(e) => updateFormField('employee_name', e.target.value)}
                required
              />
            </div>
            <div className="overtime-field">
              <label>Job Position</label>
              <input
                type="text"
                value={form.job_position}
                onChange={(e) => updateFormField('job_position', e.target.value)}
                required
              />
            </div>
            <div className="overtime-field">
              <label>Date Form Completed</label>
              <input
                type="date"
                value={form.date_completed}
                onChange={(e) => updateFormField('date_completed', e.target.value)}
                required
              />
            </div>
            <div className="overtime-field span-3">
              <label>Department</label>
              <select
                value={form.department}
                onChange={(e) => updateFormField('department', e.target.value)}
                required
              >
                <option value="">Select department</option>
                <option value="IT Department">IT Department</option>
                <option value="HR Department">HR Department</option>
                <option value="Architecture Department">Architects Department</option>
                <option value="Engineering Department">Engineering Department</option>
              </select>
            </div>
          </div>

          <div className="overtime-section">
            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              {periods.map((p, idx) => (
                <div key={`period-${idx}`} style={{
                  background: '#00273C',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem'}}>
                    <h4 style={{color: '#e8eaed', margin: 0, fontSize: '0.9rem'}}>Period {idx + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={periods.length <= 1}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 113, 32, 0.3)',
                        color: periods.length <= 1 ? '#6b7280' : '#FF7120',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        cursor: periods.length <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{display: 'grid', gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr', gap: '0.75rem'}}>
                    <div>
                      <label style={{display: 'block', color: '#a0a4a8', marginBottom: '0.4rem', fontSize: '0.85rem'}}>Start Date</label>
                      <input
                        type="date"
                        value={p.start_date}
                        onChange={(e) => updatePeriod(idx, 'start_date', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: '#001a2b',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{display: 'block', color: '#a0a4a8', marginBottom: '0.4rem', fontSize: '0.85rem'}}>End Date</label>
                      <input
                        type="date"
                        value={p.end_date}
                        onChange={(e) => updatePeriod(idx, 'end_date', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: '#001a2b',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{display: 'block', color: '#a0a4a8', marginBottom: '0.4rem', fontSize: '0.85rem'}}>Start Time</label>
                      <select
                        value={p.start_time}
                        onChange={(e) => updatePeriod(idx, 'start_time', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: '#001a2b',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      >
                        <option value="">Select time</option>
                        {TIME_SLOTS.map(slot => (
                          <option key={`start-${slot.value}`} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{display: 'block', color: '#a0a4a8', marginBottom: '0.4rem', fontSize: '0.85rem'}}>End Time</label>
                      <select
                        value={p.end_time}
                        onChange={(e) => updatePeriod(idx, 'end_time', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: '#001a2b',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      >
                        <option value="">Select time</option>
                        {TIME_SLOTS.map(slot => (
                          <option key={`end-${slot.value}`} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addRow} style={{
                width: '100%',
                background: '#FF7120',
                color: 'white',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}>
                Add Period
              </button>
            </div>
          </div>

          <div className="overtime-grid hours-explanation">
            <div className="overtime-field">
              <label>Anticipated Number of Overtime Hours</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.anticipated_hours}
                readOnly
              />
            </div>
            <div className="overtime-field stretch">
              <label>Please provide an explanation of the work that requires overtime</label>
              <textarea
                rows="4"
                value={form.explanation}
                onChange={(e) => updateFormField('explanation', e.target.value)}
              />
            </div>
          </div>

              
          <div className="overtime-section">
            <h4>Approval</h4>
            <div className="overtime-grid">
              <div className="overtime-field">
                <label>Employee Signature</label>
                <div className="signature-pad">
                  <canvas
                    ref={sigCanvasRef}
                    width={400}
                    height={140}
                    style={{maxWidth: '100%', height: 'auto'}}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                  />
                  <div className="signature-actions">
                    <button type="button" className="ghost" onClick={clearSignature}>
                      Clear
                    </button>
                    <span className="signature-hint">Sign with mouse or finger</span>
                  </div>
                </div>
              </div>
              <div className="overtime-field">
                <label>Supervisor Signature</label>
                <input
                  type="text"
                  placeholder="To be signed"
                  disabled
                />
              </div>
              <div className="overtime-field">
                <label>Top Management Signature</label>
                <input
                  type="text"
                  placeholder="To be signed"
                  disabled
                />
              </div>
              <div className="overtime-field">
                <label>Date of Approval</label>
                <input
                  type="text"
                  placeholder="Wait for approval"
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="overtime-instructions">
            <h4>Instructions</h4>
            <ul>
              <li>No overtime will be paid unless this form has been completed prior to overtime. In emergencies, complete within the same week.</li>
              <li>The employee must submit a signed timesheet for specific overtime work before payroll completion.</li>
              <li>The form will be returned to the immediate supervisor.</li>
            </ul>
          </div>

          <div className="overtime-submit">
            <button type="submit" disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Overtime Request'}
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  );
}

export default OvertimeForm;
