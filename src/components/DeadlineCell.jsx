import { SLA_HOURS } from '../utils/workingHours';
import { workingHoursBetween } from '../utils/workingHours';

function fmtDeadline(d) {
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Calcutta',
  });
}

function fmtDuration(totalMinutes) {
  const absMin = Math.abs(totalMinutes);
  const d = Math.floor(absMin / (60 * 24));
  const h = Math.floor((absMin % (60 * 24)) / 60);
  const m = Math.floor(absMin % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DeadlineCell({ ticket, now }) {
  const { slaDeadline, isClosed, activePeriodStart, workingTAT, tatPaused } = ticket;
  if (!slaDeadline || !activePeriodStart) return <span className="dl-na">—</span>;

  // Info Required: TAT clock is paused — show frozen progress, no countdown
  if (tatPaused) {
    const consumed = workingTAT ?? 0;
    const pct = Math.min((consumed / SLA_HOURS) * 100, 100);
    return (
      <div className="dl-cell">
        <div className="dl-date">{fmtDeadline(slaDeadline)}</div>
        <div className="dl-timer dl-paused">⏸ Paused (Info Required)</div>
        <div className="dl-bar-wrap">
          <div className="dl-bar-fill" style={{ width: `${pct}%`, background: '#94a3b8' }} />
          <span className="dl-bar-label">{consumed.toFixed(1)}h / {SLA_HOURS}h</span>
        </div>
      </div>
    );
  }

  // For closed tickets: show whether SLA was met
  if (isClosed) {
    const met = !ticket.slaBreached;
    return (
      <div className="dl-closed">
        <span className={`dl-met-badge ${met ? 'dl-met' : 'dl-missed'}`}>
          {met ? '✓ Met SLA' : `✗ Breached`}
        </span>
        {!met && workingTAT != null && (
          <span className="dl-overdue-by">by {fmtDuration((workingTAT - SLA_HOURS) * 60)}</span>
        )}
      </div>
    );
  }

  // For open tickets: live countdown
  const msLeft = slaDeadline.getTime() - now.getTime();
  const minLeft = msLeft / 60000;
  const isOverdue = msLeft < 0;

  // Working hours consumed so far (for the progress bar), measured from TAT window start
  const consumed = workingHoursBetween(activePeriodStart, now);
  const pct = Math.min((consumed / SLA_HOURS) * 100, 100);

  let urgency = 'dl-ok';
  if (isOverdue)      urgency = 'dl-overdue';
  else if (minLeft < 60)  urgency = 'dl-critical';   // < 1h
  else if (minLeft < 180) urgency = 'dl-warning';    // < 3h
  else if (minLeft < 360) urgency = 'dl-caution';    // < 6h

  const barColor = isOverdue ? '#b91c1c'
    : pct > 83 ? '#ef4444'
    : pct > 67 ? '#f97316'
    : pct > 50 ? '#fbbf24'
    : '#10b981';

  return (
    <div className="dl-cell">
      <div className="dl-date">{fmtDeadline(slaDeadline)}</div>
      <div className={`dl-timer ${urgency}`}>
        {isOverdue
          ? `Overdue by ${fmtDuration(Math.abs(minLeft))}`
          : `${fmtDuration(minLeft)} left`}
      </div>
      <div className="dl-bar-wrap">
        <div className="dl-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
        <span className="dl-bar-label">
          {consumed.toFixed(1)}h / {SLA_HOURS}h
        </span>
      </div>
    </div>
  );
}
