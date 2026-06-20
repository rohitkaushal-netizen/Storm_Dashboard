import { useMemo } from 'react';
import StatCard from '../components/StatCard';
import { groupBy } from '../utils/csvParser';
import { SLA_HOURS } from '../utils/workingHours';

export default function LeadershipView({ tickets }) {
  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.isOpen);
    const closed = tickets.filter(t => t.isClosed);
    const breached = tickets.filter(t => t.slaBreached);
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

    return { total, open, closed, breached, reopened, slaBreachRate, closureRate, avgTAT, teamPerf };
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
      </div>
    </div>
  );
}
