import { parseCSV } from '../utils/csvParser';

export const REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

async function csvTextToTickets(csvText) {
  const blob = new Blob([csvText], { type: 'text/csv' });
  const file = new File([blob], 'sheet.csv', { type: 'text/csv' });
  return parseCSV(file);
}

export async function fetchSheetTickets() {
  const response = await fetch('/api/sheets');
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `Server error ${response.status}`);
  }
  const csvText = await response.text();
  return csvTextToTickets(csvText);
}
