import { useState } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { SLA_HOURS } from '../utils/workingHours';
import { getStatusColor } from '../utils/csvParser';

function fmt(d) {
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    timeZone: 'Asia/Calcutta',
  });
}

function fmtShort(d) {
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Calcutta',
  });
}

// One ticket's calculation breakdown, from the available sheet columns.
// The sheet is one row per ticket (no per-event history), so this shows
// the timestamps that fed the calculation rather than a full timeline.
function TicketJourney({ ticket }) {
  const t = ticket;
  return (
    <div className="journey-panel">
      <div className="journey-section">
        <h4>Key Timestamps</h4>
        <table className="journey-windows">
          <tbody>
            <tr>
              <td>Created</td>
              <td>{fmt(t.createdAt)}</td>
              <td></td>
            </tr>
            {t.firstAssigneeChanged && (
              <tr>
                <td>Moved to team (dispatcher handoff)</td>
                <td>{fmt(t.firstAssigneeChanged)}</td>
                <td></td>
              </tr>
            )}
            {t.newCreationTimestampCs && t.newCreationTimestampCs.getTime() !== t.createdAt?.getTime() && (
              <tr>
                <td>System restart marker (Info Provided)</td>
                <td>{fmt(t.newCreationTimestampCs)}</td>
                <td></td>
              </tr>
            )}
            <tr className="journey-window-current">
              <td>Active period start (used for SLA)</td>
              <td>{fmt(t.activePeriodStart)}</td>
              <td><span className="journey-tag journey-tag--current">used for SLA</span></td>
            </tr>
            <tr>
              <td>{t.isClosed ? 'Closed' : 'Last updated'}</td>
              <td>{fmt(t.updatedAt)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="journey-section journey-result">
        <h4>Result</h4>
        <div className="journey-result-grid">
          <div>
            <div className="journey-result-label">Working TAT (active period start → {t.isClosed ? 'close' : 'now'})</div>
            <div className="journey-result-value">{t.workingTAT?.toFixed(2)}h</div>
          </div>
          <div>
            <div className="journey-result-label">SLA Deadline</div>
            <div className="journey-result-value">{fmtShort(t.slaDeadline)}</div>
          </div>
          <div>
            <div className="journey-result-label">Breach Status</div>
            <div className={`journey-result-value ${t.slaBreached ? 'journey-breached' : 'journey-ok'}`}>
              {t.tatPaused ? 'Paused (Info Required)' : t.slaBreached ? `Breached (>${SLA_HOURS}h)` : 'Within SLA'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TicketDrilldown({ title, tickets, onClose }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="drilldown-backdrop" onClick={onClose}>
      <div className="drilldown-panel" onClick={e => e.stopPropagation()}>
        <div className="drilldown-header">
          <div>
            <h3>{title}</h3>
            <p className="drilldown-count">{tickets.length} tickets</p>
          </div>
          <button className="drilldown-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="drilldown-body">
          {tickets.map(t => {
            const expanded = expandedId === t.id;
            return (
              <div key={t.id} className="drilldown-row">
                <div className="drilldown-row-header" onClick={() => setExpandedId(expanded ? null : t.id)}>
                  {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span className="drilldown-ticket-id">#{t.id}</span>
                  <span className="status-badge" style={{ background: getStatusColor(t.currentStatus) }}>
                    {t.currentStatus || 'New'}
                  </span>
                  <span className="drilldown-assignee">{t.assigneeName || 'Unassigned'}</span>
                  <span className="drilldown-tat">{t.workingTAT?.toFixed(1)}h</span>
                  <span className={`drilldown-breach ${t.slaBreached ? 'breach-yes' : 'breach-no'}`}>
                    {t.tatPaused ? 'Paused' : t.slaBreached ? 'Breached' : 'OK'}
                  </span>
                </div>
                {expanded && <TicketJourney ticket={t} />}
              </div>
            );
          })}
          {tickets.length === 0 && <div className="drilldown-empty">No tickets in this bucket</div>}
        </div>
      </div>
    </div>
  );
}
