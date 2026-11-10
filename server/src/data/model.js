/**
 * Turns stored listing documents into an in-memory dataset: column profiles,
 * derived (clearly-labelled, non-destructive) values and data-quality flags.
 */
import { FIELDS } from './fields.js';

const SELECT_ROLES = new Set(['feasibility', 'updatedBy', 'rating', 'sharing', 'status', 'loi', 'mou', 'jda']);
const PLACEHOLDERS = new Set(['-', '--', '—', 'tbd', 'na', 'n/a', 'not provided', 'null', '?']);
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const BLANK = '__blank__';
export const clean = (v) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
export const normKey = (v) => clean(v).toLowerCase() || BLANK;
export const isPlaceholder = (v) => PLACEHOLDERS.has(clean(v).toLowerCase());
export const phoneDigits = (v) => clean(v).replace(/\D/g, '');

// ---- Derived value parsers (never replace stored values) ----
export function parseAreaAcres(raw) {
  const s = clean(raw);
  if (!s) return null;
  const main = s.split('(')[0]; // "(Net Area: …)" notes are ignored; gross area is used
  let acres = 0;
  let found = false;
  const a = main.match(/(\d+(?:\.\d+)?)\s*(acres?|ac)\b/i);
  const g = main.match(/(\d+(?:\.\d+)?)\s*(guntas?|guntha?s?)\b/i);
  if (a) { acres += Number(a[1]); found = true; }
  if (g) { acres += Number(g[1]) / 40; found = true; } // 1 acre = 40 guntas
  if (!found) {
    const sq = main.match(/([\d,]+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|square\s*feet)/i);
    if (sq) { acres = Number(sq[1].replace(/,/g, '')) / 43560; found = true; }
  }
  return found ? Math.round(acres * 1000) / 1000 : null;
}

function parseRating(raw) {
  const m = clean(raw).match(/^(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export function parseJvId(raw) {
  const m = clean(raw).match(/^(\d{4})[.\-/ ]([A-Za-z]{3})[.\-/ ](\d+)$/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2].toUpperCase());
  if (mi < 0) return null;
  return {
    month: `${m[1]}-${String(mi + 1).padStart(2, '0')}`,
    monthLabel: `${m[2][0].toUpperCase()}${m[2].slice(1, 3).toLowerCase()} ${m[1]}`,
    seq: Number(m[3]),
    sortKey: Number(m[1]) * 1e7 + (mi + 1) * 1e5 + Number(m[3]),
  };
}

/** Next JV ID in the YYYY.MON.NNN scheme: current month + (highest sequence + 1). */
export function nextJvId(records, now = new Date()) {
  const max = records.reduce((m, r) => Math.max(m, parseJvId(r.values.jv_id)?.seq || 0), 0);
  return `${now.getFullYear()}.${MONTHS[now.getMonth()]}.${max + 1}`;
}

/** Spreadsheets turn "60:40" into the duration "60:40:00"; normalise it back. */
export function normaliseSharing(v) {
  const m = clean(v).match(/^(\d+):(\d{2}):00$/);
  return m ? `${Number(m[1])}:${m[2]}` : v;
}

// ---- Dataset builder ----
export function buildDataset(docs) {
  const columns = FIELDS.map((f, index) => ({ ...f, index, type: f.type || 'text' }));
  const roles = Object.fromEntries(columns.map((c) => [c.role, c.key]));

  const records = docs.map((d) => {
    const values = {};
    for (const c of columns) values[c.key] = clean(d.values?.[c.key]) === '' ? '' : String(d.values[c.key]).trim();
    return { id: d.id, values, derived: {}, flags: [], createdAt: d.createdAt || null, updatedAt: d.updatedAt || null, createdBy: d.createdBy || null, updatedBy: d.updatedBy || null };
  });

  for (const c of columns) {
    const filled = records.map((r) => r.values[c.key]).filter(Boolean);
    const distinct = new Set(filled.map(normKey));
    c.filled = filled.length;
    c.placeholders = filled.filter(isPlaceholder).length;
    c.distinct = distinct.size;
    c.filter = c.type === 'url' || c.role === 'notes'
      ? (filled.length ? 'text' : 'presence')
      : filled.length === 0
        ? 'presence'
        : SELECT_ROLES.has(c.role) ? 'select' : 'text';
  }

  const idCount = {};
  for (const r of records) { const k = normKey(r.values.jv_id); if (k !== BLANK) idCount[k] = (idCount[k] || 0) + 1; }
  for (const rec of records) {
    const v = rec.values;
    const d = rec.derived;
    rec.jvId = v.jv_id || null;
    if (!v.jv_id) rec.flags.push({ field: 'jv_id', msg: 'Missing JV ID' });
    else if (idCount[normKey(v.jv_id)] > 1) rec.flags.push({ field: 'jv_id', msg: 'Duplicate JV ID' });
    Object.assign(d, parseJvId(v.jv_id) || {});
    d.areaAcres = parseAreaAcres(v.area);
    if (v.area && d.areaAcres == null && !isPlaceholder(v.area)) rec.flags.push({ field: 'area', msg: 'Area could not be interpreted as acres/guntas' });
    d.ratingValue = parseRating(v.ratings);
    if (v.ratings && !/^\d+(\.\d+)?$/.test(v.ratings)) rec.flags.push({ field: 'ratings', msg: `Non-numeric rating "${v.ratings}"` });
    const p = phoneDigits(v.rea_no);
    if (v.rea_no && p.length !== 10 && !(p.length === 12 && p.startsWith('91'))) rec.flags.push({ field: 'rea_no', msg: 'Phone number is not 10 digits' });
  }

  return {
    columns,
    roles,
    records,
    byId: new Map(records.map((r) => [r.id, r])),
    defaultSort: { key: 'jv_id', dir: 'desc' },
  };
}

/** Facet values for a column, grouped case/space-insensitively, with the most common spelling as label. */
export function facet(ds, key, getter) {
  const groups = new Map();
  for (const rec of ds.records) {
    const raw = getter ? getter(rec) : rec.values[key];
    const k = normKey(raw);
    const g = groups.get(k) || { value: k, count: 0, spellings: {} };
    g.count++;
    const sp = clean(raw);
    g.spellings[sp] = (g.spellings[sp] || 0) + 1;
    groups.set(k, g);
  }
  return [...groups.values()]
    .map((g) => {
      const label = g.value === BLANK ? '(Blank)' : Object.entries(g.spellings).sort((a, b) => b[1] - a[1] || (/^[A-Z]/.test(b[0]) - /^[A-Z]/.test(a[0])))[0][0];
      return { value: g.value, label, count: g.count, variants: Object.keys(g.spellings).filter(Boolean) };
    })
    .sort((a, b) => (a.value === BLANK) - (b.value === BLANK) || b.count - a.count || a.label.localeCompare(b.label));
}
