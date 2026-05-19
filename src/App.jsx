import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import CSVUploader from './components/CSVUploader';
import SheetConfig from './components/SheetConfig';
import DateFilter from './components/DateFilter';
import ManagerView from './views/ManagerView';
import CreatorView from './views/CreatorView';
import LeadershipView from './views/LeadershipView';
import TeamTATView from './views/TeamTATView';
import { BarChart2, Users, TrendingUp, RefreshCw, Clock, FileSpreadsheet, Upload } from 'lucide-react';
import { getSavedSheetUrl, fetchSheetTickets, REFRESH_INTERVAL_MS } from './services/sheetsService';
import './App.css';

const TABS = [
  { id: 'manager',    label: 'Manager View',         icon: BarChart2  },
  { id: 'creator',    label: 'Creator / Salesperson', icon: Users      },
  { id: 'leadership', label: 'Leadership Summary',    icon: TrendingUp },
  { id: 'teamtat',    label: 'Team TAT',              icon: Clock      },
];

export default function App() {
  const [tickets, setTickets]         = useState([]);
  const [activeTab, setActiveTab]     = useState('manager');
  const [dateFrom, setDateFrom]       = useState(null);
  const [dateTo, setDateTo]           = useState(null);
  const [dataSource, setDataSource]   = useState(() => getSavedSheetUrl() ? 'sheet' : 'csv');

  // Sheet state
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError]     = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [nextFetchAt, setNextFetchAt]     = useState(null);
  const [sheetLabel, setSheetLabel]       = useState(null);
  const refreshTimer = useRef(null);

  // CSV state
  const [csvLabel, setCsvLabel]   = useState(null);
  const [csvUploadedAt, setCsvUploadedAt] = useState(null);

  // ── Sheet auto-refresh ────────────────────────────────────────
  const loadSheet = useCallback(async (url) => {
    if (!url) return;
    setSheetLoading(true);
    setSheetError(null);
    try {
      const data = await fetchSheetTickets(url);
      setTickets(data);
      const now = Date.now();
      setLastFetchedAt(now);
      setNextFetchAt(now + REFRESH_INTERVAL_MS);
      setSheetLabel(`${data.length} tickets`);
    } catch (e) {
      setSheetError(e.message);
    } finally {
      setSheetLoading(false);
    }
  }, []);

  // Schedule auto-refresh
  useEffect(() => {
    if (dataSource !== 'sheet') return;
    const url = getSavedSheetUrl();
    if (!url) return;

    loadSheet(url); // initial load

    refreshTimer.current = setInterval(() => {
      loadSheet(getSavedSheetUrl());
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(refreshTimer.current);
  }, [dataSource, loadSheet]);

  // ── CSV upload ────────────────────────────────────────────────
  const handleCSVLoaded = (data, filename) => {
    setTickets(data);
    setCsvLabel(filename);
    setCsvUploadedAt(new Date().toLocaleString('en-IN'));
  };

  // ── Date filter ───────────────────────────────────────────────
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
                {dataSource === 'sheet'
                  ? `Live · Google Sheets · ${tickets.length} tickets`
                  : `CSV · ${csvLabel} · ${tickets.length} tickets · loaded ${csvUploadedAt}`}
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
          {/* Source switcher */}
          <div className="source-switcher">
            <button
              className={`source-btn ${dataSource === 'sheet' ? 'active' : ''}`}
              onClick={() => setDataSource('sheet')}
              title="Live Google Sheets"
            >
              <FileSpreadsheet size={14} /> Live
            </button>
            <button
              className={`source-btn ${dataSource === 'csv' ? 'active' : ''}`}
              onClick={() => setDataSource('csv')}
              title="Upload CSV"
            >
              <Upload size={14} /> CSV
            </button>
          </div>
        </div>
      </header>

      {/* ── Sheet config / CSV uploader ── */}
      {dataSource === 'sheet' && (
        <SheetConfig
          onDataLoaded={setTickets}
          lastFetchedAt={lastFetchedAt}
          nextFetchAt={nextFetchAt}
          onManualRefresh={loadSheet}
          loading={sheetLoading}
          error={sheetError}
        />
      )}

      {dataSource === 'csv' && !hasData && (
        <div className="upload-section">
          <CSVUploader onDataLoaded={handleCSVLoaded} lastUpload={csvLabel} />
        </div>
      )}

      {dataSource === 'csv' && hasData && (
        <div className="csv-refresh-bar">
          <CSVUploader onDataLoaded={handleCSVLoaded} lastUpload={csvLabel} />
        </div>
      )}

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
          SLA: 12 working hours · 9:30 AM – 6:30 PM IST (Mon–Fri)
          {dataSource === 'sheet' && lastFetchedAt && (
            <> · Auto-refreshes every 4 hours</>
          )}
        </footer>
      )}
    </div>
  );
}
