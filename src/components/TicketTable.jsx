import { useState } from 'react';
import { getStatusColor } from '../utils/csvParser';
import { ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import DeadlineCell from './DeadlineCell';
import { useNow } from '../hooks/useNow';

const COLS = [
  { key: 'ticketKey',     label: 'Ticket' },
  { key: 'shortCode',     label: 'Type' },
  { key: 'summary',       label: 'Summary' },
  { key: 'creatorName',   label: 'Raised By' },
  { key: 'assigneeName',  label: 'Assignee' },
  { key: 'currentStatus', label: 'Status' },
  { key: 'priority',      label: 'Priority' },
  { key: 'workingTAT',    label: 'Working TAT (hrs)' },
  { key: 'slaDeadline',   label: 'SLA Deadline / Status' },
  { key: 'createdAt',     label: 'Created' },
  { key: 'updatedAt',     label: 'Last Updated' },
  { key: 'lastUpdatedBy', label: 'Last Updated By' },
];

function fmt(val, key) {
  if (val === null || val === undefined || val === '') return '—';
  if (key === 'workingTAT') return typeof val === 'number' ? val.toFixed(1) + 'h' : '—';
  if (val instanceof Date) return val.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
  return String(val);
}

export default function TicketTable({ tickets, title }) {
  const now = useNow();
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const toggleSort = (key) => {
    if (key === 'slaDeadline') return; // live column, skip sort
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  const sorted = [...tickets].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  return (
    <div className="ticket-table-wrap">
      {title && <h3 className="table-title">{title} <span className="count-badge">{tickets.length}</span></h3>}
      <div className="table-scroll">
        <table className="ticket-table">
          <thead>
            <tr>
              {COLS.map(c => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`sortable-th ${c.key === 'slaDeadline' ? 'col-deadline-th' : ''}`}
                >
                  {c.label}
                  {sortKey === c.key ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((t, i) => (
              <tr key={t.id || i} className={t.slaBreached && t.isOpen ? 'row-sla-breach' : ''}>
                {COLS.map(c => (
                  <td key={c.key} className={c.key === 'slaDeadline' ? 'col-deadline-td' : ''}>
                    {c.key === 'ticketKey' && t.ticketLink ? (
                      <a href={t.ticketLink} target="_blank" rel="noreferrer" className="ticket-link">
                        {t.ticketKey} <ExternalLink size={11} />
                      </a>
                    ) : c.key === 'currentStatus' ? (
                      <span className="status-badge" style={{ background: getStatusColor(t.currentStatus) }}>
                        {t.currentStatus || 'New'}
                      </span>
                    ) : c.key === 'priority' ? (
                      <span className={`priority-badge priority-${(t.priority || '').toLowerCase()}`}>
                        {t.priority || '—'}
                      </span>
                    ) : c.key === 'lastUpdatedBy' ? (
                      t.lastUpdatedBy
                        ? <span className="updated-by-pill" title={t.lastActivitySection || ''}>
                            {t.lastUpdatedBy}
                            {t.lastActivitySection && (
                              <span className="updated-by-action"> · {t.lastActivitySection}</span>
                            )}
                          </span>
                        : '—'
                    ) : c.key === 'slaDeadline' ? (
                      <DeadlineCell ticket={t} now={now} />
                    ) : (
                      fmt(t[c.key], c.key)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={COLS.length} className="empty-row">No tickets</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</button>
          <span>{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>Next</button>
        </div>
      )}
    </div>
  );
}
