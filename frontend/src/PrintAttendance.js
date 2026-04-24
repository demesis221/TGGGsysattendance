import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Printer, X } from 'lucide-react';
import './PrintAttendance.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const DEFAULT_OFFICIAL_HOURS = {
  amIn: '08:00',
  amOut: '12:00',
  pmIn: '13:00',
  pmOut: '17:00'
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const DAY_LABELS = {
  saturday: 'Saturday',
  sunday: 'Sunday'
};

const toMonthKey = (dateObj) => {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthKeyFromDate = (dateStr) => {
  if (!dateStr) return '';

  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return toMonthKey(parsed);
};

const getDayFromDate = (dateStr) => {
  if (!dateStr) return 0;

  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return parseInt(isoMatch[3], 10);
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getDate();
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;

  const value = String(timeStr).trim().toUpperCase();
  if (!value) return null;

  const amPmMatch = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (amPmMatch) {
    let hour = parseInt(amPmMatch[1], 10);
    const minute = parseInt(amPmMatch[2], 10);
    const period = amPmMatch[3].toUpperCase();

    if (minute > 59 || hour > 12 || hour < 1) return null;
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    return (hour * 60) + minute;
  }

  const twentyFourMatch = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourMatch) {
    const hour = parseInt(twentyFourMatch[1], 10);
    const minute = parseInt(twentyFourMatch[2], 10);

    if (hour > 23 || minute > 59) return null;
    return (hour * 60) + minute;
  }

  return null;
};

const toTimeInput = (timeStr) => {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes === null) return '';

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const formatTimeForPrint = (timeValue) => {
  const minutes = parseTimeToMinutes(timeValue);
  if (minutes === null) return '';

  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
};

const determineSession = (timeIn) => {
  const minutes = parseTimeToMinutes(timeIn);
  if (minutes === null) return null;

  if (minutes < 12 * 60) return 'Morning';
  if (minutes < 18 * 60) return 'Afternoon';
  return 'Overtime';
};

const getMonthsInRange = (startMonth, endMonth) => {
  if (!startMonth || !endMonth) return [];

  const start = new Date(`${startMonth}-01T00:00:00`);
  const end = new Date(`${endMonth}-01T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const months = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    months.push(toMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

const createEmptyMonthData = (monthKey) => {
  const [yearText, monthText] = monthKey.split('-');
  const year = parseInt(yearText, 10);
  const month = parseInt(monthText, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  const rows = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;

    if (day > daysInMonth) {
      return {
        day,
        dayType: 'invalid',
        dayLabel: '',
        amIn: '',
        amOut: '',
        pmIn: '',
        pmOut: ''
      };
    }

    const weekday = new Date(year, month - 1, day).getDay();
    let dayType = 'weekday';
    if (weekday === 6) dayType = 'saturday';
    if (weekday === 0) dayType = 'sunday';

    return {
      day,
      dayType,
      dayLabel: DAY_LABELS[dayType] || '',
      amIn: '',
      amOut: '',
      pmIn: '',
      pmOut: ''
    };
  });

  return {
    monthKey,
    daysInMonth,
    rows
  };
};

const chooseTime = (existingTime, candidateTime, preference) => {
  if (!candidateTime) return existingTime || '';
  if (!existingTime) return candidateTime;

  const existingMinutes = parseTimeToMinutes(existingTime);
  const candidateMinutes = parseTimeToMinutes(candidateTime);

  if (existingMinutes === null || candidateMinutes === null) return existingTime;

  if (preference === 'min') {
    return candidateMinutes < existingMinutes ? candidateTime : existingTime;
  }

  return candidateMinutes > existingMinutes ? candidateTime : existingTime;
};

const calculateSessionMinutesWithinOfficialHours = (inTime, outTime, officialIn, officialOut) => {
  const inMinutes = parseTimeToMinutes(inTime);
  const outMinutes = parseTimeToMinutes(outTime);
  const officialInMinutes = parseTimeToMinutes(officialIn);
  const officialOutMinutes = parseTimeToMinutes(officialOut);

  if (inMinutes === null || outMinutes === null) return 0;

  let effectiveStart = inMinutes;
  let effectiveEnd = outMinutes;

  if (officialInMinutes !== null) {
    effectiveStart = Math.max(effectiveStart, officialInMinutes);
  }
  if (officialOutMinutes !== null) {
    effectiveEnd = Math.min(effectiveEnd, officialOutMinutes);
  }

  const diff = effectiveEnd - effectiveStart;
  return diff > 0 ? diff : 0;
};

const calculateDailyMinutes = (row, officialHours) => {
  return calculateSessionMinutesWithinOfficialHours(
    row.amIn,
    row.amOut,
    officialHours.amIn,
    officialHours.amOut
  ) + calculateSessionMinutesWithinOfficialHours(
    row.pmIn,
    row.pmOut,
    officialHours.pmIn,
    officialHours.pmOut
  );
};

const calculateDailyLateMinutes = (row, officialHours) => {
  const officialAmIn = parseTimeToMinutes(officialHours.amIn);
  const officialPmIn = parseTimeToMinutes(officialHours.pmIn);
  const amIn = parseTimeToMinutes(row.amIn);
  const pmIn = parseTimeToMinutes(row.pmIn);

  let totalLate = 0;

  if (officialAmIn !== null && amIn !== null && amIn > officialAmIn) {
    totalLate += amIn - officialAmIn;
  }
  if (officialPmIn !== null && pmIn !== null && pmIn > officialPmIn) {
    totalLate += pmIn - officialPmIn;
  }

  return totalLate;
};

const formatMonthLabel = (monthKey) => {
  const [yearText, monthText] = monthKey.split('-');
  const monthIndex = parseInt(monthText, 10) - 1;
  return `${MONTH_NAMES[monthIndex] || monthText} ${yearText}`;
};

function PrintAttendance({ token, internId, internName, filterType, selectedDate, onClose }) {
  const savedTitleRef = useRef('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [officialHours] = useState(DEFAULT_OFFICIAL_HOURS);
  const [dtrData, setDtrData] = useState({});

  useEffect(() => {
    const today = new Date();
    const currentMonth = toMonthKey(today);

    if ((filterType === 'daily' || filterType === 'weekly') && selectedDate) {
      const selectedMonth = selectedDate.slice(0, 7);
      setStartMonth(selectedMonth || currentMonth);
      setEndMonth(selectedMonth || currentMonth);
      return;
    }

    setStartMonth(currentMonth);
    setEndMonth(currentMonth);
  }, [filterType, selectedDate]);

  useEffect(() => {
    const handleBeforePrint = () => {
      savedTitleRef.current = document.title;
      document.title = '';
    };

    const handleAfterPrint = () => {
      if (savedTitleRef.current) {
        document.title = savedTitleRef.current;
      }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      if (savedTitleRef.current) {
        document.title = savedTitleRef.current;
      }
    };
  }, []);

  const monthsToRender = useMemo(() => {
    const baseMonths = getMonthsInRange(startMonth, endMonth);

    if (baseMonths.length === 0) {
      return [];
    }

    if (baseMonths.length % 2 !== 0) {
      const [yearText, monthText] = baseMonths[baseMonths.length - 1].split('-');
      const nextMonthDate = new Date(parseInt(yearText, 10), parseInt(monthText, 10) - 1, 1);
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      baseMonths.push(toMonthKey(nextMonthDate));
    }

    return baseMonths;
  }, [startMonth, endMonth]);

  const monthPairs = useMemo(() => {
    const pairs = [];

    for (let index = 0; index < monthsToRender.length; index += 2) {
      pairs.push([monthsToRender[index], monthsToRender[index + 1]]);
    }

    return pairs;
  }, [monthsToRender]);

  useEffect(() => {
    if (!token || !internId || monthsToRender.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchAttendance = async () => {
      setLoading(true);
      setError('');

      try {
        const { data } = await axios.get(`${API}/attendance/all`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const monthSet = new Set(monthsToRender);
        const nextData = {};

        monthsToRender.forEach((monthKey) => {
          nextData[monthKey] = createEmptyMonthData(monthKey);
        });

        (data || [])
          .filter((entry) => entry.user_id === internId)
          .forEach((entry) => {
            const monthKey = getMonthKeyFromDate(entry.date);
            if (!monthSet.has(monthKey)) return;

            const day = getDayFromDate(entry.date);
            if (day < 1 || day > 31) return;

            const monthData = nextData[monthKey];
            if (!monthData || day > monthData.daysInMonth) return;

            const row = monthData.rows[day - 1];
            const session = determineSession(entry.time_in);
            const timeIn = toTimeInput(entry.time_in);
            const timeOut = toTimeInput(entry.time_out);

            if (session === 'Morning') {
              row.amIn = chooseTime(row.amIn, timeIn, 'min');
              row.amOut = chooseTime(row.amOut, timeOut, 'max');
            } else if (session === 'Afternoon') {
              row.pmIn = chooseTime(row.pmIn, timeIn, 'min');
              row.pmOut = chooseTime(row.pmOut, timeOut, 'max');
            }
          });

        if (!cancelled) {
          setDtrData(nextData);
        }
      } catch (fetchError) {
        console.error('Failed to fetch DTR data:', fetchError);
        if (!cancelled) {
          setError('Failed to load attendance records for printing.');
          setDtrData({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAttendance();

    return () => {
      cancelled = true;
    };
  }, [token, internId, monthsToRender]);

  const monthStats = useMemo(() => {
    const stats = {};

    monthsToRender.forEach((monthKey) => {
      const monthData = dtrData[monthKey] || createEmptyMonthData(monthKey);
      let totalMinutes = 0;
      let lateMinutes = 0;

      monthData.rows.forEach((row) => {
        if (row.day > monthData.daysInMonth) return;
        totalMinutes += calculateDailyMinutes(row, officialHours);
        lateMinutes += calculateDailyLateMinutes(row, officialHours);
      });

      stats[monthKey] = {
        totalMinutes,
        lateMinutes
      };
    });

    return stats;
  }, [dtrData, monthsToRender, officialHours]);

  const handleFieldChange = (monthKey, day, field, value) => {
    const sanitizedValue = toTimeInput(value);

    setDtrData((prev) => {
      const monthData = prev[monthKey] || createEmptyMonthData(monthKey);
      const rows = monthData.rows.map((row) => {
        if (row.day !== day) return row;
        return { ...row, [field]: sanitizedValue };
      });

      return {
        ...prev,
        [monthKey]: {
          ...monthData,
          rows
        }
      };
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const renderTimeCell = (monthKey, row, field) => {
    if (row.dayType === 'invalid') {
      return <td><span className="print-value" /></td>;
    }

    const value = row[field] || '';

    return (
      <td>
        <input
          type="time"
          className="time-input screen-only"
          value={value}
          placeholder="--:--"
          onChange={(event) => handleFieldChange(monthKey, row.day, field, event.target.value)}
        />
        <span className="print-value">{formatTimeForPrint(value)}</span>
      </td>
    );
  };

  const DTRForm = ({ monthKey }) => {
    const monthData = dtrData[monthKey] || createEmptyMonthData(monthKey);
    const totals = monthStats[monthKey] || { totalMinutes: 0, lateMinutes: 0 };
    const totalHours = Math.floor(totals.totalMinutes / 60);
    const totalMins = totals.totalMinutes % 60;
    const officialHoursText = `${formatTimeForPrint(officialHours.amIn)} - ${formatTimeForPrint(officialHours.amOut)} / ${formatTimeForPrint(officialHours.pmIn)} - ${formatTimeForPrint(officialHours.pmOut)}`;

    return (
      <section className="dtr-form">
        <div className="dtr-header">
          <h2>DAILY TIME RECORD</h2>
          <div className="name-line-wrap">
            <span className="name-value">{internName || ''}</span>
          </div>
          <p className="name-caption">Name</p>
        </div>

        <div className="dtr-meta-lines">
          <div className="meta-line">
            <span className="meta-label">For the month of</span>
            <span className="meta-fill">{formatMonthLabel(monthKey)}</span>
          </div>
          <div className="meta-line">
            <span className="meta-label">Office Hours (regular days)</span>
            <span className="meta-fill">{officialHoursText}</span>
          </div>
          <div className="meta-line">
            <span className="meta-label">Arrival &amp; Departure</span>
            <span className="meta-fill" />
          </div>
          <div className="meta-line">
            <span className="meta-label">Saturdays</span>
            <span className="meta-fill" />
          </div>
        </div>

        <div className="dtr-grid-wrap">
          <table className="dtr-grid">
          <thead>
            <tr>
              <th rowSpan="2" className="day-index-header">&nbsp;</th>
              <th colSpan="2">A.M.</th>
              <th colSpan="2">P.M.</th>
              <th rowSpan="2">Hours</th>
              <th rowSpan="2">Min.</th>
            </tr>
            <tr>
              <th>Arrival</th>
              <th>Departure</th>
              <th>Arrival</th>
              <th>Departure</th>
            </tr>
          </thead>
          <tbody>
            {monthData.rows.map((row) => {
              const dailyMinutes = row.dayType === 'invalid' ? 0 : calculateDailyMinutes(row, officialHours);

              return (
                <tr key={`${monthKey}-${row.day}`} className={`${row.dayType}-row`}>
                  <td className="day-cell">
                    <span className="day-number">{row.day}</span>
                  </td>
                  {renderTimeCell(monthKey, row, 'amIn')}
                  {renderTimeCell(monthKey, row, 'amOut')}
                  {renderTimeCell(monthKey, row, 'pmIn')}
                  {renderTimeCell(monthKey, row, 'pmOut')}
                  <td>{dailyMinutes > 0 ? Math.floor(dailyMinutes / 60) : ''}</td>
                  <td>{dailyMinutes > 0 ? dailyMinutes % 60 : ''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan="5">Total</td>
              <td>{totalHours}</td>
              <td>{totalMins}</td>
            </tr>
          </tfoot>
          </table>
        </div>

        <div className="dtr-footer">
          <p className="legal-text">
            I certify on my honor that the above is true and correct record of the hours of work
            performed, record of which was made daily at the time of arrival and departure from office.
          </p>

          <div className="signature-block employee-signature">
            <div className="signature-line" />
            <p className="signature-label">(Signature)</p>
          </div>

          <p className="verified-text">Verified as to the prescribed office hours</p>

          <div className="signature-block">
            <div className="signature-line" />
            <p className="signature-label">(In-charge)</p>
          </div>

          <p className="late-note">Late Minutes: {totals.lateMinutes}</p>
        </div>
      </section>
    );
  };

  return (
    <div className="dtr-print-container">
      <div className="dtr-toolbar no-print">
        <button type="button" className="dtr-close-icon-btn" onClick={onClose} aria-label="Back">
          <X size={16} />
        </button>

        <div className="toolbar-group">
          <label>
            Start Month
            <input type="month" value={startMonth} onChange={(event) => setStartMonth(event.target.value)} />
          </label>
          <label>
            End Month
            <input type="month" value={endMonth} onChange={(event) => setEndMonth(event.target.value)} />
          </label>
        </div>

        <div className="toolbar-actions">
          <button type="button" className="dtr-print-btn" onClick={handlePrint}>
            <Printer size={16} />
            Print
          </button>
        </div>
        <p className="dtr-print-tip">For a clean form, disable "Headers and footers" in the print dialog.</p>
      </div>

      {!loading && monthsToRender.length === 0 && (
        <p className="dtr-message no-print">Please select a valid month range.</p>
      )}
      {error && <p className="dtr-message no-print">{error}</p>}

      {loading ? (
        <p className="dtr-message">Loading DTR...</p>
      ) : (
        <div className="dtr-pages">
          {monthPairs.map(([leftMonth, rightMonth]) => (
            <div key={`${leftMonth}-${rightMonth}`} className="dtr-print-page">
              <div className="dtr-container">
                <DTRForm monthKey={leftMonth} />
                <div className="dtr-cut-line" aria-hidden="true" />
                <DTRForm monthKey={rightMonth} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PrintAttendance;