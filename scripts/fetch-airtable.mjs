// Fetches both Airtable bases and writes a single JSON file the
// dashboard reads at runtime. Token comes from process.env.AIRTABLE_TOKEN.
// Designed to run inside GitHub Actions; can also run locally if you put
// AIRTABLE_TOKEN in a .env file and `dotenv` it in.

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
  if (!counsel) return ['O'];
  const m = PARTNERS.filter(([, re]) => re.test(counsel)).map(([code]) => code);
  return m.length ? m : ['O'];
}

function encodeOutcome(raw) {
  const parts = raw.split('–').map(s => s.trim());
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
    if (f['Response Type'] !== 'Lawsuit') continue;
    const dateStr = f['Date Filed'];
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d > cutoff) continue;

    const issueAreas = (f['Issue Area(s)'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const outcomesRaw = f['Relief Outcomes [ext]'] || '';
    const outcomes = outcomesRaw
      ? outcomesRaw.split(',').map(s => encodeOutcome(s.trim())).filter(Boolean)
      : [];

    const item = {
      n: f['Response Name'] || '',
      d: dateStr.slice(0, 10),
      p: partnersFor(f['Counsel Lookup'] || ''),
      i: issueAreas,
    };
    if (outcomes.length) item.o = outcomes;
    if (f['Read More URL [ext]']) item.u = f['Read More URL [ext]'];
    out.push(item);
  }
  out.sort((a, b) => b.d.localeCompare(a.d));
  return out;
}

function encodeActionTypes(typeStr) {
  const codes = [];
  for (const [code, needle] of ACTION_TYPE_CODES) {
    if (typeStr.includes(needle)) codes.push(code);
  }
  return codes.length ? codes : ['Other'];
}

function transformActions(records, cutoff) {
  const out = [];
  for (const r of records) {
    const f = r.fields || {};
    const dateStr = f['Date'];
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d < TRUMP_2_START || d > cutoff) continue;

    let name = (f['Action'] || '').trim();
    if (name.length > 130) name = name.slice(0, 130).replace(/\s+\S*$/, '') + '...';

    const item = {
      a: name,
      d: dateStr.slice(0, 10),
      t: encodeActionTypes(f['Action Type'] || ''),
    };
    if (f['Status']) item.s = f['Status'];
    if (f['Link to Docket']) item.u = f['Link to Docket'];
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
