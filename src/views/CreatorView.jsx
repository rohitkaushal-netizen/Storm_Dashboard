import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import TicketTable from '../components/TicketTable';
import { groupBy, getStatusColor } from '../utils/csvParser';

export default function CreatorView({ tickets }) {
  const [selectedCreator, setSelectedCreator] = useState('All');

  const creators = useMemo(() => {
    const names = [...new Set(tickets.map(t => t.creatorName).filter(Boolean))].sort();
    return ['All', ...names];
  }, [tickets]);

  const filtered = useMemo(() => {
    return selectedCreator === 'All' ? tickets : tickets.filter(t => t.creatorName === selectedCreator);
  }, [tickets, selectedCreator]);

  const stats = useMemo(() => {
    const open = filtered.filter(t => t.isOpen);
    const closed = filtered.filter(t => t.isClosed);
    const infoReq = filtered.filter(t => t.currentStatus === 'Info Required');
    const breached = open.filter(t => t.slaBreached);

    const byCreator = groupBy(filtered, 'creatorName');
    const creatorData = Object.entries(byCreator)
      .map(([name, arr]) => ({
        name: name.split(' ')[0],
        fullName: name,
        open: arr.filter(t => t.isOpen).length,
        closed: arr.filter(t => t.isClosed).length,
        breached: arr.filter(t => t.slaBreached && t.isOpen).length,
        infoReq: arr.filter(t => t.currentStatus === 'Info Required').length,
      }))
      .sort((a, b) => (b.open + b.closed) - (a.open + a.closed));

    const byStatus = groupBy(filtered, 'currentStatus');
    const statusData = Object.entries(byStatus)
      .map(([name, arr]) => ({ name: name || 'New', count: arr.length, color: getStatusColor(name) }))
      .sort((a, b) => b.count - a.count);

    return { open, closed, infoReq, breached, creatorData, statusData };
  }, [filtered]);

  return (
    <div className="view-container">
      <div className="filter-bar">
        <label className="filter-label">Filter by Creator:</label>
        <select
          className="filter-select"
          value={selectedCreator}
          onChange={e => setSelectedCreator(e.target.value)}
        >
          {creators.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="stats-grid">
        <StatCard label="My Tickets" value={filtered.length} color="#6366f1" />
        <StatCard label="Open" value={stats.open.length} color="#3b82f6" />
        <StatCard label="Closed" value={stats.closed.length} color="#10b981" />
        <StatCard label="Info Required from Me" value={stats.infoReq.length} color="#f97316" />
        <StatCard label="SLA Breached" value={stats.breached.length} color="#ef4444" />
      </div>

      {selectedCreator === 'All' && (
        <div className="charts-grid">
          <div className="chart-card chart-card--wide">
            <h3>Tickets by Creator</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.creatorData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="custom-tooltip">
                        <p><b>{d.fullName}</b></p>
                        <p>Open: {d.open}</p>
                        <p>Closed: {d.closed}</p>
                        <p>SLA Breached: {d.breached}</p>
                        <p>Info Req: {d.infoReq}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="open" name="Open" stackId="a" fill="#3b82f6" />
                <Bar dataKey="closed" name="Closed" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Status Breakdown</h3>
            <div className="status-list">
              {stats.statusData.map(s => (
                <div key={s.name} className="status-row">
                  <span className="status-dot" style={{ background: s.color }} />
                  <span className="status-name">{s.name}</span>
                  <span className="status-count">{s.count}</span>
                  <div className="status-bar-bg">
                    <div className="status-bar-fill" style={{ width: `${(s.count / filtered.length) * 100}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <TicketTable tickets={stats.infoReq} title="Action Required — Info Needed from You" />
      <TicketTable tickets={stats.open.filter(t => !stats.infoReq.includes(t))} title="Open Tickets" />
      {stats.closed.length > 0 && (
        <TicketTable tickets={stats.closed} title="Closed Tickets" />
      )}
    </div>
  );
}
