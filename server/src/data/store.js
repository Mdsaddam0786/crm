import { config } from '../config.js';
import { fetchWorkbook, SourceError } from '../sheets/source.js';
import { buildDataset } from './model.js';

/**
 * In-memory cache of the workbook. Google Sheets stays the single source of truth;
 * this cache only avoids hitting Google on every request. If a refresh fails we keep
 * serving the last good copy and surface the error (never silently).
 */
const state = {
  workbook: null, // { title, mode, fetchMs, datasets: Map<name, dataset>, order: [names] }
  syncedAt: null,
  lastError: null,
  lastAttemptAt: null,
  inflight: null,
};

async function load() {
  state.lastAttemptAt = new Date().toISOString();
  try {
    const wb = await fetchWorkbook();
    const datasets = new Map();
    for (const tab of wb.tabs) datasets.set(tab.name, buildDataset(tab, config.spreadsheetId));
    state.workbook = { title: wb.title, mode: wb.mode, fetchMs: wb.fetchMs, datasets, order: wb.tabs.map((t) => t.name) };
    state.syncedAt = new Date().toISOString();
    state.lastError = null;
    const counts = [...datasets.values()].map((d) => `${d.tab.name}=${d.records.length}`).join(', ');
    console.log(`[sync] ${wb.mode} ok in ${wb.fetchMs}ms (${counts})`);
  } catch (err) {
    state.lastError = { message: err.message, code: err.code || 'SOURCE_ERROR', hint: err.hint || null, at: state.lastAttemptAt };
    console.error(`[sync] failed: ${err.code || ''} ${err.message}`);
    if (!state.workbook) throw err;
  }
}

function isFresh() {
  return state.syncedAt && Date.now() - Date.parse(state.syncedAt) < config.cacheTtlSeconds * 1000;
}

export async function getWorkbook({ force = false } = {}) {
  if (!force && state.workbook && isFresh()) return state.workbook;
  // Don't hammer Google after a failure: retry at most every 30s unless forced.
  if (!force && state.workbook && state.lastError && Date.now() - Date.parse(state.lastAttemptAt) < 30000) return state.workbook;
  state.inflight ||= load().finally(() => { state.inflight = null; });
  await state.inflight;
  return state.workbook;
}

export async function getDataset(name) {
  const wb = await getWorkbook();
  const pick = name || config.primaryTab || wb.order.find((n) => wb.datasets.get(n).records.length) || wb.order[0];
  const ds = wb.datasets.get(pick);
  if (!ds) throw new SourceError(`Worksheet tab "${name}" not found.`, { code: 'TAB_NOT_FOUND', status: 404 });
  return ds;
}

export function syncStatus() {
  const wb = state.workbook;
  return {
    connected: !!wb,
    mode: wb?.mode || null,
    title: wb?.title || null,
    syncedAt: state.syncedAt,
    lastAttemptAt: state.lastAttemptAt,
    fetchMs: wb?.fetchMs || null,
    cacheTtlSeconds: config.cacheTtlSeconds,
    stale: !!wb && !isFresh(),
    lastError: state.lastError,
    tabs: wb ? wb.order.map((n) => { const d = wb.datasets.get(n); return { name: n, gid: d.tab.gid, hidden: d.tab.hidden, records: d.records.length, columns: d.columns.length }; }) : [],
  };
}
