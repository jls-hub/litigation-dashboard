// Fetches both Airtable bases and writes a single JSON file the
// dashboard reads at runtime. Token comes from process.env.AIRTABLE_TOKEN.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const AIRTABLE_API = 'https://api.airtable.com/v0';

const PARTNERS = [
  ['DF',   /Democracy Forward/i],
  ['AG',   /Attorney General/i],
  ['PC',   /Public Citizen/i],
  ['ACLU', /ACLU|American Civil Liberties Union/i],
  ['PD',   /Protect Democracy/i],
  ['SDD',  /Democracy Defenders/i],
];

const MOTION_CODES = {
  'Temporary Restraining Order': 'TRO',
  'Preliminary Injunction': 'PI',
  'Permanent Injunction': 'PermI',
  'Motion to Dismiss': 'MTD',
  'Motion for Summary Judgment': 'MSJ',
  'Motion for Stay Pending Appeal': 'StayApp',
  'Motion for Admin Stay/Stay Pending Appeal': 'AdminStay',
  'Administrative Stay': 'AdminStay',
  'Injunction Scope': 'Scope',
  'Certiorari': 'Cert',
  'Supreme Court Merits': 'SCMerits',
  'Circuit Court Appeal': 'CCAppeal',
  'Other District Court Final Judgment': 'OtherFinal',
};

const ACTION_TYPE_CODES = [
  ['SubstSuit', 'Substantive Suit'],
  ['FOIA',      'FOIA Suit'],
  ['Amicus',    'Amicus Brief'],
  ['Interv',    'Intervention'],
  ['RegCom',    'Regulatory Comment'],
  ['MSPB',      'MSPB Class Action'],
  ['Petition',  'Petition for Rule-making'],
  ['IGL',       'IG Letter'],
  ['IQAL',      'IQA Letter'],
  ['FRAL',      'FRA Letter'],
  ['OGEL',      'OGE Letter'],
  ['OthL',      'Other Letter'],
  ['Letter',    'Letter'],
  ['Rpt',       'Report'],
];

const TRUMP_2_START = new Date('2025-01-20');

function asArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(x => x == null ? '' : String(x).trim());
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [String(v).trim()].filter(Boolean);
}

function asString(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function firstValue(v) {
  if (Array.isArray(v)) return v[0] != null ? String(v[0]) : '';
  return v == null ? '' : String(v);
}

function getField(fields, ...candidates) {
  for (const name of candidates) {
    if (fields[name] != null) return fields[name];
  }
  return undefined;
}

async function fetchAllRecords(baseId, table, token) {
  const records = [];
  let offset;
  do {
    const url = new URL(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Airtable ${baseId}/${table} → ${resp.status}: ${text.slice(0, 300)}`);
    }
    const data = await resp.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

function partnersFor(counsel) {
  const s = asString(counsel);
  if (!s) return ['O'];
  const m = PARTNERS.filter(([, re]) => re.test(s)).map(([code]) => code);
  return m.length ? m : ['O'];
}

// Build outcome entries by zipping Stage/Motion + Outcome arrays (both come
// from the Response Action Events table as parallel lookups).
function buildOutcomes(motions, outcomes) {
  const out = [];
  const n = Math.min(motions.length, outcomes.length);
  for (let i = 0; i < n; i++) {
    const motion = motions[i];
    const outcome = outcomes[i];
    if (!motion || !outcome) continue;
    const motionCode = MOTION_CODES[motion] || motion;
    // Court info isn't in this source; leave the third position empty.
    out.push(`${motionCode}|${outcome}|`);
  }
  return out;
}

function transformCases(records, cutoff) {
  const out = [];
  for (const r of records) {
    const f = r.fields || {};
    if (asString(getField(f, 'Response Type')) !== 'Lawsuit') continue;
    const dateStr = firstValue(getField(f, 'Date Filed'));
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d > cutoff) continue;

    const issueAreas = asArray(getField(f, 'Issue Area(s)', 'Issue Areas'));
    const motions  = asArray(getField(f, 'Stage / Motion (from Response Action Events)'));
    const outcomes = asArray(getField(f, 'Outcome (from Response Action Events)'));
    const encoded  = buildOutcomes(motions, outcomes);

    const item = {
      n: asString(getField(f, 'Response Name', 'Name')),
      d: dateStr.slice(0, 10),
      p: partnersFor(getField(f, 'Counsel Lookup', 'Counsel')),
      i: issueAreas,
    };
    if (encoded.length) item.o = encoded;
    const url = firstValue(getField(f, 'Read More URL [ext]', 'Read More URL', 'URL'));
    if (url) item.u = url;
    out.push(item);
  }
  out.sort((a, b) => b.d.localeCompare(a.d));
  return out;
}

function encodeActionTypes(typeField) {
  const s = asString(typeField);
  const codes = [];
  for (const [code, needle] of ACTION_TYPE_CODES) {
    if (s.includes(needle)) codes.push(code);
  }
  return codes.length ? codes : ['Other'];
}

function transformActions(records, cutoff) {
  const out = [];
  for (const r of records) {
    const f = r.fields || {};
    const dateStr = firstValue(getField(f, 'Date'));
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d < TRUMP_2_START || d > cutoff) continue;

    let name = asString(getField(f, 'Action', 'Name')).trim();
    if (name.length > 130) name = name.slice(0, 130).replace(/\s+\S*$/, '') + '...';

    const item = {
      a: name,
      d: dateStr.slice(0, 10),
      t: encodeActionTypes(getField(f, 'Action Type')),
    };
    const status = asString(getField(f, 'Status'));
    if (status) item.s = status;
    const url = firstValue(getField(f, 'Link to Docket'));
    if (url) item.u = url;
    out.push(item);
  }
  out.sort((a, b) => b.d.localeCompare(a.d));
  return out;
}

async function main() {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('AIRTABLE_TOKEN not set in environment.');

  const rcBase  = process.env.RESPONSE_CENTER_BASE_ID || 'appWYhb4LZn5yS2M0';
  const rcTable = process.env.RESPONSE_CENTER_TABLE   || 'Responses';
  const dfBase  = process.env.DF_ACTIONS_BASE_ID      || 'appPxRYjblt7XYsoE';
  const dfTable = process.env.DF_ACTIONS_TABLE        || 'Actions';

  const cutoff = new Date();

  console.log(`Fetching Response Center: ${rcBase}/${rcTable}`);
  const rcRecords = await fetchAllRecords(rcBase, rcTable, token);
  console.log(`  → ${rcRecords.length} records`);

  // Diagnostic: are the two outcome arrays the same length on each record?
  let sameLen = 0, diffLen = 0;
  for (const r of rcRecords) {
    const m = r.fields['Stage / Motion (from Response Action Events)'];
    const o = r.fields['Outcome (from Response Action Events)'];
    if (Array.isArray(m) && Array.isArray(o)) {
      if (m.length === o.length) sameLen++;
      else diffLen++;
    }
  }
  console.log(`  Motion+Outcome alignment: ${sameLen} records same-length, ${diffLen} different`);

  console.log(`Fetching DF Actions: ${dfBase}/${dfTable}`);
  const dfRecords = await fetchAllRecords(dfBase, dfTable, token);
  console.log(`  → ${dfRecords.length} records`);

  const cases = transformCases(rcRecords, cutoff);
  const actions = transformActions(dfRecords, cutoff);

  // Sanity-check the headline outcome counts vs. the topline doc
  let troG = 0, piG = 0, dfTroG = 0, dfPiG = 0;
  for (const c of cases) {
    if (!c.o) continue;
    const isDF = c.p.includes('DF');
    for (const o of c.o) {
      const [m, oc] = o.split('|');
      if (m === 'TRO' && oc === 'Granted') { troG++; if (isDF) dfTroG++; }
      if (m === 'PI'  && oc === 'Granted') { piG++;  if (isDF) dfPiG++; }
    }
  }
  console.log(`Transformed: ${cases.length} lawsuits, ${actions.length} DF actions`);
  console.log(`Cases with encoded outcomes: ${cases.filter(c => c.o && c.o.length).length} / ${cases.length}`);
  console.log(`TROs granted: ${troG} (DF: ${dfTroG})`);
  console.log(`PIs granted:  ${piG} (DF: ${dfPiG})`);

  const outDir = path.resolve(process.cwd(), 'public/data');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'data.json');
  const payload = {
    fetchedAt: new Date().toISOString(),
    cutoff: cutoff.toISOString().slice(0, 10),
    counts: { cases: cases.length, actions: actions.length },
    cases,
    actions,
  };
  await writeFile(outPath, JSON.stringify(payload));
  console.log(`Wrote ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
