// Fetches both Airtable bases and writes a single JSON file the
// dashboard reads at runtime. Token comes from process.env.AIRTABLE_TOKEN.
// Designed to run inside GitHub Actions; can also run locally if you put
// AIRTABLE_TOKEN in a .env file.

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

// Airtable returns multi-select & lookup fields as arrays.
// CSV exports used comma-separated strings. Normalize both.
function asArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
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

function encodeOutcome(raw) {
  const parts = String(raw).split('–').map(s => s.trim());
  if (parts.length < 2) return null;
  const motion = MOTION_CODES[parts[0]] || parts[0];
  const rest = parts.slice(1).join(' – ');
  const courtMatch = rest.match(/\(([^)]+)\)/);
  const court = courtMatch ? courtMatch[1][0] : '';
  const outcomeMatch = rest.match(/^\s*(\w+(?:\s+\w+)?)/);
  const outcome = outcomeMatch ? outcomeMatch[1].trim() : '';
  return `${motion}|${outcome}|${court}`;
}

function transformCases(records, cutoff) {
  const out = [];
  for (const r of records) {
    const f = r.fields || {};
    if (asString(f['Response Type']) !== 'Lawsuit') continue;
    const dateStr = firstValue(f['Date Filed']);
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d > cutoff) continue;

    const issueAreas = asArray(f['Issue Area(s)']);
    const outcomes = asArray(f['Relief Outcomes [ext]'])
      .map(s => encodeOutcome(s))
      .filter(Boolean);

    const item = {
      n: asString(f['Response Name']),
      d: dateStr.slice(0, 10),
      p: partnersFor(f['Counsel Lookup']),
      i: issueAreas,
    };
    if (outcomes.length) item.o = outcomes;
    const url = firstValue(f['Read More URL [ext]']);
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
    const dateStr = firstValue(f['Date']);
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d < TRUMP_2_START || d > cutoff) continue;

    let name = asString(f['Action']).trim();
    if (name.length > 130) name = name.slice(0, 130).replace(/\s+\S*$/, '') + '...';

    const item = {
      a: name,
      d: dateStr.slice(0, 10),
      t: encodeActionTypes(f['Action Type']),
    };
    const status = asString(f['Status']);
    if (status) item.s = status;
    const url = firstValue(f['Link to Docket']);
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

  console.log(`Fetching DF Actions: ${dfBase}/${dfTable}`);
  const dfRecords = await fetchAllRecords(dfBase, dfTable, token);
  console.log(`  → ${dfRecords.length} records`);

  const cases = transformCases(rcRecords, cutoff);
  const actions = transformActions(dfRecords, cutoff);
  console.log(`Transformed: ${cases.length} lawsuits, ${actions.length} DF actions`);

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
