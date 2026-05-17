import React, { useState, useEffect, useCallback } from 'react';
import LitigationDashboard from './LitigationDashboard.jsx';

const PAPER = '#f6f1e4', INK = '#16202b', INK_FAINT = '#8a8270', ACCENT = '#8a2a2a';

// data.json is produced by scripts/fetch-airtable.mjs during each build.
// Relative path so it works at any GitHub Pages route or custom domain.
const DATA_URL = `${import.meta.env.BASE_URL}data/data.json`;

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cache-bust so a reload picks up a freshly-deployed data file
      const r = await fetch(`${DATA_URL}?t=${Date.now()}`);
      if (!r.ok) throw new Error(`Could not load data file (${r.status})`);
      const json = await r.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) return <Splash msg="Loading…" />;
  if (error && !data)   return <Splash msg={`Couldn't load data: ${error}`} onRetry={fetchData} />;

  return (
    <div>
      <DataBar data={data} loading={loading} error={error} onReload={fetchData} />
      <LitigationDashboard cases={data.cases} actions={data.actions} />
    </div>
  );
}

function Splash({ msg, onRetry }) {
  return (
    <div style={{ background: PAPER, color: INK, minHeight: '100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'IBM Plex Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');`}</style>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:"'Fraunces', serif", fontSize:24, fontStyle:'italic', color: INK_FAINT, marginBottom:16 }}>{msg}</div>
        {onRetry && (
          <button onClick={onRetry}
            style={{ fontFamily:'inherit', fontSize:12, padding:'8px 16px', background:'transparent', border:`1px solid ${ACCENT}`, color: ACCENT, cursor:'pointer' }}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function DataBar({ data, loading, error, onReload }) {
  const fetchedAt = data?.fetchedAt ? new Date(data.fetchedAt) : null;
  const ago = fetchedAt ? timeAgo(fetchedAt) : 'never';
  return (
    <div style={{
      position:'sticky', top:0, zIndex:50, background: PAPER, borderBottom:`1px solid #c8bca0`,
      padding:'8px 32px', display:'flex', alignItems:'center', justifyContent:'space-between',
      fontFamily:"'IBM Plex Mono', monospace", fontSize:11, color: INK_FAINT,
    }}>
      <span>
        {error
          ? <span style={{ color: ACCENT }}>reload failed: {error}</span>
          : <>Data fetched from Airtable {ago} · refreshes daily</>}
      </span>
      <button onClick={onReload} disabled={loading}
        style={{
          fontFamily:'inherit', fontSize:11, padding:'4px 10px', cursor: loading ? 'wait' : 'pointer',
          background: loading ? '#ede4cd' : 'transparent', border:`1px solid ${ACCENT}`, color: ACCENT,
        }}>
        {loading ? 'reloading…' : '↻ reload'}
      </button>
    </div>
  );
}

function timeAgo(d) {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
