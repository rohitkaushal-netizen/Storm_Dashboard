import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Google Sheets proxy ──────────────────────────────────────────
// URL is kept server-side only — never exposed to the browser.
const SHEET_URL = process.env.GOOGLE_SHEET_URL ||
  'https://docs.google.com/spreadsheets/d/1pcudyEeHGbO0bI0DBRH5n7y0AjlFX5v9BWWQNwBNhKU/export?format=csv&gid=0';

app.get('/api/sheets', async (_req, res) => {
  const sheetUrl = SHEET_URL;

  try {
    const response = await fetch(sheetUrl, {
      redirect: 'follow',
      headers: { 'Accept': 'text/csv,text/plain,*/*' },
    });

    if (!response.ok) {
      throw new Error(`Google returned HTTP ${response.status}. Make sure the sheet is shared as "Anyone with link can view".`);
    }

    const csv = await response.text();

    // Sanity check — if Google redirected us to a login page, csv will be HTML
    if (csv.trim().startsWith('<!')) {
      throw new Error('Sheet requires sign-in. Change sharing to "Anyone with the link can view".');
    }

    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check for Render
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Serve React build ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback — all unknown routes serve index.html
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`STORM Dashboard server running on port ${PORT}`);
});
