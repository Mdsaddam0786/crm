import crypto from 'node:crypto';
import { repo, StoreError } from './repo.js';
import { getDataset, invalidate } from './store.js';
import { FIELDS, IMPORT_RULES } from './fields.js';
import { clean, normKey, nextJvId } from './model.js';
import { parseCsv } from './csv.js';
import { sanitize } from './validate.js';

const badRequest = (msg) => new StoreError(msg, { status: 400, code: 'VALIDATION' });

/**
 * Imports listings from CSV text. Columns are matched to fields by label or known alias.
 * mode 'skip' leaves existing JV IDs untouched; 'update' overwrites only the columns present in the file.
 */
export async function importCsv(csv, { mode = 'skip', dryRun = false, username }) {
  if (typeof csv !== 'string' || !csv.trim()) throw badRequest('The file is empty.');
  if (!['skip', 'update'].includes(mode)) throw badRequest('Invalid import mode.');
  const rows = parseCsv(csv.replace(/^﻿/, ''));
  const headerIdx = rows.findIndex((r) => r.some((c) => clean(c)));
  if (headerIdx < 0) throw badRequest('No header row found.');
  const header = rows[headerIdx];

  // Map file columns to fields: exact label/key first, then known aliases.
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
  if (!map.size) throw badRequest('None of the file\'s columns match the listing fields. Check the header row.');
  const ignoredColumns = header.map((h, i) => (!map.has(i) && clean(h) ? clean(h) : null)).filter(Boolean);
  const emptyHeaderData = header.some((h, i) => !clean(h) && rows.slice(headerIdx + 1).some((r) => clean(r[i])));

  const ds = await getDataset();
  const existing = new Map(ds.records.filter((r) => r.values.jv_id).map((r) => [normKey(r.values.jv_id), r]));
  const seen = new Set();
  const pseudo = [...ds.records];
  const now = new Date().toISOString();
  const result = { created: 0, updated: 0, skipped: 0, blankRows: 0, errors: [], ignoredColumns, emptyHeaderData };
  const inserts = [];
  const updates = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const raw = rows[r];
    const line = r + 1;
    if (!raw.some((c) => clean(c))) { result.blankRows++; continue; }
    const input = {};
    for (const [i, key] of map) input[key] = raw[i] ?? '';
    if (!clean(input.jv_id)) {
      input.jv_id = nextJvId(pseudo);
      pseudo.push({ values: { jv_id: input.jv_id } });
    }
    let values;
    try { values = sanitize(input); } catch (e) { result.errors.push({ line, message: e.message }); continue; }
    const k = normKey(values.jv_id);
    if (seen.has(k)) { result.errors.push({ line, message: `Duplicate JV ID "${values.jv_id}" within the file — skipped.` }); continue; }
    seen.add(k);
    const current = existing.get(k);
    if (current) {
      if (mode === 'skip') { result.skipped++; continue; }
      // Only overwrite fields present in the file; keep everything else.
      const merged = { ...current.values };
      for (const key of map.values()) merged[key] = values[key];
      updates.push({ id: current.id, doc: { values: merged, jvIdKey: k, updatedAt: now, updatedBy: username } });
      result.updated++;
    } else {
      inserts.push({ id: crypto.randomUUID(), values, jvIdKey: k, createdAt: now, updatedAt: now, createdBy: username, updatedBy: username });
      result.created++;
    }
  }

  if (!dryRun) {
    await repo.insertMany(inserts);
    for (const u of updates) await repo.update(u.id, u.doc);
    invalidate();
  }
  return { ...result, dryRun: !!dryRun, mapping: [...map].map(([i, key]) => ({ column: clean(header[i]), field: FIELDS.find((f) => f.key === key).label })) };
}
