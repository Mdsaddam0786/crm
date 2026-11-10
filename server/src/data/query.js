import { BLANK, clean, normKey, phoneDigits, facet, isPlaceholder, SECTIONS } from './model.js';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export const MAX_PAGE_SIZE = 500;

function matchesToken(rec, token, digitsToken) {
  for (const v of Object.values(rec.values)) {
    if (v && v.toLowerCase().includes(token)) return true;
    if (digitsToken.length >= 4 && phoneDigits(v).includes(digitsToken)) return true;
  }
  return rec.derived.sharingDisplay?.includes(token) || false;
}

// Sharing ratios are matched on their recovered display form ("60:40" rather than "60:40:00").
const facetValue = (ds, rec, key) => (key === ds.roles.sharing && rec.derived.sharingDisplay) || rec.values[key] || '';

function passesFilter(ds, rec, key, spec) {
  if (!spec || typeof spec !== 'object') return true;
  const raw = key === '_month' ? rec.derived.month || '' : spec.op === 'in' ? facetValue(ds, rec, key) : rec.values[key] ?? '';
  switch (spec.op) {
    case 'in': {
      const vals = Array.isArray(spec.values) ? spec.values : [];
      return vals.length === 0 || vals.includes(key === '_month' ? raw || BLANK : normKey(raw));
    }
    case 'contains': {
      const needle = clean(spec.value).toLowerCase();
      return !needle || raw.toLowerCase().includes(needle);
    }
    case 'filled': return !!clean(raw);
    case 'blank': return !clean(raw);
    case 'range': {
      const n = key === '_areaAcres' ? rec.derived.areaAcres : key === '_rating' ? rec.derived.ratingValue : null;
      const min = spec.min === '' || spec.min == null ? null : Number(spec.min);
      const max = spec.max === '' || spec.max == null ? null : Number(spec.max);
      if (min == null && max == null) return true;
      if (n == null) return false;
      return (min == null || n >= min) && (max == null || n <= max);
    }
    default: return true;
  }
}

function sortValue(ds, rec, key) {
  if (key === '_row') return rec.row;
  if (key === ds.roles.jvId && rec.derived.sortKey) return rec.derived.sortKey;
  if (key === ds.roles.area) return rec.derived.areaAcres;
  if (key === ds.roles.rating) return rec.derived.ratingValue;
  return rec.values[key] || null;
}

export function filterRecords(ds, { q = '', filters = {} } = {}) {
  const tokens = clean(q).toLowerCase().split(' ').filter(Boolean);
  const validKeys = new Set([...ds.columns.map((c) => c.key), '_month', '_areaAcres', '_rating']);
  const active = Object.entries(filters).filter(([k]) => validKeys.has(k));
  return ds.records.filter((rec) =>
    tokens.every((t) => matchesToken(rec, t, t.replace(/\D/g, ''))) &&
    active.every(([k, spec]) => passesFilter(ds, rec, k, spec)));
}

export function sortRecords(ds, list, sort, dir) {
  const key = sort && (sort === '_row' || ds.columns.some((c) => c.key === sort)) ? sort : ds.defaultSort.key;
  const direction = (sort ? dir : ds.defaultSort.dir) === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const va = sortValue(ds, a, key);
    const vb = sortValue(ds, b, key);
    const ea = va == null || va === '';
    const eb = vb == null || vb === '';
    if (ea || eb) return ea === eb ? a.row - b.row : ea ? 1 : -1; // blanks always last
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
    return c * direction || a.row - b.row;
  });
}

export function queryRecords(ds, opts) {
  const filtered = sortRecords(ds, filterRecords(ds, opts), opts.sort, opts.dir);
  const pageSize = Math.min(Math.max(Number(opts.pageSize) || 25, 1), MAX_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(Number(opts.page) || 1, 1), totalPages);
  return {
    total: ds.records.length,
    matched: filtered.length,
    page,
    pageSize,
    totalPages,
    items: filtered.slice((page - 1) * pageSize, page * pageSize).map(publicRecord),
  };
}

export function publicRecord(rec) {
  return { id: rec.id, row: rec.row, jvId: rec.jvId, values: rec.values, derived: rec.derived, flags: rec.flags };
}

export function metadata(ds) {
  const facets = {};
  for (const c of ds.columns) if (c.filter === 'select') facets[c.key] = facet(ds, c.key, (r) => facetValue(ds, r, c.key));
  const months = facet(ds, null, (r) => r.derived.month || '').map((f) => ({
    ...f,
    value: f.value === BLANK ? BLANK : f.label,
    label: f.value === BLANK ? '(No date in JV ID)' : ds.records.find((r) => r.derived.month === f.label)?.derived.monthLabel || f.label,
  }));
  const acres = ds.records.map((r) => r.derived.areaAcres).filter((n) => n != null);
  return {
    tab: ds.tab,
    sheetUrl: ds.sheetUrl,
    headerRow: ds.headerRow,
    totalRecords: ds.records.length,
    columns: ds.columns.map(({ key, index, letter, label, hasHeader, role, type, filter, filled, placeholders, distinct }) => ({ key, index, letter, label, hasHeader, role, type, filter, filled, placeholders, distinct })),
    roles: ds.roles,
    sections: SECTIONS,
    facets,
    derivedFilters: {
      month: ds.records.some((r) => r.derived.month) ? months : null,
      areaAcres: acres.length ? { min: Math.min(...acres), max: Math.max(...acres) } : null,
    },
    defaultSort: ds.defaultSort,
  };
}

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export function stats(ds) {
  const n = ds.records.length;
  const roles = ds.roles;
  const acres = ds.records.map((r) => r.derived.areaAcres).filter((x) => x != null);
  const ratings = ds.records.map((r) => r.derived.ratingValue).filter((x) => x != null);
  const breakdown = (role) => (roles[role] ? { key: roles[role], label: ds.columns.find((c) => c.key === roles[role]).label, items: facet(ds, roles[role]) } : null);
  const pipeline = ['loi', 'mou', 'jda', 'status']
    .filter((r) => roles[r])
    .map((r) => {
      const col = ds.columns.find((c) => c.key === roles[r]);
      return { role: r, key: col.key, label: col.label, filled: col.filled, total: n, percent: pct(col.filled, n), values: col.filled ? facet(ds, col.key).filter((f) => f.value !== BLANK) : [] };
    });
  const recent = [...ds.records].sort((a, b) => (b.derived.sortKey || 0) - (a.derived.sortKey || 0) || b.row - a.row).slice(0, 6).map(publicRecord);
  const months = {};
  for (const r of ds.records) if (r.derived.month) months[r.derived.month] = { month: r.derived.month, label: r.derived.monthLabel, count: (months[r.derived.month]?.count || 0) + 1 };

  return {
    tab: ds.tab,
    totalRecords: n,
    totalColumns: ds.columns.length,
    area: roles.area ? { parsed: acres.length, of: n, totalAcres: Math.round(acres.reduce((a, b) => a + b, 0) * 100) / 100, avgAcres: acres.length ? Math.round((acres.reduce((a, b) => a + b, 0) / acres.length) * 100) / 100 : null, maxAcres: acres.length ? Math.max(...acres) : null } : null,
    rating: roles.rating ? { rated: ratings.length, of: n, average: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null } : null,
    byMonth: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
    breakdowns: {
      feasibility: breakdown('feasibility'),
      updatedBy: breakdown('updatedBy'),
      rating: breakdown('rating'),
      sharing: roles.sharing ? { ...breakdown('sharing'), items: facet(ds, null, (r) => facetValue(ds, r, roles.sharing)) } : null,
      status: breakdown('status'),
      city: breakdown('city'),
    },
    pipeline,
    contacts: roles.phone ? new Set(ds.records.map((r) => phoneDigits(r.values[roles.phone])).filter(Boolean)).size : null,
    recent,
  };
}

export function quality(ds) {
  const n = ds.records.length;
  const completeness = ds.columns.map((c) => ({ key: c.key, label: c.label, letter: c.letter, filled: c.filled, placeholders: c.placeholders, empty: n - c.filled, percent: pct(c.filled - c.placeholders, n) }));
  const casing = [];
  for (const c of ds.columns.filter((col) => col.filter === 'select')) {
    for (const f of facet(ds, c.key)) if (f.variants.length > 1) casing.push({ column: c.label, key: c.key, variants: f.variants, count: f.count });
  }
  const placeholderValues = [];
  for (const c of ds.columns) {
    const counts = {};
    for (const r of ds.records) if (isPlaceholder(r.values[c.key])) counts[clean(r.values[c.key])] = (counts[clean(r.values[c.key])] || 0) + 1;
    for (const [value, count] of Object.entries(counts)) placeholderValues.push({ column: c.label, value, count });
  }
  const flagged = ds.records.filter((r) => r.flags.length).map((r) => ({ id: r.id, row: r.row, jvId: r.jvId, flags: r.flags.map((f) => ({ ...f, column: ds.columns.find((c) => c.key === f.field)?.label || null })) }));
  return {
    tab: ds.tab,
    totalRecords: n,
    headerRow: ds.headerRow,
    blankRowsSkipped: ds.blankRows,
    duplicateRowGroups: ds.duplicateRows,
    emptyColumns: ds.columns.filter((c) => c.filled === 0).map((c) => ({ label: c.label, letter: c.letter })),
    headerlessColumns: ds.columns.filter((c) => !c.hasHeader).map((c) => ({ label: c.label, letter: c.letter, filled: c.filled })),
    completeness,
    casing,
    placeholderValues,
    flagged,
  };
}

export function contacts(ds) {
  const { phone, updatedBy } = ds.roles;
  if (!phone) return null;
  const map = new Map();
  for (const r of ds.records) {
    const digits = phoneDigits(r.values[phone]);
    const key = digits || `name:${normKey(updatedBy ? r.values[updatedBy] : '')}`;
    if (!digits && !(updatedBy && clean(r.values[updatedBy]))) continue;
    const g = map.get(key) || { key, phone: r.values[phone] || null, phoneDigits: digits || null, names: new Set(), listings: [] };
    if (updatedBy && clean(r.values[updatedBy])) g.names.add(clean(r.values[updatedBy]));
    g.listings.push({ id: r.id, jvId: r.jvId, row: r.row, location: ds.roles.location ? r.values[ds.roles.location] : null, sortKey: r.derived.sortKey || 0 });
    map.set(key, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, names: [...g.names], listings: g.listings.sort((a, b) => b.sortKey - a.sortKey) }))
    .sort((a, b) => b.listings.length - a.listings.length || (a.names[0] || '').localeCompare(b.names[0] || ''));
}
