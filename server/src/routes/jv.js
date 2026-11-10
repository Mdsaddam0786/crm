import { Router } from 'express';
import { getDataset, getWorkbook, syncStatus } from '../data/store.js';
import { queryRecords, filterRecords, sortRecords, metadata, stats, quality, contacts, publicRecord } from '../data/query.js';
import { requireRole } from '../auth.js';
import { toCsv } from '../sheets/csv.js';
import { serviceAccountEmail } from '../sheets/source.js';
import { config } from '../config.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function parseFilters(raw) {
  if (!raw) return {};
  try {
    const f = JSON.parse(raw);
    return f && typeof f === 'object' && !Array.isArray(f) ? f : {};
  } catch {
    const err = new Error('Invalid filters parameter (expected JSON).');
    err.status = 400;
    throw err;
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

// GET /api/jv  — paginated, searchable, filterable, sortable listings
router.get('/jv', wrap(async (req, res) => {
  const ds = await getDataset(req.query.sheet);
  res.json({ ...queryRecords(ds, queryOpts(req.query)), sync: syncStatus() });
}));

router.get('/jv/metadata', wrap(async (req, res) => {
  const wb = await getWorkbook();
  const ds = await getDataset(req.query.sheet);
  res.json({ ...metadata(ds), tabs: wb.order, spreadsheetTitle: wb.title, phoneCountryCode: config.phoneCountryCode, sync: syncStatus() });
}));

router.get('/jv/stats', wrap(async (req, res) => {
  res.json({ ...stats(await getDataset(req.query.sheet)), sync: syncStatus() });
}));

router.get('/jv/quality', wrap(async (req, res) => {
  res.json(quality(await getDataset(req.query.sheet)));
}));

router.get('/jv/contacts', wrap(async (req, res) => {
  const list = contacts(await getDataset(req.query.sheet));
  if (!list) return res.status(404).json({ error: 'This worksheet has no contact/phone column.' });
  res.json({ items: list });
}));

// CSV export of the current (filtered/sorted) view, exactly as stored in the sheet.
router.get('/jv/export', wrap(async (req, res) => {
  const ds = await getDataset(req.query.sheet);
  const opts = queryOpts(req.query);
  const list = sortRecords(ds, filterRecords(ds, opts), opts.sort, opts.dir);
  const csv = toCsv([['Sheet row', ...ds.columns.map((c) => c.label)], ...list.map((r) => [r.row, ...ds.columns.map((c) => r.values[c.key])])]);
  const name = `jv-listings-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('﻿' + csv);
}));

router.get('/jv/:id', wrap(async (req, res) => {
  const ds = await getDataset(req.query.sheet);
  const rec = ds.byId.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'JV listing not found. It may have been removed or renamed in the sheet.' });
  const ids = sortRecords(ds, ds.records, '', '').map((r) => r.id);
  const i = ids.indexOf(rec.id);
  res.json({
    record: publicRecord(rec),
    rowUrl: `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit#gid=${ds.tab.gid}&range=A${rec.row}`,
    prevId: ids[i - 1] || null,
    nextId: ids[i + 1] || null,
  });
}));

// POST /api/jv/refresh — forces a re-read from Google (admin only). Read-only towards the sheet.
router.post('/jv/refresh', requireRole('admin'), wrap(async (req, res) => {
  await getWorkbook({ force: true });
  const status = syncStatus();
  res.status(status.lastError ? 502 : 200).json(status);
}));

router.get('/source/status', wrap(async (req, res) => {
  try { await getWorkbook(); } catch { /* reported in status */ }
  res.json({
    ...syncStatus(),
    spreadsheetId: config.spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`,
    serviceAccountEmail: req.user.role === 'admin' ? serviceAccountEmail() : undefined,
  });
}));

export default router;
