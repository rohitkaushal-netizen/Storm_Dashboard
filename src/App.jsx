import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import DateFilter from './components/DateFilter';
import ManagerView from './views/ManagerView';
import CreatorView from './views/CreatorView';
import LeadershipView from './views/LeadershipView';
import TeamTATView from './views/TeamTATView';
import { BarChart2, Users, TrendingUp, RefreshCw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchSheetTickets, REFRESH_INTERVAL_MS } from './services/sheetsService';
import { SLA_HOURS } from './utils/workingHours';
import './App.css';

const TABS = [
  { id: 'manager',    label: 'Manager View',         icon: BarChart2  },
  { id: 'creator',    label: 'Creator / Salesperson', icon: Users      },
  { id: 'leadership', label: 'Leadership Summary',    icon: TrendingUp },
  { id: 'teamtat',    label: 'Team TAT',              icon: Clock      },
];

function fmtCountdown(msLeft) {
  if (msLeft <= 0) return 'now';
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function App() {
  const [tickets, setTickets]           = useState([]);
  const [activeTab, setActiveTab]       = useState('manager');
  const [dateFrom, setDateFrom]         = useState(null);
  const [dateTo, setDateTo]             = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [nextFetchAt, setNextFetchAt]     = useState(null);
  const refreshTimer = useRef(null);

  const loadSheet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSheetTickets();
      setTickets(data);
      const now = Date.now();
      setLastFetchedAt(now);
      setNextFetchAt(now + REFRESH_INTERVAL_MS);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSheet();
    refreshTimer.current = setInterval(loadSheet, REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimer.current);
  }, [loadSheet]);

  const filteredTickets = useMemo(() => {
    if (!dateFrom && !dateTo) return tickets;
    return tickets.filter(t => {
      if (!t.createdAt) return false;
      const d = t.createdAt.toISOString().slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      return true;
    });
  }, [tickets, dateFrom, dateTo]);

  const hasData    = tickets.length > 0;
  const isFiltered = dateFrom || dateTo;
  const msUntilNext = nextFetchAt ? nextFetchAt - Date.now() : null;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">STORM</div>
          <div className="header-meta">
            <span className="header-title">Support Operations Dashboard</span>
            {hasData && (
              <span className="header-sub">
                Live · {tickets.length} tickets
              </span>
            )}
          </div>
        </div>
        <div className="header-right">
          {hasData && (
            <nav className="tab-nav">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon size={15} /> {tab.label}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* ── Sheet status bar ── */}
      <div className="sheet-config">
        <div className="sheet-status-row">
          {error ? (
            <span className="sheet-status-err"><AlertCircle size={13} /> {error}</span>
          ) : loading ? (
            <span className="sheet-status-loading"><RefreshCw size={13} className="spin" /> Fetching data…</span>
          ) : lastFetchedAt ? (
            <span className="sheet-status-ok">
              <CheckCircle size={13} /> Updated {new Date(lastFetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              {msUntilNext !== null && ` · next in ${fmtCountdown(msUntilNext)}`}
            </span>
          ) : null}
          <button className="sheet-refresh-btn" onClick={loadSheet} disabled={loading} title="Refresh now">
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh now
          </button>
        </div>
      </div>

      {/* ── Date filter strip ── */}
      {hasData && (
        <div className="filter-strip">
          <DateFilter onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
          {isFiltered && (
            <span className="filter-count">
              Showing <strong>{filteredTickets.length}</strong> of {tickets.length} tickets
            </span>
          )}
        </div>
      )}

      {/* ── Main views ── */}
      {hasData && (
        <main className="app-main">
          {activeTab === 'manager'    && <ManagerView    tickets={filteredTickets} />}
          {activeTab === 'creator'    && <CreatorView    tickets={filteredTickets} />}
          {activeTab === 'leadership' && <LeadershipView tickets={filteredTickets} />}
          {activeTab === 'teamtat'    && <TeamTATView    tickets={filteredTickets} />}
        </main>
      )}

      {hasData && (
        <footer className="app-footer">
          SLA: {SLA_HOURS} working hours (8h target + 1h grace) · 9:30 AM – 5:30 PM IST (Mon–Fri) · Auto-refreshes every 4 hours
        </footer>
      )}
    </div>
  );
}
