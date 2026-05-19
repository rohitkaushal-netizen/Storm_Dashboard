import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts';
import StatCard from '../components/StatCard';
import TicketTable from '../components/TicketTable';
import { groupBy, getStatusColor } from '../utils/csvParser';
import { SLA_HOURS } from '../utils/workingHours';

const STATUS_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f97316', '#06b6d4', '#ef4444', '#6b7280'];

export default function ManagerView({ tickets }) {
  const stats = useMemo(() => {
    const open = tickets.filter(t => t.isOpen);
    const closed = tickets.filter(t => t.isClosed);
    const breached = open.filter(t => t.slaBreached);
    const infoReq = tickets.filter(t => t.currentStatus === 'Info Required');
    const reopened = tickets.filter(t => t.totalReopenedCount > 0);

    // Status distribution
    const byStatus = groupBy(tickets, 'currentStatus');
    const statusData = Object.entries(byStatus).map(([name, arr]) => ({
      name: name || 'New',
      value: arr.length,
      color: getStatusColor(name),
    }));

    // Pending by assignee
    const byAssignee = groupBy(open, 'assigneeName');
    const assigneeData = Object.entries(byAssignee)
      .map(([name, arr]) => ({
        name: name === 'Unknown' ? 'Unassigned' : name.split(' ')[0],
        open: arr.length,
        breached: arr.filter(t => t.slaBreached).length,
      }))
      .sort((a, b) => b.open - a.open);

    // Ticket type breakdown
    const byType = groupBy(tickets, 'shortCode');
    const typeData = Object.entries(byType)
      .map(([name, arr]) => ({ name, count: arr.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // TAT distribution for closed tickets
    const tatBuckets = { '0-4h': 0, '4-8h': 0, '8-12h': 0, '12-24h': 0, '24h+': 0 };
    closed.forEach(t => {
      const h = t.workingTAT || t.tatHours || 0;
      if (h <= 4) tatBuckets['0-4h']++;
      else if (h <= 8) tatBuckets['4-8h']++;
      else if (h <= 12) tatBuckets['8-12h']++;
      else if (h <= 24) tatBuckets['12-24h']++;
      else tatBuckets['24h+']++;
    });
    const tatData = Object.entries(tatBuckets).map(([name, count]) => ({ name, count }));

    // Priority breakdown for open breached tickets
    const urgentBreached = breached.filter(t => t.priority === 'Urgent').length;
    const highBreached = breached.filter(t => t.priority === 'High').length;

    return { open, closed, breached, infoReq, reopened, statusData, assigneeData, typeData, tatData, urgentBreached, highBreached };
  }, [tickets]);

  const slaBreachRate = tickets.length ? ((stats.breached.length / tickets.length) * 100).toFixed(1) : 0;
  const avgTAT = useMemo(() => {
    const ts = tickets.filter(t => t.workingTAT != null);
    return ts.length ? (ts.reduce((s, t) => s + t.workingTAT, 0) / ts.length).toFixed(1) : '—';
  }, [tickets]);

  return (
    <div className="view-container">
      <div className="stats-grid">
        <StatCard label="Total Tickets" value={tickets.length} color="#6366f1" />
        <StatCard label="Open / Pending" value={stats.open.length} color="#3b82f6" />
        <StatCard label="Closed" value={stats.closed.length} color="#10b981" />
        <StatCard label="SLA Breached (Open)" value={stats.breached.length} sub={`${slaBreachRate}% breach rate`} color="#ef4444" />
        <StatCard label="Info Required" value={stats.infoReq.length} color="#f97316" />
        <StatCard label="Avg Working TAT" value={avgTAT + 'h'} sub={`SLA = ${SLA_HOURS}h`} color="#8b5cf6" />
        <StatCard label="Reopened Tickets" value={stats.reopened.length} color="#f59e0b" />
        <StatCard label="Urgent SLA Breaches" value={stats.urgentBreached} color="#dc2626" />
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Ticket Status Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={stats.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {stats.statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color || STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Pending by Assignee</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.assigneeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="open" name="Open" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="breached" name="SLA Breached" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Ticket Type Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.typeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Closed Ticket TAT Distribution (Working Hours)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.tatData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" name="Tickets" radius={[4, 4, 0, 0]}>
                {stats.tatData.map((entry, i) => (
                  <Cell key={i} fill={entry.name === '12-24h' || entry.name === '24h+' ? '#ef4444' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <TicketTable tickets={stats.breached} title="SLA Breached — Open Tickets" />
      <TicketTable tickets={stats.infoReq} title="Awaiting Info from Creators" />
    </div>
  );
}
