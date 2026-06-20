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

// One ticket's full calculation journey: status timeline + window breakdown + final numbers
function TicketJourney({ ticket }) {
  const t = ticket;
  return (
    <div className="journey-panel">
      <div className="journey-section">
        <h4>Status Timeline</h4>
        <div className="journey-timeline">
          <div className="journey-event journey-event--create">
            <span className="journey-dot" />
            <div>
              <div className="journey-event-title">Created</div>
              <div className="journey-event-time">{fmt(t.createdAt)}</div>
            </div>
          </div>
          {t.statusTimeline.map((se, i) => (
            <div key={i} className={`journey-event ${se.to === 'Info Required' ? 'journey-event--pause' : se.from === 'Info Required' ? 'journey-event--resume' : ''}`}>
              <span className="journey-dot" style={{ background: getStatusColor(se.to) }} />
              <div>
                <div className="journey-event-title">
                  {se.from || 'New'} → <strong>{se.to}</strong>
                  {se.from === 'Info Required' && <span className="journey-tag journey-tag--resume">window starts here</span>}
                  {se.to === 'Info Required' && <span className="journey-tag journey-tag--pause">clock paused</span>}
                </div>
                <div className="journey-event-time">{fmt(se.at)} {se.by && `· by ${se.by}`}</div>
              </div>
            </div>
          ))}
          {t.tatPaused && (
            <div className="journey-event journey-event--current">
              <span className="journey-dot journey-dot--live" />
              <div>
                <div className="journey-event-title">Currently paused (Info Required)</div>
                <div className="journey-event-time">Clock frozen since {fmt(t.statusTimeline[t.statusTimeline.length - 1]?.at)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="journey-section">
        <h4>Active Windows (working hours, excludes Info Required pauses)</h4>
        <table className="journey-windows">
          <thead>
            <tr><th>#</th><th>Start</th><th>End</th><th>Working Hours</th><th></th></tr>
          </thead>
          <tbody>
            {t.windows.map((w, i) => (
              <tr key={i} className={w.isCurrent ? 'journey-window-current' : ''}>
                <td>{i + 1}</td>
                <td>{fmtShort(w.start)}</td>
                <td>{fmtShort(w.end)}</td>
                <td>{w.hours.toFixed(2)}h</td>
                <td>{w.isCurrent && <span className="journey-tag journey-tag--current">used for SLA</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="journey-section journey-result">
        <h4>Result</h4>
        <div className="journey-result-grid">
          <div>
            <div className="journey-result-label">Current-window TAT (used for SLA)</div>
            <div className="journey-result-value">{t.workingTAT?.toFixed(2)}h</div>
          </div>
          <div>
            <div className="journey-result-label">Cumulative TAT (all windows)</div>
            <div className="journey-result-value">{t.cumulativeWorkingTAT?.toFixed(2)}h</div>
          </div>
          <div>
            <div className="journey-result-label">SLA Deadline</div>
            <div className="journey-result-value">{fmtShort(t.slaDeadline)}</div>
          </div>
          <div>
            <div className="journey-result-label">Breach Status</div>
            <div className={`journey-result-value ${t.slaBreached ? 'journey-breached' : 'journey-ok'}`}>
              {t.tatPaused ? 'Paused' : t.slaBreached ? `Breached (>${SLA_HOURS}h)` : 'Within SLA'}
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
