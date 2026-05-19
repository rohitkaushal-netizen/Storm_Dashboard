import { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

const PRESETS = [
  { label: 'Today',      getDates: () => { const d = today(); return [d, d]; } },
  { label: 'Yesterday',  getDates: () => { const d = daysAgo(1); return [d, d]; } },
  { label: 'Last 7d',    getDates: () => [daysAgo(6), today()] },
  { label: 'Last 30d',   getDates: () => [daysAgo(29), today()] },
  { label: 'This Month', getDates: () => [monthStart(), today()] },
  { label: 'All Time',   getDates: () => [null, null] },
];

function today() {
  return toDateStr(new Date());
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}
function monthStart() {
  const d = new Date();
  d.setDate(1);
  return toDateStr(d);
}
function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

export default function DateFilter({ onChange }) {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [activePreset, setActivePreset] = useState('All Time');

  useEffect(() => {
    onChange(from, to);
  }, [from, to]);

  const applyPreset = (preset) => {
    const [f, t] = preset.getDates();
    setFrom(f);
    setTo(t);
    setActivePreset(preset.label);
  };

  const handleFrom = (e) => {
    setFrom(e.target.value || null);
    setActivePreset(null);
  };
  const handleTo = (e) => {
    setTo(e.target.value || null);
    setActivePreset(null);
  };

  const clear = () => {
    setFrom(null);
    setTo(null);
    setActivePreset('All Time');
  };

  const hasFilter = from || to;

  return (
    <div className="date-filter-bar">
      <Calendar size={14} className="date-filter-icon" />
      <span className="date-filter-label">Created:</span>

      <div className="preset-btns">
        {PRESETS.map(p => (
          <button
            key={p.label}
            className={`preset-btn ${activePreset === p.label ? 'active' : ''}`}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="date-range-inputs">
        <input
          type="date"
          className="date-input"
          value={from || ''}
          onChange={handleFrom}
          title="From date"
        />
        <span className="date-sep">→</span>
        <input
          type="date"
          className="date-input"
          value={to || ''}
          onChange={handleTo}
          min={from || ''}
          title="To date"
        />
      </div>

      {hasFilter && activePreset !== 'All Time' && (
        <button className="date-clear-btn" onClick={clear} title="Clear filter">
          <X size={13} />
        </button>
      )}
    </div>
  );
}
