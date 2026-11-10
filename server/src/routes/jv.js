import crypto from 'node:crypto';
import { Router } from 'express';
import { getDataset, invalidate, storageKind } from '../data/store.js';
import { repo, StoreError, conflict } from '../data/repo.js';
import { normKey, nextJvId } from '../data/model.js';
import { sanitize } from '../data/validate.js';
import { importCsv } from '../data/importer.js';
import { queryRecords, filterRecords, sortRecords, metadata, stats, quality, contacts, publicRecord } from '../data/query.js';
import { requireRole } from '../auth.js';
import { toCsv } from '../data/csv.js';
import { config } from '../config.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const canEdit = requireRole('admin', 'editor');
const badRequest = (msg) => new StoreError(msg, { status: 400, code: 'VALIDATION' });

function parseFilters(raw) {
  if (!raw) return {};
  try {
    const f = JSON.parse(raw);
    return f && typeof f === 'object' && !Array.isArray(f) ? f : {};
  } catch {
    throw badRequest('Invalid filters parameter (expected JSON).');
  }
}

const queryOpts = (q) => ({
  q: String(q.q || '').slice(0, 200),
  filters: parseFilters(q.filters),
  sort: q.sort ? String(q.sort) : '',
  dir: q.dir === 'desc' ? 'desc' : 'asc',
  page: q.page,
  pageSize: q.pageSize,
});

function assertUniqueId(ds, values, selfId) {
  const k = normKey(values.jv_id);
  if (ds.records.some((r) => r.id !== selfId && normKey(r.values.jv_id) === k)) throw conflict(`JV ID "${values.jv_id}" is already used by another listing.`);
}

// ---------- Read ----------
router.get('/jv', wrap(async (req, res) => {
  res.json(queryRecords(await getDataset(), queryOpts(req.query)));
}));

router.get('/jv/metadata', wrap(async (req, res) => {
  const ds = await getDataset();
  res.json({ ...metadata(ds), nextJvId: nextJvId(ds.records), phoneCountryCode: config.phoneCountryCode, storage: storageKind() });
}));

router.get('/jv/stats', wrap(async (req, res) => res.json(stats(await getDataset()))));
router.get('/jv/quality', wrap(async (req, res) => res.json(quality(await getDataset()))));
router.get('/jv/contacts', wrap(async (req, res) => res.json({ items: contacts(await getDataset()) })));

router.get('/jv/export', wrap(async (req, res) => {
  const ds = await getDataset();
  const opts = queryOpts(req.query);
  const list = sortRecords(ds, filterRecords(ds, opts), opts.sort, opts.dir);
  const csv = toCsv([
    [...ds.columns.map((c) => c.label), 'Created At', 'Created By', 'Updated At', 'Updated By (user)'],
    ...list.map((r) => [...ds.columns.map((c) => r.values[c.key]), r.createdAt || '', r.createdBy || '', r.updatedAt || '', r.updatedBy || '']),
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="jv-listings-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + csv);
}));

router.get('/jv/:id', wrap(async (req, res) => {
  const ds = await getDataset();
  const rec = ds.byId.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'JV listing not found. It may have been deleted.' });
  const ids = sortRecords(ds, ds.records, '', '').map((r) => r.id);
  const i = ids.indexOf(rec.id);
  res.json({ record: publicRecord(rec), prevId: ids[i - 1] || null, nextId: ids[i + 1] || null });
}));

// ---------- Write ----------
router.post('/jv', canEdit, wrap(async (req, res) => {
  const values = sanitize(req.body?.values);
  assertUniqueId(await getDataset(), values);
  const now = new Date().toISOString();
  const doc = { id: crypto.randomUUID(), values, jvIdKey: normKey(values.jv_id), createdAt: now, updatedAt: now, createdBy: req.user.username, updatedBy: req.user.username };
  await repo.insertMany([doc]);
  invalidate();
  res.status(201).json({ id: doc.id });
}));

router.put('/jv/:id', canEdit, wrap(async (req, res) => {
  const ds = await getDataset();
  if (!ds.byId.has(req.params.id)) return res.status(404).json({ error: 'JV listing not found. It may have been deleted.' });
  const values = sanitize(req.body?.values);
  assertUniqueId(ds, values, req.params.id);
  const doc = { values, jvIdKey: normKey(values.jv_id), updatedAt: new Date().toISOString(), updatedBy: req.user.username };
  // Optimistic locking: refuse to overwrite someone else's newer edit.
  const ok = await repo.update(req.params.id, doc, req.body?.expectedUpdatedAt || null);
  invalidate();
  if (!ok) throw conflict('This listing was changed by someone else while you were editing. Reload it and apply your changes again.');
  res.json({ id: req.params.id });
}));

router.delete('/jv/:id', requireRole('admin'), wrap(async (req, res) => {
  const ok = await repo.remove(req.params.id);
  invalidate();
  if (!ok) return res.status(404).json({ error: 'JV listing not found.' });
  res.status(204).end();
}));

// POST /api/jv/import  { csv: string, mode: 'skip' | 'update', dryRun?: boolean }
router.post('/jv/import', requireRole('admin'), wrap(async (req, res) => {
  const { csv, mode, dryRun } = req.body || {};
  res.json(await importCsv(csv, { mode, dryRun, username: req.user.username }));
}));

router.get('/system/status', wrap(async (req, res) => {
  const kind = storageKind();
  let records = null;
  let error = null;
  try { records = (await getDataset()).records.length; } catch (e) { error = { message: e.message, hint: e.hint }; }
  res.json({ storage: kind, database: kind === 'mongodb' ? config.mongoDb : null, records, error });
}));

export default router;
