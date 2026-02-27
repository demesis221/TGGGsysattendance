import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PrintAttendance.css';
import { Printer, X } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function PrintAttendance({ token, internId, internName, filterType, selectedDate, onClose }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line
  }, [internId, filterType, selectedDate]);

  const parseMinutes = (timeStr) => {
    if (!timeStr) return null;
    if (!timeStr.includes('AM') && !timeStr.includes('PM')) {
      const parts = timeStr.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    const [time, meridiem] = timeStr.split(' ');
    if (!meridiem) return null;
    let [h, m] = time.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const calculateMinutesWorked = (timeIn, timeOut, session) => {
    if (!timeIn || !timeOut) return 0;
    const inMinutes = parseMinutes(timeIn);
    const outMinutes = parseMinutes(timeOut);
    if (inMinutes === null || outMinutes === null) return 0;
    if (inMinutes === outMinutes) return 0;
    
    const morningBaseline = 8 * 60;
    const afternoonBaseline = 13 * 60;
    const overtimeBaseline = 19 * 60;
    const morningGrace = 8 * 60 + 5;
    const afternoonGrace = 13 * 60 + 5;
    const overtimeGrace = 19 * 60 + 5;
    const morningEnd = 12 * 60;
    const afternoonEnd = 17 * 60;
    const overtimeEnd = 22 * 60;
    
    if (session === 'Morning') {
      const effectiveStart = inMinutes <= morningGrace ? morningBaseline : inMinutes;
      const effectiveEnd = Math.min(outMinutes, morningEnd);
      return Math.max(0, effectiveEnd - effectiveStart);
    } else if (session === 'Afternoon') {
      const effectiveStart = inMinutes <= afternoonGrace ? afternoonBaseline : inMinutes;
      const effectiveEnd = Math.min(outMinutes, afternoonEnd);
      return Math.max(0, effectiveEnd - effectiveStart);
    } else if (session === 'Overtime') {
      const effectiveStart = inMinutes <= overtimeGrace ? overtimeBaseline : inMinutes;
      const effectiveEnd = Math.min(outMinutes, overtimeEnd);
      return Math.max(0, effectiveEnd - effectiveStart);
    }
    return 0;
  };

  const determineSession = (timeIn) => {
    if (!timeIn) return null;
    let hour;
    if (timeIn.includes('AM') || timeIn.includes('PM')) {
      const [time] = timeIn.split(' ');
      const [h] = time.split(':');
      hour = parseInt(h, 10);
      if (timeIn.includes('PM') && hour !== 12) hour += 12;
      if (timeIn.includes('AM') && hour === 12) hour = 0;
    } else {
      const [h] = timeIn.split(':');
      hour = parseInt(h, 10);
    }
    if (hour < 12) return 'Morning';
    if (hour >= 12 && hour < 18) return 'Afternoon';
    return 'Overtime';
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '-') return '-';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/attendance/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let filtered = data.filter(a => a.user_id === internId);
      
      if (filterType === 'daily' && selectedDate) {
        filtered = filtered.filter(a => a.date === selectedDate);
      } else if (filterType === 'weekly' && selectedDate) {
        const weekStart = new Date(selectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        filtered = filtered.filter(a => {
          const date = new Date(a.date);
          return date >= weekStart && date <= weekEnd;
        });
      }
      
      const consolidatedByDate = {};
      filtered.forEach(entry => {
        if (!consolidatedByDate[entry.date]) {
          consolidatedByDate[entry.date] = {
            date: entry.date,
            morning_time_in: null,
            morning_time_out: null,
            afternoon_time_in: null,
            afternoon_time_out: null,
            ot_time_in: null,
            ot_time_out: null,
            total_minutes_worked: 0
          };
        }
        
        const record = consolidatedByDate[entry.date];
        const session = determineSession(entry.time_in);
        
        if (session === 'Morning') {
          record.morning_time_in = entry.time_in;
          record.morning_time_out = entry.time_out;
        } else if (session === 'Afternoon') {
          record.afternoon_time_in = entry.time_in;
          record.afternoon_time_out = entry.time_out;
        } else if (session === 'Overtime') {
          record.ot_time_in = entry.time_in;
          record.ot_time_out = entry.time_out;
        }
        
        let minutesWorked = 0;
        if (entry.total_minutes_worked) {
          minutesWorked = entry.total_minutes_worked;
        } else if (entry.time_out) {
          minutesWorked = calculateMinutesWorked(entry.time_in, entry.time_out, session);
        }
        record.total_minutes_worked += minutesWorked;
      });
      
      setAttendance(Object.values(consolidatedByDate).sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const getDateRange = () => {
    if (filterType === 'daily') return selectedDate;
    if (filterType === 'weekly') {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
    }
    return 'All Time';
  };

  const hasOvertime = attendance.some(record => record.ot_time_in || record.ot_time_out);

  return (
    <div className="print-container">
      <div className="no-print">
        <button onClick={onClose} className="close-btn"><X size={16} /> Close</button>
        <button onClick={handlePrint} className="print-btn"><Printer size={16} /> Print</button>
      </div>
      
      <div className="print-content">
        <h1 className="print-title">TRIPLE G INTERNSHIP ATTENDANCE SHEET</h1>
        
        <div className="print-info">
          <p><strong>Intern Name:</strong> {internName}</p>
          <p><strong>Period:</strong> {getDateRange()}</p>
          <p><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="print-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>AM In</th>
                <th>AM Out</th>
                <th>PM In</th>
                <th>PM Out</th>
                {hasOvertime && <th>OT In</th>}
                {hasOvertime && <th>OT Out</th>}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map(record => (
                <tr key={record.date}>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>{formatTime(record.morning_time_in) || '-'}</td>
                  <td>{formatTime(record.morning_time_out) || '-'}</td>
                  <td>{formatTime(record.afternoon_time_in) || '-'}</td>
                  <td>{formatTime(record.afternoon_time_out) || '-'}</td>
                  {hasOvertime && <td>{formatTime(record.ot_time_in) || '-'}</td>}
                  {hasOvertime && <td>{formatTime(record.ot_time_out) || '-'}</td>}
                  <td>
                    {record.total_minutes_worked > 0
                      ? `${Math.floor(record.total_minutes_worked / 60)}h ${record.total_minutes_worked % 60}m`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PrintAttendance;
