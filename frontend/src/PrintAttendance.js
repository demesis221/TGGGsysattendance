import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PrintAttendance.css';
import { Printer, X } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function PrintAttendance({ token, internId, internName, filterType, selectedDate, onClose }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  useEffect(() => {
    // Set default to current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setStartMonth(currentMonth);
    setEndMonth(currentMonth);
  }, []);

  useEffect(() => {
    if (startMonth && endMonth) {
      fetchAttendance();
    }
    // eslint-disable-next-line
  }, [internId, startMonth, endMonth]);

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
      
      // Filter by month range
      if (startMonth && endMonth) {
        filtered = filtered.filter(a => {
          const recordDate = new Date(a.date);
          const recordMonth = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
          return recordMonth >= startMonth && recordMonth <= endMonth;
        });
      }
      
      const consolidatedByDate = {};
      filtered.forEach(entry => {
        if (!consolidatedByDate[entry.date]) {
          consolidatedByDate[entry.date] = {
            date: entry.date,
            work_mode: entry.work_mode || 'onsite',
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
    console.log('=== PRINT DEBUG ===');
    const printContents = document.querySelectorAll('.print-content');
    console.log(`Total pages: ${printContents.length}`);
    
    printContents.forEach((page, idx) => {
      const rect = page.getBoundingClientRect();
      const monthSections = page.querySelectorAll('.month-section');
      console.log(`Page ${idx + 1}:`);
      console.log(`  - Height: ${rect.height}px (${(rect.height / 37.795).toFixed(2)}cm)`);
      console.log(`  - Months: ${monthSections.length}`);
      monthSections.forEach((section, mIdx) => {
        const mRect = section.getBoundingClientRect();
        const style = window.getComputedStyle(section);
        console.log(`    Month ${mIdx + 1}: height=${mRect.height}px, position=${style.position}, top=${style.top}`);
      });
    });
    
    setTimeout(() => {
      console.log('\n=== AFTER PRINT DIALOG ===');
      const afterPrintContents = document.querySelectorAll('.print-content');
      console.log(`Pages after print: ${afterPrintContents.length}`);
      afterPrintContents.forEach((page, idx) => {
        const rect = page.getBoundingClientRect();
        console.log(`Page ${idx + 1}: ${rect.height}px (${(rect.height / 37.795).toFixed(2)}cm)`);
      });
      console.log('==================\n');
    }, 100);
    
    window.print();
  };

  const getMonthsInRange = () => {
    if (!startMonth || !endMonth) return [];
    
    const months = [];
    const start = new Date(startMonth + '-01');
    const end = new Date(endMonth + '-01');
    
    let current = new Date(start);
    while (current <= end) {
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  const groupMonthsForPages = () => {
    const months = getMonthsInRange();
    const pages = [];
    
    for (let i = 0; i < months.length; i += 2) {
      pages.push(months.slice(i, i + 2));
    }
    
    return pages;
  };

  const getAttendanceForMonth = (month) => {
    return attendance.filter(record => {
      const recordDate = new Date(record.date);
      const recordMonth = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
      return recordMonth === month;
    });
  };

  const calculateSummaryForMonth = (monthAttendance) => {
    let totalAttendance = 0;
    let totalAbsences = 0;
    let totalOTMinutes = 0;
    let lateCount = 0;
    let lateMinutes = 0;
    let earlyCount = 0;
    let earlyMinutes = 0;

    monthAttendance.forEach(record => {
      const hasAnyAttendance = record.morning_time_in || record.afternoon_time_in;
      if (hasAnyAttendance) totalAttendance++;
      else totalAbsences++;

      if (record.morning_time_in) {
        const inMin = parseMinutes(record.morning_time_in);
        const graceMin = 8 * 60 + 5;
        if (inMin > graceMin) {
          lateCount++;
          lateMinutes += inMin - (8 * 60);
        }
      }
      if (record.afternoon_time_in) {
        const inMin = parseMinutes(record.afternoon_time_in);
        const graceMin = 13 * 60 + 5;
        if (inMin > graceMin) {
          lateCount++;
          lateMinutes += inMin - (13 * 60);
        }
      }

      if (record.morning_time_out) {
        const outMin = parseMinutes(record.morning_time_out);
        const expectedMin = 12 * 60;
        if (outMin < expectedMin) {
          earlyCount++;
          earlyMinutes += expectedMin - outMin;
        }
      }
      if (record.afternoon_time_out) {
        const outMin = parseMinutes(record.afternoon_time_out);
        const expectedMin = 17 * 60;
        if (outMin < expectedMin) {
          earlyCount++;
          earlyMinutes += expectedMin - outMin;
        }
      }

      if (record.ot_time_in && record.ot_time_out) {
        totalOTMinutes += calculateMinutesWorked(record.ot_time_in, record.ot_time_out, 'Overtime');
      }
    });

    return {
      totalAttendance,
      totalAbsences,
      otHours: Math.floor(totalOTMinutes / 60),
      otMinutes: totalOTMinutes % 60,
      lateCount,
      lateMinutes,
      earlyCount,
      earlyMinutes
    };
  };

  const getMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const pages = groupMonthsForPages();

  const formatDateWithDay = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${day}/${days[date.getDay()]}`;
  };

  return (
    <div className="print-container">
      <div className="no-print">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="month-filter">
            <label>Start Month:</label>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
            />
          </div>
          <div className="month-filter">
            <label>End Month:</label>
            <input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
            />
          </div>
        </div>
        <div className="button-group">
          <button onClick={onClose} className="close-btn"><X size={16} /> Close</button>
          <button onClick={handlePrint} className="print-btn"><Printer size={16} /> Print</button>
        </div>
      </div>
      
      {pages.map((pageMonths, pageIndex) => (
        <div key={pageIndex} className="print-content">
          <h1 className="print-title">Attendance and Time Report</h1>
          
          {loading ? (
            <p>Loading...</p>
          ) : (
            <>
              {pageMonths.map((month, monthIndex) => {
                const monthAttendance = getAttendanceForMonth(month);
                const monthSummary = calculateSummaryForMonth(monthAttendance);
                
                return (
                  <div key={month} className="month-section">
                    {/* HEADER SUMMARY SECTION */}
                    <table className="summary-table">
                      <tbody>
                        <tr>
                          <td className="label-cell">Dept.</td>
                          <td colSpan="3">Main Office</td>
                          <td className="label-cell">Name</td>
                          <td colSpan="5">{internName}</td>
                        </tr>
                        <tr>
                          <td className="label-cell">Date</td>
                          <td colSpan="3">{getMonthName(month)}</td>
                          <td className="label-cell">ID</td>
                          <td colSpan="5">{internId.substring(0, 8)}</td>
                        </tr>
                        <tr>
                          <td className="group-header">Absences (Day)</td>
                          <td className="group-header">Leave (Day)</td>
                          <td className="group-header">Business trip (Day)</td>
                          <td className="group-header">Attendance (Day)</td>
                          <td className="group-header" colSpan="2">OT</td>
                          <td className="group-header" colSpan="2">Late</td>
                          <td className="group-header" colSpan="2">Early</td>
                        </tr>
                        <tr>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td className="sub-header">Normal</td>
                          <td className="sub-header">Special</td>
                          <td className="sub-header">Frequency</td>
                          <td className="sub-header">Min</td>
                          <td className="sub-header">Frequency</td>
                          <td className="sub-header">Min</td>
                        </tr>
                        <tr className="summary-data">
                          <td>{monthSummary.totalAbsences.toFixed(1)}</td>
                          <td>0.0</td>
                          <td>0.0</td>
                          <td>{monthSummary.totalAttendance.toFixed(1)}</td>
                          <td>{String(monthSummary.otHours).padStart(2, '0')}:{String(monthSummary.otMinutes).padStart(2, '0')}</td>
                          <td>00:00</td>
                          <td>{monthSummary.lateCount}</td>
                          <td>{monthSummary.lateMinutes}</td>
                          <td>{monthSummary.earlyCount}</td>
                          <td>{monthSummary.earlyMinutes}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* DETAILED DAILY REPORT SECTION */}
                    <table className="detail-table">
                      <thead>
                        <tr>
                          <th colSpan="8" className="section-title">All Report</th>
                        </tr>
                        <tr>
                          <th rowSpan="2">Date/Week</th>
                          <th rowSpan="2">Mode</th>
                          <th colSpan="2">Morning</th>
                          <th colSpan="2">Afternoon</th>
                          <th colSpan="2">OT</th>
                        </tr>
                        <tr>
                          <th>In</th>
                          <th>Out</th>
                          <th>In</th>
                          <th>Out</th>
                          <th>In</th>
                          <th>Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthAttendance.map(record => (
                          <tr key={record.date}>
                            <td>{formatDateWithDay(record.date)}</td>
                            <td style={{ fontSize: '0.7rem', fontWeight: '600' }}>
                              {record.work_mode === 'online' ? '💻' : '🏢'}
                            </td>
                            <td>{record.morning_time_in ? formatTime(record.morning_time_in) : <span className="missed">Missed</span>}</td>
                            <td>{record.morning_time_out ? formatTime(record.morning_time_out) : <span className="missed">Missed</span>}</td>
                            <td>{record.afternoon_time_in ? formatTime(record.afternoon_time_in) : <span className="missed">Missed</span>}</td>
                            <td>{record.afternoon_time_out ? formatTime(record.afternoon_time_out) : <span className="missed">Missed</span>}</td>
                            <td>{record.ot_time_in ? formatTime(record.ot_time_in) : ''}</td>
                            <td>{record.ot_time_out ? formatTime(record.ot_time_out) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default PrintAttendance;
