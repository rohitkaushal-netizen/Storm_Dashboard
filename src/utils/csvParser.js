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

function computeTicketMetrics(row) {
  const createdAt = parseDate(row['created_at'] || row['creation_date']);
  const updatedAt = parseDate(row['updated_at'] || row['updation_date']);
  const status = row['current_ticket_status'] || null;
  const finalStatus = row['Final_Ticket_Status'] || null;

  const isOpen = !CLOSED_STATUSES.includes(status) && !CLOSED_STATUSES.includes(finalStatus);
  const isClosed = CLOSED_STATUSES.includes(finalStatus) || CLOSED_STATUSES.includes(status);

  // Use pre-computed TAT columns when available, else compute from timestamps
  let tatHours = parseFloat(row['tat_in_hours']) || null;
  let firstResponseTAT = parseFloat(row['first_response_TAT']) || null;

  // TAT is paused while waiting for customer info — team is not penalised
  const tatPaused = isOpen && status === 'Info Required';

  // Reset signals, in order of how they apply:
  //   firstAssigneeChanged = when the ticket was first handed from a
  //     dispatcher (Prakash/Saurabh) to the actual Information Services
  //     handler — "ticket moved to team → time start"
  //   csRestart (new_creation_timestamp_cs) = the system's own restart
  //     marker, which moves forward again if the ticket later cycles
  //     through Info Required → Info Provided
  //   updatedAt = used only while currently Info Provided & open, since the
  //     system column may lag behind a just-happened status change
  //
  // The active period always starts at the LATEST of whichever of these
  // signals apply — i.e. the most recent reset, exactly matching the
  // "multi-TAT" rule: each handoff/Info-Provided event starts a fresh clock.
  const firstAssigneeChanged = parseDate(row['first_assignee_changed_info']);
  const csRestart = parseDate(row['new_creation_timestamp_cs']);

  const resetCandidates = [firstAssigneeChanged, csRestart];
  if (!isClosed && status === 'Info Provided' && updatedAt) resetCandidates.push(updatedAt);
  const validResets = resetCandidates.filter(Boolean);
  const activePeriodStart = validResets.length
    ? new Date(Math.max(...validResets.map(d => d.getTime())))
    : createdAt;

  // Working TAT for the current active period:
  //   - Info Required: frozen at the moment the clock was paused (updatedAt)
  //   - Closed: time from active period start to closure
  //   - Open: elapsed time from active period start to now
  let workingTAT = null;
  if (activePeriodStart) {
    let endTime;
    if (tatPaused)                   endTime = updatedAt || new Date();  // frozen
    else if (isClosed && updatedAt)  endTime = updatedAt;
    else                             endTime = new Date();
    workingTAT = workingHoursBetween(activePeriodStart, endTime);
  }

  // Paused tickets are not breached — clock is stopped
  const slaBreached = tatPaused
    ? false
    : (workingTAT !== null ? workingTAT > SLA_HOURS : (tatHours !== null ? tatHours > SLA_HOURS : false));

  // SLA deadline = active period start + SLA_HOURS working hours
  const slaDeadline = activePeriodStart ? addWorkingHours(activePeriodStart, SLA_HOURS) : null;

  return {
    id: row['tickets_id'] || row['ticket_key'],
    ticketKey: row['ticket_key'],
    ticketLink: row['ticket_link'],
    summary: row['summary'],
    shortCode: row['ticket_short_code'],
    projectName: row['ticket_project_name'],
    category: row['category'],
    subcategory: row['subcategory'],
    creatorName: row['ticket_creater_name'],
    creatorEmail: row['ticket_creater_email'],
    assigneeName: row['assignee_Name'],
    assigneeEmail: row['assignee_email_id'],
    createdAt,
    activePeriodStart,
    firstAssigneeChanged,
    updatedAt,
    priority: row['priority'],
    currentStatus: status,
    finalStatus,
    isOpen,
    isClosed,
    tatHours,
    workingTAT,
    tatPaused,
    slaBreached,
    slaDeadline,
    firstResponseTAT,
    firstResponseGroup: row['first_response_TAT_group'],
    tatGroup: row['tat_group'],
    lastReopenedDate: parseDate(row['last_reopened_date']),
    lastReopenedBy: row['last_reopened_by'],
    totalReopenedCount: parseInt(row['total_reopened_count']) || 0,
    department: row['ticket_raised_by_deparment'],
    subDepartment: row['ticket_raised_by_sub_department'],
    paidStatus: row['project_paid_status'],
    reportingManager: row['reporting_manager_name'],
    lastActivityTeam: row['Last_Activity_Team_Name'],
    lastAssigneeTeam: row['Last_Assignee_Team_Name'] || null,
    lastUpdatedBy: row['activity_by'] || null,
    lastActivityName: row['activity_name'] || null,
    lastActivitySection: row['activity_section'] || null,
    // info suffix = first response track
    newCreationTimestampInfo: parseDate(row['new_creation_timestamp_info']),
    // cs suffix = last response track
    newCreationTimestampCs: csRestart,
  };
}

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        const tickets = results.data.map(computeTicketMetrics);
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
