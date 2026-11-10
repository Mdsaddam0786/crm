import { repo } from './repo.js';
import { buildDataset } from './model.js';

/**
 * Short-lived in-memory cache of the dataset. Local writes invalidate it immediately;
 * the TTL bounds staleness when several serverless instances write to MongoDB.
 */
const TTL_MS = repo.kind === 'file' ? Infinity : 5000;
let cached = null;
let loadedAt = 0;
let inflight = null;

export async function getDataset() {
  if (cached && Date.now() - loadedAt < TTL_MS) return cached;
  inflight ||= repo.all()
    .then((docs) => { cached = buildDataset(docs); loadedAt = Date.now(); return cached; })
    .finally(() => { inflight = null; });
  return inflight;
}

export function invalidate() {
  cached = null;
}

export const storageKind = () => repo.kind;
