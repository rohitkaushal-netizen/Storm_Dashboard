import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar
} from 'recharts';
import StatCard from '../components/StatCard';
import { groupBy, getStatusColor } from '../utils/csvParser';
import { SLA_HOURS } from '../utils/workingHours';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#3b82f6'];

export default function LeadershipView({ tickets }) {
  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.isOpen);
    const closed = tickets.filter(t => t.isClosed);
    const breached = tickets.filter(t => t.slaBreached);
    const urgent = tickets.filter(t => t.priority === 'Urgent');
    const reopened = tickets.filter(t => t.totalReopenedCount > 0);

    const slaBreachRate = total ? ((breached.length / total) * 100).toFixed(1) : 0;
    const closureRate = total ? ((closed.length / total) * 100).toFixed(1) : 0;

    const avgTAT = (() => {
      const ts = closed.filter(t => t.workingTAT != null);
      return ts.length ? (ts.reduce((s, t) => s + t.workingTAT, 0) / ts.length).toFixed(1) : '—';
    })();

    // Performance by team member (assignee)
    const byAssignee = groupBy(tickets, 'assigneeName');
    const teamPerf = Object.entries(byAssignee)
      .filter(([name]) => name && name !== 'Unknown')
      .map(([name, arr]) => {
        const closedArr = arr.filter(t => t.isClosed);
        const openArr = arr.filter(t => t.isOpen);
        const breachedArr = arr.filter(t => t.slaBreached);
        const avgTATMember = closedArr.filter(t => t.workingTAT != null).length
          ? (closedArr.filter(t => t.workingTAT != null).reduce((s, t) => s + t.workingTAT, 0) / closedArr.filter(t => t.workingTAT != null).length).toFixed(1)
          : '—';
        return {
          name: name.split(' ')[0],
          fullName: name,
          total: arr.length,
          closed: closedArr.length,
          open: openArr.length,
          breached: breachedArr.length,
          avgTAT: avgTATMember,
          closureRate: arr.length ? ((closedArr.length / arr.length) * 100).toFixed(0) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Tickets by paid status
    const byPaid = groupBy(tickets, 'paidStatus');
    const paidData = Object.entries(byPaid).map(([name, arr]) => ({
      name: name || 'Unknown',
      value: arr.length,
    }));

    // SLA compliance by ticket type
    const byType = groupBy(tickets, 'shortCode');
    const typeCompliance = Object.entries(byType)
      .map(([name, arr]) => ({
        name,
        total: arr.length,
        compliant: arr.filter(t => !t.slaBreached).length,
        breached: arr.filter(t => t.slaBreached).length,
        breachRate: arr.length ? ((arr.filter(t => t.slaBreached).length / arr.length) * 100).toFixed(0) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Overall status funnel
    const statusFunnel = [
      { name: 'Total', value: total, fill: '#6366f1' },
      { name: 'Open', value: open.length, fill: '#3b82f6' },
      { name: 'Breached SLA', value: breached.length, fill: '#ef4444' },
      { name: 'Closed', value: closed.length, fill: '#10b981' },
    ];

    return { total, open, closed, breached, urgent, reopened, slaBreachRate, closureRate, avgTAT, teamPerf, paidData, typeCompliance, statusFunnel };
  }, [tickets]);

  return (
    <div className="view-container">
      <div className="leadership-banner">
        <div className="banner-metric">
          <div className="banner-num">{stats.closureRate}%</div>
          <div className="banner-label">Closure Rate</div>
        </div>
        <div className="banner-divider" />
        <div className="banner-metric">
          <div className="banner-num" style={{ color: parseFloat(stats.slaBreachRate) > 20 ? '#ef4444' : '#10b981' }}>{stats.slaBreachRate}%</div>
          <div className="banner-label">SLA Breach Rate</div>
        </div>
        <div className="banner-divider" />
        <div className="banner-metric">
          <div className="banner-num">{stats.avgTAT}h</div>
          <div className="banner-label">Avg Closure TAT</div>
        </div>
        <div className="banner-divider" />
        <div className="banner-metric">
          <div className="banner-num">{stats.total}</div>
          <div className="banner-label">Total Tickets</div>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Open Tickets" value={stats.open.length} color="#3b82f6" />
        <StatCard label="Closed Tickets" value={stats.closed.length} color="#10b981" />
        <StatCard label="SLA Breached" value={stats.breached.length} sub={`>${SLA_HOURS}h working time`} color="#ef4444" />
        <StatCard label="Urgent Priority" value={stats.urgent.length} color="#dc2626" />
        <StatCard label="Reopened" value={stats.reopened.length} color="#f59e0b" />
      </div>

      <div className="charts-grid">
        <div className="chart-card chart-card--wide">
          <h3>Team Performance Overview</h3>
          <div className="table-scroll">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th>Total</th>
                  <th>Open</th>
                  <th>Closed</th>
                  <th>SLA Breached</th>
                  <th>Avg TAT (hrs)</th>
                  <th>Closure %</th>
                </tr>
              </thead>
              <tbody>
                {stats.teamPerf.map((m, i) => (
                  <tr key={i}>
                    <td><b>{m.fullName}</b></td>
                    <td>{m.total}</td>
                    <td><span className="badge-blue">{m.open}</span></td>
                    <td><span className="badge-green">{m.closed}</span></td>
                    <td>
                      <span className={m.breached > 0 ? 'badge-red' : 'badge-green'}>{m.breached}</span>
                    </td>
                    <td>{m.avgTAT}</td>
                    <td>
                      <div className="mini-bar-wrap">
                        <div className="mini-bar" style={{ width: `${m.closureRate}%`, background: m.closureRate > 70 ? '#10b981' : m.closureRate > 40 ? '#f59e0b' : '#ef4444' }} />
                        <span>{m.closureRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <h3>SLA Breach by Ticket Type</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.typeCompliance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="compliant" name="On-time" stackId="a" fill="#10b981" />
              <Bar dataKey="breached" name="Breached" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Paid vs Unpaid Projects</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={stats.paidData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {stats.paidData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
