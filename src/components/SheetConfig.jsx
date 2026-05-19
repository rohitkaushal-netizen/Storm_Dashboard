import { useState } from 'react';
import { Link2, CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { getSavedSheetUrl, saveSheetUrl, fetchSheetTickets, REFRESH_INTERVAL_MS } from '../services/sheetsService';

function fmtCountdown(msLeft) {
  if (msLeft <= 0) return 'now';
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SheetConfig({ onDataLoaded, lastFetchedAt, nextFetchAt, onManualRefresh, loading, error }) {
  const [url, setUrl] = useState(getSavedSheetUrl);
  const [editing, setEditing] = useState(!getSavedSheetUrl());
  const [saveError, setSaveError] = useState('');

  const handleSave = () => {
    if (!url.trim()) { setSaveError('Please enter a sheet URL.'); return; }
    saveSheetUrl(url.trim());
    setSaveError('');
    setEditing(false);
    onManualRefresh(url.trim());
  };

  const now = Date.now();
  const msUntilNext = nextFetchAt ? nextFetchAt - now : null;

  return (
    <div className="sheet-config">
      <div className="sheet-config-header">
        <Link2 size={16} />
        <span className="sheet-config-title">Google Sheets — Live Data</span>
        {lastFetchedAt && !editing && (
          <span className="sheet-meta">
            <Clock size={11} />
            Updated {new Date(lastFetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            {msUntilNext !== null && ` · next in ${fmtCountdown(msUntilNext)}`}
          </span>
        )}
      </div>

      {editing ? (
        <div className="sheet-url-form">
          <input
            className="sheet-url-input"
            type="url"
            placeholder="Paste your Google Sheets link here…"
            value={url}
            onChange={e => { setUrl(e.target.value); setSaveError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <button className="sheet-save-btn" onClick={handleSave} disabled={loading}>
            {loading ? <RefreshCw size={14} className="spin" /> : 'Connect'}
          </button>
          {saveError && <p className="sheet-error">{saveError}</p>}
          <p className="sheet-hint">
            Share your sheet as <strong>"Anyone with the link can view"</strong>, then paste the URL.<br />
            Works with edit URLs, view URLs, and "Publish to web" CSV links.
          </p>
        </div>
      ) : (
        <div className="sheet-status-row">
          {error ? (
            <span className="sheet-status-err"><AlertCircle size={13} /> {error}</span>
          ) : lastFetchedAt ? (
            <span className="sheet-status-ok"><CheckCircle size={13} /> Connected</span>
          ) : (
            <span className="sheet-status-loading"><RefreshCw size={13} className="spin" /> Fetching…</span>
          )}
          <button className="sheet-refresh-btn" onClick={() => onManualRefresh(url)} disabled={loading} title="Refresh now">
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh now
          </button>
          <button className="sheet-edit-btn" onClick={() => setEditing(true)}>Change URL</button>
        </div>
      )}
    </div>
  );
}
