import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Search, X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

// --- Partner / lawsuit metadata ---
const P_NAME = { DF:'Democracy Forward', AG:'Attorneys General', PC:'Public Citizen', ACLU:'ACLU', PD:'Protect Democracy', SDD:'State Democracy Defenders', O:'Other' };
const P_SHORT = { DF:'DF', AG:'AG', PC:'PC', ACLU:'ACLU', PD:'PD', SDD:'SDD', O:'Other' };
const P_ORDER = ['DF','AG','ACLU','SDD','PC','PD','O'];
const P_COLOR = { DF:'#1a3a5c', AG:'#8a2a2a', PC:'#5c6e3a', ACLU:'#b8702c', PD:'#6b4c7a', SDD:'#3d6b6b', O:'#9c8e6e' };

const M_NAME = {
  TRO:'Temporary Restraining Order', PI:'Preliminary Injunction', PermI:'Permanent Injunction',
  MTD:'Motion to Dismiss', MSJ:'Motion for Summary Judgment',
  StayApp:'Motion for Stay Pending Appeal', AdminStay:'Administrative Stay',
  Scope:'Injunction Scope', Cert:'Certiorari', SCMerits:'Supreme Court Merits',
  CCAppeal:'Circuit Court Appeal', OtherFinal:'Other District Court Final Judgment'
};
const COURT_NAME = { D:'District', C:'Circuit', S:'Supreme', A:'APA' };

// --- DF Action Type metadata ---
const T_NAME = {
  SubstSuit:'Substantive Suit', FOIA:'FOIA Suit', Amicus:'Amicus Brief',
  Interv:'Intervention', RegCom:'Regulatory Comment', MSPB:'MSPB Class Action',
  Petition:'Petition for Rule-making',
  IGL:'IG Letter', IQAL:'IQA Letter', FRAL:'FRA Letter', OGEL:'OGE Letter',
  OthL:'Other Letter', Letter:'Letter', Rpt:'Report', Other:'Other'
};
const T_ORDER = ['SubstSuit','FOIA','Amicus','Interv','RegCom','MSPB','Letter','OthL','IGL','IQAL','FRAL','OGEL','Petition','Rpt','Other'];
const T_COLOR = {
  SubstSuit:'#1a3a5c', FOIA:'#5c6e3a', Amicus:'#b8702c', Interv:'#3d6b6b',
  RegCom:'#6b4c7a', MSPB:'#8a2a2a', Letter:'#9c8e6e', OthL:'#9c8e6e',
  IGL:'#9c8e6e', IQAL:'#9c8e6e', FRAL:'#9c8e6e', OGEL:'#9c8e6e',
  Petition:'#7a7060', Rpt:'#7a7060', Other:'#bdb09a'
};

const PAPER='#f6f1e4', PAPER_DEEP='#ede4cd', INK='#16202b';
const INK_SOFT='#4a5562', INK_FAINT='#8a8270';
const ACCENT='#8a2a2a', RULE='#c8bca0';

// Administrative cases (MSPB/OSC) and FTCA claims. Tracked outside the DF
// Actions Airtable, per Appendix B of the weekly Topline doc. Hardcoded
// because they change infrequently and live in legal team's manual notes.
const ADMIN_CASES = {
  filed: [
    { forum: 'OSC',   name: 'Terminated Probationary Employees',         count: 31 },
    { forum: 'OSC',   name: 'Expand Stay of Unlawful Terminations',      count: 5 },
    { forum: 'MSPB',  name: 'Probationary Immigration Judges (Doyle)',   count: 10 },
    { forum: 'MSPB',  name: 'Appellate Immigration Judges',              count: 2 },
    { forum: 'MSPB',  name: 'Oyer',                                      count: 1 },
    { forum: 'MSPB',  name: 'Former J6 Prosecutors',                     count: 2 },
    { forum: 'Court', name: 'Stainnak v. Trump (DEI firings)',           count: 1 },
  ],
  supporting: [
    { forum: 'MSPB', name: 'Immigration Judges Fired Under Article II', count: 14 },
    { forum: 'MSPB', name: 'DEI Terminations',                          count: 4 },
  ],
  ftca: [
    { name: "Gray's Landing tear gas exposure (Portland, OR)", date: '2026-04-21' },
    { name: 'Dayanne Figueroa damage claim (Chicago, IL)',     date: '2026-05-05' },
  ],
};
const ADMIN_FILED_TOTAL      = ADMIN_CASES.filed.reduce((s, c) => s + c.count, 0);
const ADMIN_SUPPORTING_TOTAL = ADMIN_CASES.supporting.reduce((s, c) => s + c.count, 0);
const ADMIN_FTCA_TOTAL       = ADMIN_CASES.ftca.length;
const ADMIN_GRAND_TOTAL      = ADMIN_FILED_TOTAL + ADMIN_SUPPORTING_TOTAL + ADMIN_FTCA_TOTAL;

const parseOutcome = (raw) => {
  const [m, outcome, court] = raw.split('|');
  return { motion: M_NAME[m] || m, outcome, court: COURT_NAME[court] || court, raw };
};
const monthKey = (d) => d.slice(0,7);
const fmtMonth = (k) => {
  const [y,m] = k.split('-');
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(m,10)-1] + " '" + y.slice(2);
};

export default function LitigationDashboard({ cases, actions }) {
  const [view, setView] = useState('lawsuits');

  return (
    <div style={{ background: PAPER, color: INK, minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..900&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .display { font-family: 'Fraunces', serif; letter-spacing: -0.02em; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .smallcaps { font-variant-caps: all-small-caps; letter-spacing: 0.08em; }
        button { cursor: pointer; font-family: inherit; background: none; border: none; padding: 0; }
        input:focus { outline: none; }
        .recharts-default-tooltip { background: ${PAPER} !important; border: 1px solid ${INK_SOFT} !important; font-family: 'IBM Plex Sans', sans-serif !important; border-radius: 0 !important; }
        .recharts-cartesian-axis-tick text { fill: ${INK_FAINT} !important; font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
        .recharts-cartesian-grid line { stroke: ${RULE} !important; stroke-dasharray: 1 3 !important; }
        .case-row:hover { background-color: ${PAPER_DEEP}; }
      `}</style>

      <header style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', borderBottom: `2px solid ${ACCENT}`, paddingBottom: 4 }}>
          <div className="smallcaps mono" style={{ fontSize: 12, color: ACCENT }}>The Litigation Record</div>
          <div className="smallcaps mono" style={{ fontSize: 12, color: INK_FAINT }}>Live from Airtable</div>
        </div>
        <h1 className="display" style={{ fontSize: '4rem', lineHeight: 0.95, fontWeight: 500, marginTop: 24, marginBottom: 24 }}>
          Legal Responses<br/>
          <em style={{ fontWeight: 350, color: INK_SOFT }}>to the Trump-Vance administration</em>
        </h1>
        <p style={{ maxWidth: 640, fontSize: 16, lineHeight: 1.6, color: INK_SOFT, marginBottom: 32 }}>
          An interactive accounting of {cases.length.toLocaleString()} coalition lawsuits and {(actions.length + ADMIN_GRAND_TOTAL).toLocaleString()} Democracy Forward
          actions of all kinds, drawn from the Response Center and DF Actions Airtables.
        </p>
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${RULE}` }}>
          <ViewTab label="Coalition Lawsuits" count={cases.length} active={view === 'lawsuits'} onClick={() => setView('lawsuits')} />
          <ViewTab label="DF Activity (all types)" count={actions.length + ADMIN_GRAND_TOTAL} active={view === 'df_activity'} onClick={() => setView('df_activity')} />
        </div>
      </header>

      {view === 'lawsuits' ? <LawsuitsView cases={cases} /> : <DFActivityView actions={actions} />}

      <footer style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px', borderTop: `2px solid ${ACCENT}` }} className="mono">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, fontSize: 11, color: INK_FAINT }}>
          <div>
            <div className="smallcaps" style={{ color: ACCENT, marginBottom: 4 }}>Sources & Method</div>
            <p style={{ lineHeight: 1.6, color: INK_SOFT }}>
              Response Center Airtable (coalition lawsuits) and DF Actions Airtable (DF's amicus, intervention, FOIA, regulatory comments, and letters),
              fetched live via the Airtable API. Partner attribution via Counsel field substring match. The DF Activity view filters to actions dated on or after 20 January 2025.
            </p>
          </div>
          <div>
            <div className="smallcaps" style={{ color: ACCENT, marginBottom: 4 }}>Caveats</div>
            <p style={{ lineHeight: 1.6, color: INK_SOFT }}>
              Outcome counts will lag manual figures while the Relief Outcome field is backfilled. EO/policy response counts require the Policies tab.
              Administrative cases (MSPB/OSC) and FTCA claims are listed below per Appendix B of the weekly Topline; per-case dates and statuses are tracked manually.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ===================================================================
// LAWSUITS VIEW
// ===================================================================
function LawsuitsView({ cases }) {
  const [partnerFilter, setPartnerFilter] = useState(null);
  const [issueFilter, setIssueFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [tablePage, setTablePage] = useState(0);
  const [expandedCase, setExpandedCase] = useState(null);
  const [issueLimit, setIssueLimit] = useState(10);
  const PAGE_SIZE = 25;

  const filtered = useMemo(() => cases.filter(c => {
    if (partnerFilter && !c.p.includes(partnerFilter)) return false;
    if (issueFilter && !c.i.includes(issueFilter)) return false;
    if (search) { const q = search.toLowerCase(); if (!c.n.toLowerCase().includes(q)) return false; }
    return true;
  }), [cases, partnerFilter, issueFilter, search]);

  const kpis = useMemo(() => {
    let totalTRO=0, totalPI=0, dfTRO=0, dfPI=0;
    const partnerCounts = Object.fromEntries(P_ORDER.map(p => [p, 0]));
    cases.forEach(c => {
      c.p.forEach(p => { partnerCounts[p] = (partnerCounts[p]||0)+1; });
      (c.o || []).forEach(o => {
        const [m, oc] = o.split('|');
        const isDF = c.p.includes('DF');
        if (m === 'TRO' && oc === 'Granted') { totalTRO++; if (isDF) dfTRO++; }
        if (m === 'PI'  && oc === 'Granted') { totalPI++;  if (isDF) dfPI++; }
      });
    });
    return { total: cases.length, totalTRO, totalPI, dfTRO, dfPI, partnerCounts };
  }, [cases]);

  const timeData = useMemo(() => {
    const m = {};
    filtered.forEach(c => {
      const k = monthKey(c.d);
      if (!m[k]) { m[k] = { month: k }; P_ORDER.forEach(p => m[k][p] = 0); }
      const primary = c.p.find(p => p !== 'O') || 'O';
      m[k][primary]++;
    });
    return Object.values(m).sort((a,b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const issueData = useMemo(() => {
    const counts = {};
    filtered.forEach(c => c.i.forEach(i => counts[i] = (counts[i]||0)+1));
    return Object.entries(counts).map(([name,count]) => ({name,count})).sort((a,b) => b.count - a.count);
  }, [filtered]);

  const partnerData = useMemo(() => {
    const counts = Object.fromEntries(P_ORDER.map(p => [p, 0]));
    filtered.forEach(c => c.p.forEach(p => counts[p] = (counts[p]||0)+1));
    return P_ORDER.map(p => ({ partner: p, count: counts[p] })).filter(d => d.count > 0);
  }, [filtered]);

  const outcomeData = useMemo(() => {
    const motions = {};
    filtered.forEach(c => (c.o || []).forEach(o => {
      const [m, oc] = o.split('|');
      const name = M_NAME[m] || m;
      if (!motions[name]) motions[name] = { motion: name, Granted: 0, Denied: 0, Other: 0 };
      if (oc === 'Granted') motions[name].Granted++;
      else if (oc === 'Denied') motions[name].Denied++;
      else motions[name].Other++;
    }));
    return Object.values(motions).sort((a,b) => (b.Granted+b.Denied+b.Other) - (a.Granted+a.Denied+a.Other)).slice(0,8);
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageCases = filtered.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);
  const clearFilters = () => { setPartnerFilter(null); setIssueFilter(null); setSearch(''); setTablePage(0); };
  const hasFilters = partnerFilter || issueFilter || search;

  return (
    <>
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 1, background: RULE }}>
          <StatCard eyebrow="Total" value={kpis.total} unit="lawsuits filed" />
          <StatCard eyebrow="TROs granted" value={kpis.totalTRO} unit={`incl. ${kpis.dfTRO} by Democracy Forward †`} />
          <StatCard eyebrow="PIs granted" value={kpis.totalPI} unit={`incl. ${kpis.dfPI} by Democracy Forward †`} />
          <StatCard eyebrow="Democracy Forward" value={kpis.partnerCounts.DF} unit="lawsuits brought" />
        </div>
        <p className="mono" style={{ fontSize: 11, color: INK_FAINT, marginTop: 16 }}>
          † Outcome figures reflect cases with the Relief Outcome field populated in Airtable.
        </p>
      </section>

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '16px 0', borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
          <span className="smallcaps mono" style={{ fontSize: 12, color: INK_FAINT }}>Filter</span>
          <Chip label="All cases" active={!partnerFilter && !issueFilter} onClick={clearFilters} />
          {P_ORDER.filter(p => kpis.partnerCounts[p] > 0).map(p => (
            <Chip key={p} label={P_NAME[p]} count={kpis.partnerCounts[p]}
              active={partnerFilter === p} color={P_COLOR[p]}
              onClick={() => { setPartnerFilter(partnerFilter === p ? null : p); setTablePage(0); }} />
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: PAPER_DEEP, border: `1px solid ${RULE}` }}>
            <Search size={14} style={{ color: INK_FAINT }} />
            <input type="text" placeholder="Search cases..." value={search}
              onChange={e => { setSearch(e.target.value); setTablePage(0); }}
              style={{ background: 'transparent', border: 'none', fontSize: 14, color: INK, width: 220, fontFamily: 'inherit' }} />
            {search && <button onClick={() => setSearch('')}><X size={14} style={{ color: INK_FAINT }} /></button>}
          </div>
        </div>
        {hasFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 14, color: INK_SOFT }}>
            <em>Showing {filtered.length} of {kpis.total} cases</em>
            {issueFilter && (
              <span style={{ background: INK, color: PAPER, padding: '2px 8px', fontSize: 12 }}>
                {issueFilter}
                <button onClick={() => { setIssueFilter(null); setTablePage(0); }} style={{ marginLeft: 4, color: PAPER }}>×</button>
              </span>
            )}
            <button onClick={clearFilters} className="mono" style={{ fontSize: 11, textDecoration: 'underline', color: ACCENT }}>clear all</button>
          </div>
        )}
      </section>

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 40 }}>
        <Panel title="Filings over time" subtitle="Monthly count of lawsuits filed, by lead partner organization" span={12}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={timeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickFormatter={fmtMonth} interval="preserveStartEnd" />
              <YAxis />
              <Tooltip labelFormatter={fmtMonth} cursor={{ fill: PAPER_DEEP }} formatter={(v, name) => [v, P_NAME[name] || name]} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" formatter={(v) => P_NAME[v] || v} />
              {P_ORDER.filter(p => partnerData.find(d => d.partner === p)).map(p => (
                <Bar key={p} dataKey={p} stackId="a" fill={P_COLOR[p]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="By partner organization" subtitle="Click to filter." span={5}>
          <div style={{ marginTop: 8 }}>
            {partnerData.map(d => {
              const max = Math.max(...partnerData.map(p => p.count));
              const pct = (d.count / max) * 100;
              const isActive = partnerFilter === d.partner;
              return (
                <button key={d.partner}
                  onClick={() => { setPartnerFilter(isActive ? null : d.partner); setTablePage(0); }}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8, color: isActive ? ACCENT : INK }}>
                  <div style={{ width: 180, fontSize: 14, flexShrink: 0 }}>{P_NAME[d.partner]}</div>
                  <div style={{ flex: 1, position: 'relative', height: 24, background: PAPER_DEEP }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: pct + '%', background: P_COLOR[d.partner], opacity: isActive ? 1 : 0.75 }} />
                  </div>
                  <div className="mono" style={{ fontSize: 14, width: 40, textAlign: 'right' }}>{d.count}</div>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="By issue area" subtitle="Click to filter." span={7}>
          <div style={{ marginTop: 8 }}>
            {issueData.slice(0, issueLimit).map(d => {
              const max = issueData[0]?.count || 1;
              const pct = (d.count / max) * 100;
              const isActive = issueFilter === d.name;
              return (
                <button key={d.name}
                  onClick={() => { setIssueFilter(isActive ? null : d.name); setTablePage(0); }}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6, color: isActive ? ACCENT : INK }}>
                  <div style={{ width: 200, fontSize: 14, flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{d.name}</div>
                  <div style={{ flex: 1, position: 'relative', height: 20, background: PAPER_DEEP }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: pct + '%', background: isActive ? ACCENT : INK_SOFT }} />
                  </div>
                  <div className="mono" style={{ fontSize: 14, width: 40, textAlign: 'right' }}>{d.count}</div>
                </button>
              );
            })}
            {issueData.length > issueLimit && (
              <button onClick={() => setIssueLimit(issueLimit + 10)} className="mono" style={{ fontSize: 11, textDecoration: 'underline', color: ACCENT, marginTop: 12 }}>
                show {Math.min(10, issueData.length - issueLimit)} more →
              </button>
            )}
          </div>
        </Panel>

        <Panel title="Motion outcomes" subtitle={`Granted vs. denied, by motion type. ${filtered.reduce((acc,c) => acc + (c.o||[]).length, 0)} ruling events in current filter.`} span={12}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={outcomeData} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="motion" type="category" width={220} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: PAPER_DEEP }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
              <Bar dataKey="Granted" stackId="a" fill="#3d6b3d" />
              <Bar dataKey="Denied"  stackId="a" fill={ACCENT} />
              <Bar dataKey="Other"   stackId="a" fill={INK_FAINT} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </section>

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 64px' }}>
        <div style={{ borderTop: `2px solid ${ACCENT}`, borderBottom: `1px solid ${RULE}`, paddingTop: 32, paddingBottom: 12, marginBottom: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 className="display" style={{ fontSize: 28, fontWeight: 500 }}>Case ledger</h2>
          <span className="mono" style={{ fontSize: 11, color: INK_FAINT }}>
            {filtered.length.toLocaleString()} cases · click row for detail
          </span>
        </div>
        <div>
          {pageCases.map((c, i) => {
            const idx = tablePage * PAGE_SIZE + i;
            const isExpanded = expandedCase === idx;
            const date = new Date(c.d);
            const dateStr = date.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
            return (
              <div key={idx} style={{ borderBottom: `1px solid ${RULE}` }}>
                <button onClick={() => setExpandedCase(isExpanded ? null : idx)} className="case-row"
                  style={{ width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: '120px 1fr 200px 24px', gap: 12, padding: '12px 8px', alignItems: 'baseline' }}>
                  <div className="mono" style={{ fontSize: 11, color: INK_FAINT }}>{dateStr}</div>
                  <div className="display" style={{ fontSize: 15, fontStyle: 'italic', fontWeight: 400 }}>{c.n}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.p.filter(p => p !== 'O').map(p => (
                      <span key={p} className="mono" style={{ background: P_COLOR[p], color: PAPER, padding: '2px 6px', fontSize: 10 }}>
                        {P_SHORT[p]}
                      </span>
                    ))}
                  </div>
                  <div>{isExpanded ? <ChevronUp size={14} style={{ color: INK_FAINT }} /> : <ChevronDown size={14} style={{ color: INK_FAINT }} />}</div>
                </button>
                {isExpanded && (
                  <div style={{ padding: '8px 8px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, background: PAPER_DEEP, fontSize: 14 }}>
                    <div>
                      {c.i && c.i.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div className="smallcaps mono" style={{ fontSize: 11, color: INK_FAINT, marginBottom: 4 }}>Issue areas</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap: 4 }}>
                            {c.i.map(area => (
                              <span key={area} style={{ fontSize: 12, padding: '2px 8px', background: PAPER, border: `1px solid ${RULE}`, color: INK_SOFT }}>{area}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      {c.o && c.o.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div className="smallcaps mono" style={{ fontSize: 11, color: INK_FAINT, marginBottom: 4 }}>Rulings</div>
                          <div>
                            {c.o.map((o,i) => {
                              const p = parseOutcome(o);
                              const isGranted = p.outcome === 'Granted';
                              const isDenied = p.outcome === 'Denied';
                              return (
                                <div key={i} style={{ fontSize: 12, lineHeight: 1.4, color: INK_SOFT, marginBottom: 2 }}>
                                  <span className="mono" style={{ color: isGranted ? '#3d6b3d' : isDenied ? ACCENT : INK_FAINT }}>●</span>{' '}
                                  {p.motion} — <span style={{ color: isGranted ? '#3d6b3d' : isDenied ? ACCENT : INK }}>{p.outcome}</span>
                                  {p.court && <span style={{ color: INK_FAINT }}> ({p.court})</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {c.u && (
                        <a href={c.u} target="_blank" rel="noopener noreferrer" className="mono"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, textDecoration: 'underline', color: ACCENT }}>
                          Read more <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {pageCases.length === 0 && (
            <div style={{ padding: '64px 0', textAlign: 'center', color: INK_FAINT }}>
              <p className="display" style={{ fontStyle: 'italic', fontSize: 20 }}>No cases match the current filter.</p>
              <button onClick={clearFilters} className="mono" style={{ fontSize: 11, textDecoration: 'underline', color: ACCENT, marginTop: 12 }}>clear filters</button>
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, fontSize: 11, color: INK_SOFT }} className="mono">
            <button onClick={() => setTablePage(Math.max(0, tablePage - 1))} disabled={tablePage === 0}
              style={{ textDecoration: 'underline', color: ACCENT, opacity: tablePage === 0 ? 0.3 : 1 }}>← previous</button>
            <span>Page {tablePage + 1} of {totalPages}</span>
            <button onClick={() => setTablePage(Math.min(totalPages - 1, tablePage + 1))} disabled={tablePage >= totalPages - 1}
              style={{ textDecoration: 'underline', color: ACCENT, opacity: tablePage >= totalPages - 1 ? 0.3 : 1 }}>next →</button>
          </div>
        )}
      </section>
    </>
  );
}

// ===================================================================
// DF ACTIVITY VIEW
// ===================================================================
function DFActivityView({ actions }) {
  const [typeFilter, setTypeFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [tablePage, setTablePage] = useState(0);
  const PAGE_SIZE = 25;

  const filtered = useMemo(() => actions.filter(a => {
    if (typeFilter && !a.t.includes(typeFilter)) return false;
    if (search) { const q = search.toLowerCase(); if (!a.a.toLowerCase().includes(q)) return false; }
    return true;
  }), [actions, typeFilter, search]);

  const typeCounts = useMemo(() => {
    const c = {};
    actions.forEach(a => a.t.forEach(t => c[t] = (c[t]||0)+1));
    return c;
  }, [actions]);

  const typeData = useMemo(() => {
    const c = {};
    filtered.forEach(a => a.t.forEach(t => c[t] = (c[t]||0)+1));
    return T_ORDER.map(t => ({ type: t, count: c[t] || 0 })).filter(d => d.count > 0);
  }, [filtered]);

  const timeData = useMemo(() => {
    const m = {};
    filtered.forEach(a => {
      const k = monthKey(a.d);
      if (!m[k]) { m[k] = { month: k }; T_ORDER.forEach(t => m[k][t] = 0); }
      const primary = a.t[0] || 'Other';
      m[k][primary]++;
    });
    return Object.values(m).sort((a,b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageActions = filtered.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);
  const clearFilters = () => { setTypeFilter(null); setSearch(''); setTablePage(0); };
  const hasFilters = typeFilter || search;

  const total = actions.length;
  const substCount = typeCounts['SubstSuit'] || 0;
  const amicusCount = typeCounts['Amicus'] || 0;
  const foiaCount = typeCounts['FOIA'] || 0;
  const intervCount = typeCounts['Interv'] || 0;

  return (
    <>
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 1, background: RULE }}>
          <StatCard eyebrow="Total DF actions" value={total + ADMIN_GRAND_TOTAL} unit={`${total} in DF Actions · ${ADMIN_GRAND_TOTAL} admin & FTCA`} />
          <StatCard eyebrow="Substantive lawsuits" value={substCount} unit="federal & state litigation" />
          <StatCard eyebrow="Amicus briefs" value={amicusCount} unit="filed in coalition cases" />
          <StatCard eyebrow="Admin (MSPB/OSC)" value={ADMIN_FILED_TOTAL + ADMIN_SUPPORTING_TOTAL} unit={`${ADMIN_FILED_TOTAL} DF-filed · ${ADMIN_SUPPORTING_TOTAL} supporting`} />
        </div>
      </section>

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '16px 0', borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
          <span className="smallcaps mono" style={{ fontSize: 12, color: INK_FAINT }}>Filter</span>
          <Chip label="All actions" active={!typeFilter} onClick={clearFilters} />
          {T_ORDER.filter(t => typeCounts[t] > 0).map(t => (
            <Chip key={t} label={T_NAME[t]} count={typeCounts[t]}
              active={typeFilter === t} color={T_COLOR[t]}
              onClick={() => { setTypeFilter(typeFilter === t ? null : t); setTablePage(0); }} />
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: PAPER_DEEP, border: `1px solid ${RULE}` }}>
            <Search size={14} style={{ color: INK_FAINT }} />
            <input type="text" placeholder="Search actions..." value={search}
              onChange={e => { setSearch(e.target.value); setTablePage(0); }}
              style={{ background: 'transparent', border: 'none', fontSize: 14, color: INK, width: 220, fontFamily: 'inherit' }} />
            {search && <button onClick={() => setSearch('')}><X size={14} style={{ color: INK_FAINT }} /></button>}
          </div>
        </div>
        {hasFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 14, color: INK_SOFT }}>
            <em>Showing {filtered.length} of {total} actions</em>
            <button onClick={clearFilters} className="mono" style={{ fontSize: 11, textDecoration: 'underline', color: ACCENT }}>clear all</button>
          </div>
        )}
      </section>

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 40 }}>
        <Panel title="DF activity over time" subtitle="Monthly count of actions, stacked by primary action type" span={12}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickFormatter={fmtMonth} interval="preserveStartEnd" />
              <YAxis />
              <Tooltip labelFormatter={fmtMonth} cursor={{ fill: PAPER_DEEP }} formatter={(v, name) => [v, T_NAME[name] || name]} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" formatter={(v) => T_NAME[v] || v} />
              {T_ORDER.filter(t => typeData.find(d => d.type === t)).map(t => (
                <Bar key={t} dataKey={t} stackId="a" fill={T_COLOR[t]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="By action type" subtitle="Click to filter." span={12}>
          <div style={{ marginTop: 8 }}>
            {typeData.map(d => {
              const max = Math.max(...typeData.map(p => p.count));
              const pct = (d.count / max) * 100;
              const isActive = typeFilter === d.type;
              return (
                <button key={d.type}
                  onClick={() => { setTypeFilter(isActive ? null : d.type); setTablePage(0); }}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8, color: isActive ? ACCENT : INK }}>
                  <div style={{ width: 220, fontSize: 14, flexShrink: 0 }}>{T_NAME[d.type]}</div>
                  <div style={{ flex: 1, position: 'relative', height: 24, background: PAPER_DEEP }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: pct + '%', background: T_COLOR[d.type], opacity: isActive ? 1 : 0.75 }} />
                  </div>
                  <div className="mono" style={{ fontSize: 14, width: 40, textAlign: 'right' }}>{d.count}</div>
                </button>
              );
            })}
          </div>
        </Panel>
      </section>

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 40px' }}>
        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 32 }}>
          <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 8, marginBottom: 24 }}>
            <h3 className="display" style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Administrative cases & FTCA claims</h3>
            <p style={{ fontSize: 13, color: INK_SOFT, fontStyle: 'italic' }}>
              Tracked outside the DF Actions table, per Appendix B of the weekly Topline doc. Counts represent individual filings within each category.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 32 }}>
            <div>
              <div className="smallcaps mono" style={{ fontSize: 11, color: ACCENT, marginBottom: 12 }}>
                DF-filed · {ADMIN_FILED_TOTAL} individuals across {ADMIN_CASES.filed.length} categories
              </div>
              {ADMIN_CASES.filed.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: `1px solid ${RULE}`, fontSize: 13 }}>
                  <span style={{ color: INK_SOFT }}>
                    <span className="mono" style={{ fontSize: 10, marginRight: 10, color: INK_FAINT, display: 'inline-block', minWidth: 36 }}>{c.forum}</span>
                    {c.name}
                  </span>
                  <span className="mono" style={{ fontWeight: 500, marginLeft: 12 }}>{c.count}</span>
                </div>
              ))}
            </div>

            <div>
              <div className="smallcaps mono" style={{ fontSize: 11, color: ACCENT, marginBottom: 12 }}>
                DF-supporting · {ADMIN_SUPPORTING_TOTAL} individuals
              </div>
              {ADMIN_CASES.supporting.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: `1px solid ${RULE}`, fontSize: 13 }}>
                  <span style={{ color: INK_SOFT }}>
                    <span className="mono" style={{ fontSize: 10, marginRight: 10, color: INK_FAINT, display: 'inline-block', minWidth: 36 }}>{c.forum}</span>
                    {c.name}
                  </span>
                  <span className="mono" style={{ fontWeight: 500, marginLeft: 12 }}>{c.count}</span>
                </div>
              ))}
            </div>

            <div>
              <div className="smallcaps mono" style={{ fontSize: 11, color: ACCENT, marginBottom: 12 }}>
                FTCA Claims · {ADMIN_FTCA_TOTAL}
              </div>
              {ADMIN_CASES.ftca.map((c, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${RULE}`, fontSize: 13, color: INK_SOFT }}>
                  <div style={{ fontStyle: 'italic' }}>{c.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: INK_FAINT, marginTop: 2 }}>
                    {new Date(c.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 64px' }}>
        <div style={{ borderTop: `2px solid ${ACCENT}`, borderBottom: `1px solid ${RULE}`, paddingTop: 32, paddingBottom: 12, marginBottom: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 className="display" style={{ fontSize: 28, fontWeight: 500 }}>Action ledger</h2>
          <span className="mono" style={{ fontSize: 11, color: INK_FAINT }}>{filtered.length.toLocaleString()} actions</span>
        </div>
        <div>
          {pageActions.map((a, i) => {
            const date = new Date(a.d);
            const dateStr = date.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
            return (
              <div key={i} style={{ borderBottom: `1px solid ${RULE}`, display: 'grid', gridTemplateColumns: '120px 1fr 220px 80px', gap: 12, padding: '12px 8px', alignItems: 'baseline' }}>
                <div className="mono" style={{ fontSize: 11, color: INK_FAINT }}>{dateStr}</div>
                <div className="display" style={{ fontSize: 15, fontStyle: 'italic', fontWeight: 400 }}>
                  {a.u ? <a href={a.u} target="_blank" rel="noopener noreferrer" style={{ color: INK, textDecoration: 'none' }}>{a.a}</a> : a.a}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {a.t.map(t => (
                    <span key={t} className="mono" style={{ background: T_COLOR[t] || INK_FAINT, color: PAPER, padding: '2px 6px', fontSize: 10 }}>{T_NAME[t]}</span>
                  ))}
                </div>
                <div className="mono" style={{ fontSize: 11, color: INK_FAINT, textAlign: 'right' }}>{a.s || ''}</div>
              </div>
            );
          })}
          {pageActions.length === 0 && (
            <div style={{ padding: '64px 0', textAlign: 'center', color: INK_FAINT }}>
              <p className="display" style={{ fontStyle: 'italic', fontSize: 20 }}>No actions match the current filter.</p>
              <button onClick={clearFilters} className="mono" style={{ fontSize: 11, textDecoration: 'underline', color: ACCENT, marginTop: 12 }}>clear filters</button>
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, fontSize: 11, color: INK_SOFT }} className="mono">
            <button onClick={() => setTablePage(Math.max(0, tablePage - 1))} disabled={tablePage === 0}
              style={{ textDecoration: 'underline', color: ACCENT, opacity: tablePage === 0 ? 0.3 : 1 }}>← previous</button>
            <span>Page {tablePage + 1} of {totalPages}</span>
            <button onClick={() => setTablePage(Math.min(totalPages - 1, tablePage + 1))} disabled={tablePage >= totalPages - 1}
              style={{ textDecoration: 'underline', color: ACCENT, opacity: tablePage >= totalPages - 1 ? 0.3 : 1 }}>next →</button>
          </div>
        )}
      </section>
    </>
  );
}

// ===================================================================
// SHARED COMPONENTS
// ===================================================================
function ViewTab({ label, count, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '14px 24px', fontSize: 14,
        borderBottom: active ? `3px solid ${ACCENT}` : `3px solid transparent`,
        marginBottom: -1, color: active ? INK : INK_FAINT,
        display: 'flex', alignItems: 'baseline', gap: 8,
      }}>
      <span className="display" style={{ fontWeight: active ? 500 : 400 }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>{count.toLocaleString()}</span>
    </button>
  );
}

function StatCard({ eyebrow, value, unit }) {
  return (
    <div style={{ background: PAPER_DEEP, padding: '28px 24px' }}>
      <div className="smallcaps mono" style={{ fontSize: 11, marginBottom: 12, color: ACCENT }}>{eyebrow}</div>
      <div className="display" style={{ fontSize: 48, lineHeight: 1, fontWeight: 400 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="mono" style={{ fontSize: 11, marginTop: 12, color: INK_SOFT }}>{unit}</div>
    </div>
  );
}

function Chip({ label, count, active, color, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
        background: active ? INK : PAPER_DEEP,
        color: active ? PAPER : INK_SOFT,
        border: active ? `1px solid ${INK}` : `1px solid ${RULE}`,
        borderLeftWidth: !active && color ? 3 : 1,
        borderLeftColor: !active && color ? color : (active ? INK : RULE),
      }}>
      <span>{label}</span>
      {count !== undefined && <span className="mono" style={{ opacity: 0.6 }}>{count}</span>}
    </button>
  );
}

function Panel({ title, subtitle, span, children }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 8, marginBottom: 16 }}>
        <h3 className="display" style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 13, color: INK_SOFT, fontStyle: 'italic' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
