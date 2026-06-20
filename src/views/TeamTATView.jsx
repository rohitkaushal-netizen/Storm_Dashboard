import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { isTeamMember } from '../utils/teamConfig';
import TicketDrilldown from '../components/TicketDrilldown';
import { SLA_HOURS } from '../utils/workingHours';

// SLA target is 8 working hours with a 1-hour grace period — breach only
// past 9 working hours (matches SLA_HOURS in workingHours.js). The 6-9h
// bucket absorbs everything below the 9h breach line so the line itself
// always falls exactly on a bucket boundary.
const BUCKETS = [
  { key: '0-2h',   label: '0–2h',   min: 0,  max: 2   },
  { key: '2-4h',   label: '2–4h',   min: 2,  max: 4   },
  { key: '4-6h',   label: '4–6h',   min: 4,  max: 6   },
  { key: '6-9h',   label: '6–9h',   min: 6,  max: 9   },
  { key: '9-12h',  label: '9–12h',  min: 9,  max: 12  },
  { key: '12-24h', label: '12–24h', min: 12, max: 24  },
  { key: '24-48h', label: '24–48h', min: 24, max: 48  },
  { key: '48-96h', label: '48–96h', min: 48, max: 96  },
  { key: '96h+',   label: '96h+',   min: 96, max: Infinity },
];

// First index that counts as a breach bucket (9h+) — used for highlighting.
const BREACH_INDEX = 4;

const BUCKET_COLORS = [
  '#10b981', '#34d399', '#6ee7b7', '#fbbf24',
  '#f97316', '#ef4444', '#dc2626', '#b91c1c', '#7f1d1d',
];

function getBucket(tat) {
  for (const b of BUCKETS) {
    if (tat >= b.min && tat < b.max) return b.key;
  }
  return '96h+';
}

export default function TeamTATView({ tickets }) {
  const [mode, setMode] = useState('count');
  const [highlight, setHighlight] = useState(null);
  const [drilldown, setDrilldown] = useState(null); // { title, tickets }

  const { members, chartData, totals } = useMemo(() => {
    // Filter to team members (by full name) with a valid working TAT
    const valid = tickets.filter(
      t => isTeamMember(t.assigneeName) && t.workingTAT != null && t.assigneeName
    );

    const memberMap = {};
    for (const t of valid) {
      const name = t.assigneeName;
      if (!memberMap[name]) {
        memberMap[name] = { name, tickets: [], buckets: {} };
        BUCKETS.forEach(b => { memberMap[name].buckets[b.key] = []; });
      }
      memberMap[name].buckets[getBucket(t.workingTAT)].push(t);
      memberMap[name].tickets.push(t);
    }

    const members = Object.values(memberMap).sort((a, b) => b.tickets.length - a.tickets.length);

    const chartData = members.map(m => {
      const total = m.tickets.length;
      const avg = total ? (m.tickets.reduce((s, t) => s + t.workingTAT, 0) / total) : 0;
      const row = { name: m.name.split(' ')[0], fullName: m.name, total, avg: avg.toFixed(1) };
      BUCKETS.forEach(b => {
        const cnt = m.buckets[b.key].length;
        row[b.key] = mode === 'pct'
          ? (total ? parseFloat(((cnt / total) * 100).toFixed(1)) : 0)
          : cnt;
        row[`${b.key}_raw`] = cnt;
      });
      return row;
    });

    const totals = { total: valid.length };
    BUCKETS.forEach(b => {
      totals[b.key] = valid.filter(t => getBucket(t.workingTAT) === b.key).length;
    });
    totals.avg = valid.length
      ? (valid.reduce((s, t) => s + t.workingTAT, 0) / valid.length).toFixed(1)
      : '—';

    return { members, chartData, totals };
  }, [tickets, mode]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="custom-tooltip tat-tooltip">
        <p className="tt-name">{d.fullName}</p>
        <p className="tt-sub">{d.total} tickets · avg {d.avg}h</p>
        <div className="tt-divider" />
        {BUCKETS.map((b, i) => {
          const cnt = d[`${b.key}_raw`];
          if (!cnt) return null;
          return (
            <div key={b.key} className="tt-row">
              <span className="tt-dot" style={{ background: BUCKET_COLORS[i] }} />
              <span className="tt-label">{b.label}</span>
              <span className="tt-val">{cnt}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="view-container">
      <div className="tat-header">
        <div>
          <h2 className="tat-title">Team TAT Distribution</h2>
          <p className="tat-sub">
            Information Services · {members.length} active members · {totals.total} tickets with TAT data
          </p>
        </div>
        <div className="tat-controls">
          <button className={`mode-btn ${mode === 'count' ? 'active' : ''}`} onClick={() => setMode('count')}>Count</button>
          <button className={`mode-btn ${mode === 'pct' ? 'active' : ''}`} onClick={() => setMode('pct')}>% Share</button>
        </div>
      </div>

      <div className="bucket-legend">
        {BUCKETS.map((b, i) => (
          <button
            key={b.key}
            className={`bucket-chip ${highlight === b.key ? 'active' : ''} ${i >= BREACH_INDEX ? 'breach' : ''}`}
            style={{ '--chip-color': BUCKET_COLORS[i] }}
            onClick={() => setHighlight(v => v === b.key ? null : b.key)}
            title={`${totals[b.key]} tickets in this range`}
          >
            <span className="chip-dot" style={{ background: BUCKET_COLORS[i] }} />
            {b.label}
            <span className="chip-count">{totals[b.key]}</span>
          </button>
        ))}
      </div>

      <div className="chart-card" style={{ marginBottom: 20 }}>
        <h3>Tickets per Assignee by TAT Bucket {mode === 'pct' ? '(% of assignee total)' : '(count)'}</h3>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} unit={mode === 'pct' ? '%' : ''} />
            <Tooltip content={<CustomTooltip />} />
            {BUCKETS.map((b, i) => (
              <Bar
                key={b.key}
                dataKey={b.key}
                name={b.label}
                stackId="a"
                fill={BUCKET_COLORS[i]}
                opacity={highlight ? (highlight === b.key ? 1 : 0.15) : 1}
                radius={i === BUCKETS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Detailed Breakdown</h3>
        <div className="table-scroll">
          <table className="tat-table">
            <thead>
              <tr>
                <th className="col-name">Team Member</th>
                <th>Total</th>
                <th>Avg TAT</th>
                {BUCKETS.map((b, i) => (
                  <th
                    key={b.key}
                    className={`col-bucket ${highlight === b.key ? 'col-highlight' : ''} ${i >= BREACH_INDEX ? 'col-breach' : ''}`}
                    onClick={() => setHighlight(v => v === b.key ? null : b.key)}
                    title="Click to highlight"
                  >
                    <span className="bucket-th-dot" style={{ background: BUCKET_COLORS[i] }} />
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, mi) => {
                const total = m.tickets.length;
                const avg = total
                  ? (m.tickets.reduce((s, t) => s + t.workingTAT, 0) / total).toFixed(1)
                  : '—';
                const slaBreached = BUCKETS.slice(BREACH_INDEX).reduce((s, b) => s + m.buckets[b.key].length, 0);
                const breachPct = total ? ((slaBreached / total) * 100).toFixed(0) : 0;

                return (
                  <tr key={mi}>
                    <td className="col-name">
                      <div className="member-cell">
                        <div className="member-avatar">{m.name[0]}</div>
                        <div>
                          <div className="member-name">{m.name}</div>
                          {slaBreached > 0 && (
                            <div className="member-breach">{slaBreached} SLA breach ({breachPct}%)</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td><strong>{total}</strong></td>
                    <td>
                      <span className={`avg-badge ${parseFloat(avg) > SLA_HOURS ? 'avg-red' : parseFloat(avg) > SLA_HOURS * 0.66 ? 'avg-yellow' : 'avg-green'}`}>
                        {avg}h
                      </span>
                    </td>
                    {BUCKETS.map((b, i) => {
                      const cnt = m.buckets[b.key].length;
                      const pct = total ? ((cnt / total) * 100).toFixed(0) : 0;
                      return (
                        <td
                          key={b.key}
                          className={`col-bucket ${highlight === b.key ? 'col-highlight' : ''} ${i >= BREACH_INDEX ? 'col-breach' : ''} ${cnt > 0 ? 'col-clickable' : ''}`}
                          onClick={() => cnt > 0 && setDrilldown({
                            title: `${m.name} · ${b.label} bucket`,
                            tickets: m.buckets[b.key],
                          })}
                          title={cnt > 0 ? `Click to view ${m.name}'s ${cnt} tickets in ${b.label}` : ''}
                        >
                          {cnt > 0
                            ? <div className="bucket-cell">
                                <span className="bucket-count">{cnt}</span>
                                <span className="bucket-pct">{pct}%</span>
                              </div>
                            : <span className="bucket-zero">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="totals-row">
                <td className="col-name"><strong>All Team</strong></td>
                <td><strong>{totals.total}</strong></td>
                <td>
                  <span className={`avg-badge ${parseFloat(totals.avg) > SLA_HOURS ? 'avg-red' : parseFloat(totals.avg) > SLA_HOURS * 0.66 ? 'avg-yellow' : 'avg-green'}`}>
                    {totals.avg}h
                  </span>
                </td>
                {BUCKETS.map((b, i) => {
                  const cnt = totals[b.key];
                  const pct = totals.total ? ((cnt / totals.total) * 100).toFixed(0) : 0;
                  return (
                    <td key={b.key} className={`col-bucket ${i >= BREACH_INDEX ? 'col-breach' : ''}`}>
                      {cnt > 0
                        ? <div className="bucket-cell">
                            <span className="bucket-count">{cnt}</span>
                            <span className="bucket-pct">{pct}%</span>
                          </div>
                        : <span className="bucket-zero">—</span>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {drilldown && (
        <TicketDrilldown
          title={drilldown.title}
          tickets={drilldown.tickets}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  );
}
