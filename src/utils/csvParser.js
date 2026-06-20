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

  // Active period start: replay status + assignee changes in chronological
  // order. A fresh SLA window begins whenever:
  //   - the ticket comes OUT of "Info Required" (info was provided), or
  //   - the assignee changes while the clock is running (the new owner
  //     gets a clean window from the moment they actually receive it —
  //     time spent with a prior/wrong assignee doesn't count against them)
  // Assignee changes that happen WHILE paused (mid Info-Required) don't
  // affect anything — the clock is already stopped.
  //
  // Simultaneously build the full list of active (non-paused) windows, and
  // a merged reset timeline, so the UI can show the entire calculation
  // journey — not just the current window.
  const resetEvents = events.filter(e => e['name'] === 'Status Changed' || e['name'] === 'Assignee Changed');

  let activePeriodStart = createdAt;
  let wasPaused = false;
  let windowStart = createdAt;
  const activeWindows = [];
  const resetTimeline = [];

  for (const e of resetEvents) {
    let tag = null;
    if (e['name'] === 'Status Changed') {
      const nowPaused = e['new_value'] === 'Info Required';
      if (!wasPaused && nowPaused) {
        activeWindows.push({ start: windowStart, end: e._at });
        tag = 'pause';
      } else if (wasPaused && !nowPaused) {
        activePeriodStart = e._at;
        windowStart = e._at;
        tag = 'resume';
      }
      wasPaused = nowPaused;
    } else if (e['name'] === 'Assignee Changed' && !wasPaused) {
      activeWindows.push({ start: windowStart, end: e._at });
      activePeriodStart = e._at;
      windowStart = e._at;
      tag = 'reassign';
    }
    resetTimeline.push({
      at: e._at,
      type: e['name'] === 'Status Changed' ? 'status' : 'assignee',
      from: e['old_value'] === 'null' ? null : e['old_value'],
      to: e['new_value'] === 'null' ? null : e['new_value'],
      by: e['full_name'] || null,
      tag,
    });
  }

  // End of the current active window:
  //   Info Required: frozen at the moment it was paused (last status event)
  //   Closed: at the last recorded event
  //   Open (active): now
  let endTime;
  if (tatPaused)      endTime = statusEvents[statusEvents.length - 1]._at;
  else if (isClosed)  endTime = updatedAt;
  else                endTime = new Date();

  // Trailing window (the one still running, or the one that ended at closure)
  if (!wasPaused) {
    activeWindows.push({ start: windowStart, end: endTime });
  }

  const windows = activeWindows.map((w, i) => ({
    start: w.start,
    end: w.end,
    hours: workingHoursBetween(w.start, w.end),
    isCurrent: i === activeWindows.length - 1,
  }));
  const cumulativeWorkingTAT = windows.reduce((s, w) => s + w.hours, 0);

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
    cumulativeWorkingTAT,
    windows,
    tatPaused,
    slaBreached,
    slaDeadline,
    lastUpdatedBy,
    lastActivityName,
    totalReopenedCount,
    lastReopenedDate,
    lastReopenedBy,
    // Full event trail, for the "calculation journey" drill-down view
    resetTimeline,
    statusTimeline: statusEvents.map(se => ({
      at: se._at,
      from: se['old_value'] === 'null' ? null : se['old_value'],
      to: se['new_value'],
      by: se['full_name'] || null,
    })),
    events: events.map(e => ({
      at: e._at,
      name: e['name'],
      from: e['old_value'] === 'null' ? null : e['old_value'],
      to: e['new_value'] === 'null' ? null : e['new_value'],
      by: e['full_name'] || null,
    })),
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
