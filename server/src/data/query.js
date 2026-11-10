import { BLANK, clean, normKey, phoneDigits, facet, isPlaceholder } from './model.js';
import { SECTIONS } from './fields.js';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export const MAX_PAGE_SIZE = 500;

const created = (r) => (r.createdAt ? Date.parse(r.createdAt) : 0);
const tieBreak = (a, b) => created(b) - created(a) || collator.compare(a.id, b.id);

function matchesToken(rec, token, digitsToken) {
  for (const v of Object.values(rec.values)) {
    if (v && v.toLowerCase().includes(token)) return true;
    if (digitsToken.length >= 4 && phoneDigits(v).includes(digitsToken)) return true;
  }
  return false;
}

function passesFilter(rec, key, spec) {
  if (!spec || typeof spec !== 'object') return true;
  const raw = key === '_month' ? rec.derived.month || '' : rec.values[key] ?? '';
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
  if (key === '_created') return created(rec);
  if (key === '_updated') return rec.updatedAt ? Date.parse(rec.updatedAt) : null;
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
    active.every(([k, spec]) => passesFilter(rec, k, spec)));
}

export function sortRecords(ds, list, sort, dir) {
  const valid = sort && (sort === '_created' || sort === '_updated' || ds.columns.some((c) => c.key === sort));
  const key = valid ? sort : ds.defaultSort.key;
  const direction = (valid ? dir : ds.defaultSort.dir) === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const va = sortValue(ds, a, key);
    const vb = sortValue(ds, b, key);
    const ea = va == null || va === '';
    const eb = vb == null || vb === '';
    if (ea || eb) return ea === eb ? tieBreak(a, b) : ea ? 1 : -1; // blanks always last
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
    return c * direction || tieBreak(a, b);
  });
}

export function publicRecord(rec) {
  const { id, jvId, values, derived, flags, createdAt, updatedAt, createdBy, updatedBy } = rec;
  return { id, jvId, values, derived, flags, createdAt, updatedAt, createdBy, updatedBy };
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

export function metadata(ds) {
  const facets = {};
  // Suggestions for every text field (used by filters and by the edit form's autocomplete).
  for (const c of ds.columns) if (c.type === 'text' && c.role !== 'notes' && c.role !== 'jvId') facets[c.key] = facet(ds, c.key);
  const months = facet(ds, null, (r) => r.derived.month || '').map((f) => ({
    ...f,
    value: f.value === BLANK ? BLANK : f.label,
    label: f.value === BLANK ? '(No date in JV ID)' : ds.records.find((r) => r.derived.month === f.label)?.derived.monthLabel || f.label,
  }));
  const acres = ds.records.map((r) => r.derived.areaAcres).filter((n) => n != null);
  return {
    totalRecords: ds.records.length,
    columns: ds.columns.map(({ key, index, label, role, type, filter, filled, placeholders, distinct, required, multiline, placeholder }) => ({ key, index, label, role, type, filter, filled, placeholders, distinct, required: !!required, multiline: !!multiline, placeholder })),
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
  const breakdown = (role) => ({ key: roles[role], label: ds.columns.find((c) => c.key === roles[role]).label, items: facet(ds, roles[role]) });
  const pipeline = ['loi', 'mou', 'jda', 'status'].map((r) => {
    const col = ds.columns.find((c) => c.key === roles[r]);
    return { role: r, key: col.key, label: col.label, filled: col.filled, total: n, percent: pct(col.filled, n), values: col.filled ? facet(ds, col.key).filter((f) => f.value !== BLANK) : [] };
  });
  const recent = [...ds.records].sort((a, b) => (b.derived.sortKey || 0) - (a.derived.sortKey || 0) || tieBreak(a, b)).slice(0, 6).map(publicRecord);
  const months = {};
  for (const r of ds.records) if (r.derived.month) months[r.derived.month] = { month: r.derived.month, label: r.derived.monthLabel, count: (months[r.derived.month]?.count || 0) + 1 };
  const sum = acres.reduce((a, b) => a + b, 0);

  return {
    totalRecords: n,
    totalColumns: ds.columns.length,
    area: { parsed: acres.length, of: n, totalAcres: Math.round(sum * 100) / 100, avgAcres: acres.length ? Math.round((sum / acres.length) * 100) / 100 : null, maxAcres: acres.length ? Math.max(...acres) : null },
    rating: { rated: ratings.length, of: n, average: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null },
    byMonth: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
    breakdowns: {
      feasibility: breakdown('feasibility'),
      updatedBy: breakdown('updatedBy'),
      rating: breakdown('rating'),
      sharing: breakdown('sharing'),
      status: breakdown('status'),
    },
    pipeline,
    contacts: new Set(ds.records.map((r) => phoneDigits(r.values[roles.phone])).filter(Boolean)).size,
    recent,
  };
}

export function quality(ds) {
  const n = ds.records.length;
  const completeness = ds.columns.map((c) => ({ key: c.key, label: c.label, filled: c.filled, placeholders: c.placeholders, empty: n - c.filled, percent: pct(c.filled - c.placeholders, n) }));
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
  const flagged = ds.records.filter((r) => r.flags.length).map((r) => ({ id: r.id, jvId: r.jvId, flags: r.flags.map((f) => ({ ...f, column: ds.columns.find((c) => c.key === f.field)?.label || null })) }));
  return {
    totalRecords: n,
    emptyColumns: ds.columns.filter((c) => c.filled === 0).map((c) => ({ label: c.label })),
    completeness,
    casing,
    placeholderValues,
    flagged,
  };
}

export function contacts(ds) {
  const { phone, updatedBy, location } = ds.roles;
  const map = new Map();
  for (const r of ds.records) {
    const digits = phoneDigits(r.values[phone]);
    const name = clean(r.values[updatedBy]);
    if (!digits && !name) continue;
    const key = digits || `name:${name.toLowerCase()}`;
    const g = map.get(key) || { key, phone: r.values[phone] || null, phoneDigits: digits || null, names: new Set(), listings: [] };
    if (name) g.names.add(name);
    g.listings.push({ id: r.id, jvId: r.jvId, location: r.values[location] || null, sortKey: r.derived.sortKey || 0 });
    map.set(key, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, names: [...g.names], listings: g.listings.sort((a, b) => b.sortKey - a.sortKey) }))
    .sort((a, b) => b.listings.length - a.listings.length || (a.names[0] || '').localeCompare(b.names[0] || ''));
}
