import Papa from 'papaparse';
import { workingHoursBetween, addWorkingHours, SLA_HOURS } from './workingHours';

// Statuses that count as "open" (pending resolution)
export const OPEN_STATUSES = ['Open', 'Reopened', 'In Progress', 'Info Required', 'Info Provided', null, ''];
export const CLOSED_STATUSES = ['Closed', 'Request Denied', 'Request Accepted'];

export function parseDate(val) {
  if (!val) return null;
  let v = String(val).trim();

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
  // Original creation time — used only for date filtering and display
  const createdAt = parseDate(row['created_at'] || row['creation_date']);
  const updatedAt = parseDate(row['updated_at'] || row['updation_date']);
  const status    = row['current_ticket_status'] || null;
  const finalStatus = row['Final_Ticket_Status'] || null;

  const isOpen   = !CLOSED_STATUSES.includes(status) && !CLOSED_STATUSES.includes(finalStatus);
  const isClosed = CLOSED_STATUSES.includes(finalStatus) || CLOSED_STATUSES.includes(status);

  let tatHours       = parseFloat(row['tat_in_hours'])      || null;
  let firstResponseTAT = parseFloat(row['first_response_TAT']) || null;

  // TAT is paused while waiting for customer info — team not penalised
  const tatPaused = status === 'Info Required';

  // Timestamps for each cycle track
  const firstResponseTime   = parseDate(row['first_response_time']);      // overall first response
  const firstResponseTimeCs = parseDate(row['first_response_time_cs']);   // CS-track restart after Info Provided
  const csCreatedAt         = parseDate(row['new_creation_timestamp_cs']); // fallback restart anchor

  // Active period start — where the current SLA window begins:
  //
  //  Info Provided (open): CS team starts a fresh cycle.
  //    Use first_response_time_cs (first CS response after Info Provided).
  //    Fallback: new_creation_timestamp_cs → first_response_time → created_at
  //
  //  All other states (open or closed): TAT runs from the first team response.
  //    Use first_response_time → new_creation_timestamp_cs → created_at
  let activePeriodStart;
  if (!isClosed && status === 'Info Provided') {
    activePeriodStart = firstResponseTimeCs || csCreatedAt || firstResponseTime || createdAt;
  } else {
    activePeriodStart = firstResponseTime || csCreatedAt || createdAt;
  }

  // Working TAT for the current active period:
  //   Info Required: frozen at updatedAt (moment the clock was paused)
  //   Closed:        from active period start to close time
  //   Open:          from active period start to now
  let workingTAT = null;
  if (activePeriodStart) {
    let endTime;
    if (tatPaused)                   endTime = updatedAt || new Date();
    else if (isClosed && updatedAt)  endTime = updatedAt;
    else                             endTime = new Date();
    workingTAT = workingHoursBetween(activePeriodStart, endTime);
  }

  // Paused tickets never count as breached — clock is stopped
  const slaBreached = tatPaused
    ? false
    : (workingTAT !== null ? workingTAT > SLA_HOURS : (tatHours !== null ? tatHours > SLA_HOURS : false));

  // SLA deadline = active period start + 12 working hours
  // Automatically resets to 12h from first_response_time_cs when Info Provided is set.
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
    createdAt,          // original creation time (for date filter & display)
    activePeriodStart,  // TAT window start (first_response_time or CS restart)
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
    // First response track (overall)
    firstActivityEmail: row['first_activity_email_id'],
    firstResponseTime,
    firstResponseTAT,
    firstResponseGroup: row['first_response_TAT_group'],
    // CS cycle track (resets after Info Provided)
    firstActivityEmailCs: row['first_activity_email_id_cs'],
    firstResponseTimeCs,
    firstResponseTATCs: parseFloat(row['first_response_TAT_cs']) || null,
    lastResponseTimeCs: parseDate(row['last_response_time_cs']),
    // Info cycle track
    firstActivityEmailInfo: row['first_activity_email_id_info'],
    firstResponseTimeInfo: parseDate(row['first_response_time_info']),
    lastResponseTimeInfo: parseDate(row['last_response_time_info']),
    // Other
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
