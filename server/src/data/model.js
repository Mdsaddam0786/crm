/**
 * Turns raw sheet rows into a dataset: dynamic column mapping, record ids,
 * derived (clearly-labelled, non-destructive) values and data-quality flags.
 * Original cell values are always preserved verbatim in record.values.
 */

// Column "roles" are detected from header text so the UI can render sections,
// call/map actions and filters. Unknown headers still appear under "Other details".
const ROLE_RULES = [
  ['jvId', /\bjv\s*id\b|^id$/i],
  ['feasibility', /feasibility/i],
  ['updatedBy', /updated\s*by/i],
  ['phone', /\brea\s*no\b|phone|mobile|contact\s*(no|number)|whatsapp/i],
  ['email', /e-?mail/i],
  ['rating', /rating/i],
  ['mapLink', /google\s*pin|\bmap\b|lat\s*\/?\s*long/i],
  ['location', /^location$|village|address|locality/i],
  ['city', /^city$|district|town/i],
  ['area', /^area$|extent|land\s*size/i],
  ['road', /road/i],
  ['goodwill', /goodwill/i],
  ['sharing', /sharing|ratio/i],
  ['loi', /\bloi\b/i],
  ['mou', /\bmou\b/i],
  ['jda', /\bjda\b|\bllp\b/i],
  ['status', /^status$|\bstage\b/i],
];

export const SECTIONS = [
  { id: 'overview', title: 'Overview', roles: ['jvId', 'feasibility', 'rating', 'status'] },
  { id: 'contact', title: 'Source & Contact', roles: ['updatedBy', 'phone', 'email'] },
  { id: 'property', title: 'Property', roles: ['location', 'city', 'mapLink', 'area', 'road'] },
  { id: 'commercials', title: 'Commercials', roles: ['goodwill', 'sharing'] },
  { id: 'documents', title: 'Deal Documents & Progress', roles: ['loi', 'mou', 'jda'] },
];

const SELECT_ROLES = new Set(['feasibility', 'updatedBy', 'rating', 'sharing', 'status', 'loi', 'mou', 'jda', 'city']);
const PLACEHOLDERS = new Set(['-', '--', '—', 'tbd', 'na', 'n/a', 'not provided', 'null', '?']);
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const BLANK = '__blank__';
export const clean = (v) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
export const normKey = (v) => clean(v).toLowerCase() || BLANK;
export const isPlaceholder = (v) => PLACEHOLDERS.has(clean(v).toLowerCase());

function columnLetter(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function slug(s) {
  return clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'column';
}

// ---- Derived value parsers (never replace originals) ----
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

function parseJvId(raw) {
  const m = clean(raw).match(/^(\d{4})[.\-/ ]([A-Za-z]{3})[.\-/ ](\d+)$/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2].toUpperCase());
  if (mi < 0) return null;
  return {
    month: `${m[1]}-${String(mi + 1).padStart(2, '0')}`,
    monthLabel: `${m[2][0].toUpperCase()}${m[2].slice(1, 3).toLowerCase()} ${m[1]}`,
    sortKey: Number(m[1]) * 1e7 + (mi + 1) * 1e5 + Number(m[3]),
  };
}

/** Google Sheets turns "60:40" into the duration "60:40:00". Recover the ratio for display only. */
function sharingDisplay(raw) {
  const m = clean(raw).match(/^(\d+):(\d{2}):00$/);
  return m ? `${Number(m[1])}:${m[2]}` : null;
}

export const phoneDigits = (v) => clean(v).replace(/\D/g, '');

// ---- Dataset builder ----
export function buildDataset(tab, spreadsheetId) {
  const rows = tab.rows || [];
  const headerIdx = rows.findIndex((r) => r.some((c) => clean(c)));
  if (headerIdx < 0) return emptyDataset(tab);

  const width = Math.max(...rows.map((r) => r.length));
  const header = rows[headerIdx];
  const used = new Set();
  const assigned = new Set();
  let columns = [];
  for (let i = 0; i < width; i++) {
    const label = clean(header[i]);
    let key = slug(label || `column_${columnLetter(i)}`);
    while (used.has(key)) key += '_2';
    used.add(key);
    let role = null;
    if (label) {
      for (const [r, re] of ROLE_RULES) if (!assigned.has(r) && re.test(label)) { role = r; assigned.add(r); break; }
    }
    columns.push({ key, index: i, letter: columnLetter(i), label: label || `Column ${columnLetter(i)} (no header)`, hasHeader: !!label, role });
  }

  const records = [];
  const blankRows = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const raw = rows[r];
    const sheetRow = r + 1;
    if (!raw.some((c) => clean(c))) { blankRows.push(sheetRow); continue; }
    const values = {};
    for (const c of columns) values[c.key] = raw[c.index] == null ? '' : String(raw[c.index]).trim();
    records.push({ row: sheetRow, values, derived: {}, flags: [] });
  }
  // Trailing header-less columns with no data are spreadsheet noise; interior ones are kept.
  while (columns.length && !columns.at(-1).hasHeader && records.every((rec) => !rec.values[columns.at(-1).key])) columns.pop();

  const byRole = Object.fromEntries(columns.filter((c) => c.role).map((c) => [c.role, c]));

  // Profile columns
  for (const c of columns) {
    const vals = records.map((r) => r.values[c.key]);
    const filled = vals.filter(Boolean);
    const distinct = new Set(filled.map(normKey));
    const allUrl = filled.length > 0 && filled.every((v) => /^https?:\/\/\S+$/i.test(v));
    const allEmail = filled.length > 0 && filled.every((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
    const allPhone = filled.length > 0 && filled.every((v) => /^\+?[\d\s\-()]{10,16}$/.test(v));
    c.type = allUrl ? 'url' : allEmail || c.role === 'email' ? 'email' : c.role === 'phone' || allPhone ? 'phone' : 'text';
    c.filled = filled.length;
    c.placeholders = filled.filter(isPlaceholder).length;
    c.distinct = distinct.size;
    c.filter = filled.length === 0
      ? 'presence'
      : SELECT_ROLES.has(c.role) || (c.type === 'text' && distinct.size <= 15 && distinct.size <= Math.max(2, filled.length * 0.7))
        ? 'select'
        : 'text';
  }

  // Ids, derived values and flags
  const idCol = byRole.jvId;
  const idCount = {};
  if (idCol) for (const rec of records) { const k = normKey(rec.values[idCol.key]); if (k !== BLANK) idCount[k] = (idCount[k] || 0) + 1; }
  const rowSig = {};
  for (const rec of records) {
    const v = rec.values;
    const idRaw = idCol ? v[idCol.key] : '';
    const unique = idRaw && idCount[normKey(idRaw)] === 1;
    rec.id = unique ? idRaw : `row-${rec.row}`;
    rec.jvId = idRaw || null;
    if (idCol && !idRaw) rec.flags.push({ field: idCol.key, msg: 'Missing JV ID' });
    if (idRaw && !unique) rec.flags.push({ field: idCol.key, msg: `Duplicate JV ID (${idCount[normKey(idRaw)]} rows)` });

    const d = rec.derived;
    if (idRaw) Object.assign(d, parseJvId(idRaw) || {});
    if (byRole.area) {
      d.areaAcres = parseAreaAcres(v[byRole.area.key]);
      if (v[byRole.area.key] && d.areaAcres == null && !isPlaceholder(v[byRole.area.key])) rec.flags.push({ field: byRole.area.key, msg: 'Area could not be interpreted' });
    }
    if (byRole.rating) {
      const rv = v[byRole.rating.key];
      d.ratingValue = parseRating(rv);
      if (rv && !/^\d+(\.\d+)?$/.test(rv)) rec.flags.push({ field: byRole.rating.key, msg: `Non-numeric rating "${rv}"` });
    }
    if (byRole.sharing) {
      const s = sharingDisplay(v[byRole.sharing.key]);
      if (s) { d.sharingDisplay = s; rec.flags.push({ field: byRole.sharing.key, msg: `Google Sheets formatted the ratio as a time ("${v[byRole.sharing.key]}")` }); }
    }
    if (byRole.phone) {
      const p = phoneDigits(v[byRole.phone.key]);
      if (v[byRole.phone.key] && p.length !== 10 && !(p.length === 12 && p.startsWith('91'))) rec.flags.push({ field: byRole.phone.key, msg: 'Phone number is not 10 digits' });
    }
    const sig = columns.map((c) => normKey(v[c.key])).join('\u0001');
    (rowSig[sig] ||= []).push(rec.row);
  }

  const duplicateRows = Object.values(rowSig).filter((r) => r.length > 1);
  for (const group of duplicateRows) for (const rec of records) if (group.includes(rec.row)) rec.flags.push({ field: null, msg: `Exact duplicate of row(s) ${group.filter((x) => x !== rec.row).join(', ')}` });

  // Newest first when JV IDs are sortable, otherwise sheet order.
  const sorted = records.some((r) => r.derived.sortKey);
  return {
    tab: { name: tab.name, gid: tab.gid, hidden: !!tab.hidden },
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${tab.gid}`,
    headerRow: headerIdx + 1,
    columns,
    roles: Object.fromEntries(Object.entries(byRole).map(([r, c]) => [r, c.key])),
    records,
    byId: new Map(records.map((r) => [r.id, r])),
    blankRows,
    duplicateRows,
    defaultSort: sorted ? { key: idCol.key, dir: 'desc' } : { key: '_row', dir: 'asc' },
  };
}

function emptyDataset(tab) {
  return { tab: { name: tab.name, gid: tab.gid, hidden: !!tab.hidden }, headerRow: null, columns: [], roles: {}, records: [], byId: new Map(), blankRows: [], duplicateRows: [], defaultSort: { key: '_row', dir: 'asc' } };
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
