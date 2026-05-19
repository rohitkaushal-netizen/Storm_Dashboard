import { parseCSV } from '../utils/csvParser';

const LS_KEY = 'storm_sheet_url';
export const REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function getSavedSheetUrl() {
  return localStorage.getItem(LS_KEY) || '';
}

export function saveSheetUrl(url) {
  if (url) localStorage.setItem(LS_KEY, url);
  else localStorage.removeItem(LS_KEY);
}

// Convert a user-pasted Google Sheets URL to an export CSV URL
export function normalizeSheetUrl(raw) {
  if (!raw) return '';
  const url = raw.trim();

  // Already a direct CSV export or pub URL — use as-is
  if (url.includes('output=csv') || url.includes('export?format=csv')) return url;

  // Published-to-web share link: /spreadsheets/d/e/{pubId}/pubhtml → /pub?output=csv
  const pubMatch = url.match(/spreadsheets\/d\/e\/([^/]+)/);
  if (pubMatch) return `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?output=csv`;

  // Regular edit/view URL: /spreadsheets/d/{sheetId}/... → export CSV
  const idMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    // Try to grab gid (tab) from URL
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? `&gid=${gidMatch[1]}` : '';
    return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gid}`;
  }

  return url; // return as-is and let the server try
}

async function csvTextToTickets(csvText) {
  const blob = new Blob([csvText], { type: 'text/csv' });
  const file = new File([blob], 'sheet.csv', { type: 'text/csv' });
  return parseCSV(file);
}

export async function fetchSheetTickets(rawUrl) {
  const sheetUrl = normalizeSheetUrl(rawUrl);

  // In dev (Vite), the browser fetches directly — it has the corporate cert (Zscaler) installed.
  // In production, the request goes to our Express proxy which runs outside the corporate network.
  if (import.meta.env.DEV) {
    const response = await fetch(sheetUrl, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Google returned ${response.status}. Make sure the sheet is shared as "Anyone with the link can view".`);
    const csvText = await response.text();
    if (csvText.trim().startsWith('<!')) throw new Error('Sheet requires sign-in. Change sharing to "Anyone with the link can view".');
    return csvTextToTickets(csvText);
  }

  // Production: route through server proxy
  const apiUrl = `/api/sheets?url=${encodeURIComponent(sheetUrl)}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `Server error ${response.status}`);
  }
  const csvText = await response.text();
  return csvTextToTickets(csvText);
}
