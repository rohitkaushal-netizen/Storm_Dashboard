// Working hours: 9:30 AM – 6:30 PM IST, Mon–Fri
// 1 working day = 9 hours. SLA = 12 working hours = 1 full day + 3 hours next day.

const WORK_START_H = 9,  WORK_START_M = 30;
const WORK_END_H   = 18, WORK_END_M   = 30;

function isWeekday(date) {
  const d = date.getDay();
  return d !== 0 && d !== 6;
}

// Advance cursor to the next valid working moment:
//   - before 9:30 AM on a weekday  → snap to 9:30 AM same day
//   - after 6:30 PM on a weekday   → snap to 9:30 AM next working day
//   - on a weekend                 → snap to 9:30 AM next Monday
function snapToWorkStart(cursor) {
  // skip weekends
  while (!isWeekday(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(WORK_START_H, WORK_START_M, 0, 0);
  }
  const dayStart = new Date(cursor); dayStart.setHours(WORK_START_H, WORK_START_M, 0, 0);
  const dayEnd   = new Date(cursor); dayEnd.setHours(WORK_END_H,   WORK_END_M,   0, 0);

  if (cursor < dayStart) {
    cursor.setHours(WORK_START_H, WORK_START_M, 0, 0);
  } else if (cursor >= dayEnd) {
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(WORK_START_H, WORK_START_M, 0, 0);
    snapToWorkStart(cursor); // re-check in case we landed on weekend
  }
}

// ── Working time elapsed ──────────────────────────────────────────
// Returns working MINUTES between two Date objects.
export function workingMinutesBetween(start, end) {
  if (!start || !end || end <= start) return 0;
  let total = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    if (isWeekday(cursor)) {
      const ds = new Date(cursor); ds.setHours(WORK_START_H, WORK_START_M, 0, 0);
      const de = new Date(cursor); de.setHours(WORK_END_H,   WORK_END_M,   0, 0);
      const ss = new Date(Math.max(cursor.getTime(), ds.getTime()));
      const se = new Date(Math.min(end.getTime(),    de.getTime()));
      if (se > ss) total += (se - ss) / 60000;
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return total;
}

export function workingHoursBetween(start, end) {
  return workingMinutesBetween(start, end) / 60;
}

// ── SLA deadline ──────────────────────────────────────────────────
// Given a start Date, return the Date that is exactly `hoursToAdd`
// working hours later (skipping nights, weekends).
//
// Example: 9:30 AM May 14 + 12 working hours → 12:30 PM May 15
//          5:00 PM Thu + 12 working hours → 11:00 AM following Mon
export function addWorkingHours(start, hoursToAdd) {
  if (!start) return null;
  let remaining = hoursToAdd * 60; // work in minutes
  const cursor = new Date(start);

  snapToWorkStart(cursor); // normalize to a valid working moment

  while (remaining > 0) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(WORK_END_H, WORK_END_M, 0, 0);

    const availableToday = (dayEnd - cursor) / 60000;

    if (remaining <= availableToday) {
      cursor.setTime(cursor.getTime() + remaining * 60000);
      remaining = 0;
    } else {
      remaining -= availableToday;
      // Jump to next working day start
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START_H, WORK_START_M, 0, 0);
      while (!isWeekday(cursor)) {
        cursor.setDate(cursor.getDate() + 1);
      }
      cursor.setHours(WORK_START_H, WORK_START_M, 0, 0);
    }
  }

  return cursor;
}

// Target is 8 working hours, but a 1-hour grace period applies everywhere
// (deadline, breach flag, counts) — only flagged breached past 9 working hours.
export const SLA_HOURS = 9;

export function isSLABreached(workingHours) {
  return workingHours > SLA_HOURS;
}
