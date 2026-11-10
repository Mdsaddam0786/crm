import { FIELDS, IMPORT_RULES } from './fields.js';
import { clean, normKey, nextJvId } from './model.js';
import { parseCsv } from './csv.js';
import { sanitize } from './validate.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function fromCsv(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const headerIdx = rows.findIndex((r) => r.some((c) => clean(c)));
  if (headerIdx < 0) return [];
  const header = rows[headerIdx];
  const map = new Map();
  const used = new Set();
  header.forEach((h, i) => {
    const label = clean(h).toLowerCase();
    const f = FIELDS.find((x) => !used.has(x.key) && (x.label.toLowerCase() === label || x.key === label));
    if (f) { map.set(i, f.key); used.add(f.key); }
  });
  header.forEach((h, i) => {
    if (map.has(i) || !clean(h)) return;
    const rule = IMPORT_RULES.find(([k, re]) => !used.has(k) && re.test(clean(h)));
    if (rule) { map.set(i, rule[0]); used.add(rule[0]); }
  });
  return rows.slice(headerIdx + 1)
    .filter((r) => r.some((c) => clean(c)))
    .map((r) => Object.fromEntries([...map].map(([i, key]) => [key, r[i] ?? ''])));
}

function fromJson(text) {
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) throw new Error('JV_DATA JSON must be an array.');
  // Accept either { values: {...} } documents or flat objects keyed by field key/label.
  return arr.map((o) => {
    const src = o && typeof o.values === 'object' ? o.values : o || {};
    const out = {};
    for (const f of FIELDS) out[f.key] = src[f.key] ?? src[f.label] ?? '';
    return out;
  });
}

/** Parses JV_DATA (CSV or JSON) into listing documents. Invalid rows are skipped with a log line. */
export function parseStaticData(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  const inputs = trimmed.startsWith('[') ? fromJson(trimmed) : fromCsv(trimmed);
  const docs = [];
  const seen = new Set();
  const now = new Date().toISOString();
  for (const input of inputs) {
    if (!clean(input.jv_id)) input.jv_id = nextJvId(docs);
    let values;
    try { values = sanitize(input); } catch (e) { console.warn(`[JV_DATA] skipped a row: ${e.message}`); continue; }
    const key = normKey(values.jv_id);
    if (seen.has(key)) { console.warn(`[JV_DATA] skipped duplicate JV ID ${values.jv_id}`); continue; }
    seen.add(key);
    docs.push({ id: slug(values.jv_id) || `listing-${docs.length + 1}`, values, jvIdKey: key, createdAt: null, updatedAt: null, createdBy: null, updatedBy: null });
  }
  return docs;
}
