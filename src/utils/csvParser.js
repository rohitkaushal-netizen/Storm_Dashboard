import Papa from 'papaparse';
import { workingHoursBetween, addWorkingHours, SLA_HOURS } from './workingHours';

// Statuses that count as "open" (pending resolution)
export const OPEN_STATUSES = ['Open', 'Reopened', 'In Progress', 'Info Required', 'Info Provided', 'New', null, ''];
export const CLOSED_STATUSES = ['Closed', 'Request Denied', 'Request Accepted'];

export function parseDate(val) {
  if (!val) return null;
  let v = String(val).trim();
  if (v.toLowerCase() === 'null') return null;

  // 1. Normalise space separator → T  (e.g. "2026-05-14 9:45:05")
  v = v.replace(' ', 'T');

  // 2. Pad single-digit hour so "T9:" → "T09:" (Google Sheets exports without zero-padding)
  v = v.replace(/T(\d):/, 'T0$1:');

  // 3. Strip any existing timezone marker (the system stores IST but often mislabels it)
  v = v.replace(/Z$/i, '');
  v = v.replace(/[+-]\d{2}:\d{2}$/, '');

  // 4. Re-tag as IST
  v = v + '+05:30';

  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ── Reconstruct tickets from the activity log ──────────────────────
// The sheet is now an event log: one row per change (status, assignee,
// comment, attachment, priority, description), keyed by ticket_id.
// We group by ticket_id, sort chronologically, and replay the journey to
// derive each ticket's current state, assignee, TAT and SLA window.

function computeTicketFromEvents(ticketId, rawEvents) {
  const events = rawEvents
    .map(r => ({ ...r, _at: parseDate(r['created_at']) }))
    .filter(e => e._at)
    .sort((a, b) => a._at - b._at);

  if (events.length === 0) return null;

  const creationEvent = events.find(e => e['name'] === 'New Ticket Created') || events[0];
  const createdAt = creationEvent._at;
  const creatorName = creationEvent['full_name'] || null;

  const statusEvents = events.filter(e => e['name'] === 'Status Changed');
  const assigneeEvents = events.filter(e => e['name'] === 'Assignee Changed');

  const lastEvent = events[events.length - 1];
  const updatedAt = lastEvent._at;
  const lastUpdatedBy = lastEvent['full_name'] || null;
  const lastActivityName = lastEvent['name'] || null;

  const currentStatus = statusEvents.length
    ? statusEvents[statusEvents.length - 1]['new_value']
    : 'New';
  const isClosed = CLOSED_STATUSES.includes(currentStatus);
  const isOpen = !isClosed;

  const assigneeName = assigneeEvents.length
    ? assigneeEvents[assigneeEvents.length - 1]['new_value']
    : creatorName;

  // Reopen tracking
  const reopenEvents = statusEvents.filter(e => e['new_value'] === 'Reopened');
  const totalReopenedCount = reopenEvents.length;
  const lastReopen = reopenEvents[reopenEvents.length - 1] || null;
  const lastReopenedDate = lastReopen ? lastReopen._at : null;
  const lastReopenedBy = lastReopen ? lastReopen['full_name'] : null;

  // TAT is paused while waiting for customer info — team not penalised
  const tatPaused = isOpen && currentStatus === 'Info Required';

  // Active period start: replay the status timeline. Every time the ticket
  // comes OUT of "Info Required", a fresh SLA window begins from that moment.
  // If it never paused, the window starts at creation.
  let activePeriodStart = createdAt;
  let wasPaused = false;
  for (const se of statusEvents) {
    const nowPaused = se['new_value'] === 'Info Required';
    if (wasPaused && !nowPaused) activePeriodStart = se._at;
    wasPaused = nowPaused;
  }

  // End of the current active window:
  //   Info Required: frozen at the moment it was paused (last status event)
  //   Closed: at the last recorded event
  //   Open (active): now
  let endTime;
  if (tatPaused)      endTime = statusEvents[statusEvents.length - 1]._at;
  else if (isClosed)  endTime = updatedAt;
  else                endTime = new Date();

  const workingTAT = activePeriodStart ? workingHoursBetween(activePeriodStart, endTime) : null;
  const slaDeadline = activePeriodStart ? addWorkingHours(activePeriodStart, SLA_HOURS) : null;
  const slaBreached = tatPaused ? false : (workingTAT !== null ? workingTAT > SLA_HOURS : false);

  return {
    id: ticketId,
    createdAt,
    activePeriodStart,
    updatedAt,
    creatorName,
    assigneeName,
    currentStatus,
    finalStatus: isClosed ? currentStatus : null,
    isOpen,
    isClosed,
    workingTAT,
    tatPaused,
    slaBreached,
    slaDeadline,
    lastUpdatedBy,
    lastActivityName,
    totalReopenedCount,
    lastReopenedDate,
    lastReopenedBy,
  };
}

function buildTicketsFromActivityLog(rows) {
  const byTicket = new Map();
  for (const row of rows) {
    const tid = row['ticket_id'];
    if (!tid) continue;
    if (!byTicket.has(tid)) byTicket.set(tid, []);
    byTicket.get(tid).push(row);
  }

  const tickets = [];
  for (const [ticketId, events] of byTicket) {
    const ticket = computeTicketFromEvents(ticketId, events);
    if (ticket) tickets.push(ticket);
  }
  return tickets;
}

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        const tickets = buildTicketsFromActivityLog(results.data);
        resolve(tickets);
      },
      error: reject,
    });
  });
}

export function getStatusColor(status) {
  const map = {
    'Closed': '#10b981',
    'Request Accepted': '#10b981',
    'Request Denied': '#ef4444',
    'New': '#3b82f6',
    'Open': '#3b82f6',
    'Reopened': '#f59e0b',
    'In Progress': '#8b5cf6',
    'Info Required': '#f97316',
    'Info Provided': '#06b6d4',
  };
  return map[status] || '#6b7280';
}

export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}
