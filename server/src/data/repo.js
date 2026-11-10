import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Persistence for JV listings. Document shape:
 *   { id, values: { [fieldKey]: string }, jvIdKey, createdAt, updatedAt, createdBy, updatedBy }
 * MongoDB is used when MONGODB_URI is set (required on Vercel); otherwise a local JSON file.
 */
export class StoreError extends Error {
  constructor(message, { status = 500, code = 'STORE_ERROR', hint } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

export const conflict = (msg) => new StoreError(msg, { status: 409, code: 'CONFLICT' });

// ---------- MongoDB ----------
function mongoRepo() {
  let colPromise;
  async function col() {
    if (!colPromise) {
      colPromise = (async () => {
        const { MongoClient } = await import('mongodb');
        // Reuse one client across serverless invocations.
        globalThis.__jvMongo ||= new MongoClient(config.mongoUri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 }).connect();
        const client = await globalThis.__jvMongo;
        const c = client.db(config.mongoDb).collection('listings');
        await c.createIndex({ jvIdKey: 1 }, { unique: true, partialFilterExpression: { jvIdKey: { $type: 'string' } } });
        return c;
      })().catch((err) => {
        colPromise = undefined;
        globalThis.__jvMongo = undefined;
        throw new StoreError(`Cannot connect to the database: ${err.message}`, { status: 503, code: 'DB_UNAVAILABLE', hint: 'Check MONGODB_URI and that the MongoDB Atlas network access list allows this server (0.0.0.0/0 for Vercel).' });
      });
    }
    return colPromise;
  }
  const toDoc = ({ _id, ...rest }) => ({ id: _id, ...rest });
  const dup = (err) => err?.code === 11000;
  return {
    kind: 'mongodb',
    async all() { return (await (await col()).find({}).toArray()).map(toDoc); },
    async insertMany(docs) {
      if (!docs.length) return;
      try { await (await col()).insertMany(docs.map(({ id, ...d }) => ({ _id: id, ...d })), { ordered: true }); } catch (e) { if (dup(e)) throw conflict('A listing with this JV ID already exists.'); throw e; }
    },
    async update(id, doc, expectedUpdatedAt) {
      const filter = { _id: id, ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) };
      const { id: _ignored, ...set } = doc;
      try {
        const r = await (await col()).updateOne(filter, { $set: set });
        return r.matchedCount === 1;
      } catch (e) { if (dup(e)) throw conflict('A listing with this JV ID already exists.'); throw e; }
    },
    async remove(id) { return (await (await col()).deleteOne({ _id: id })).deletedCount === 1; },
  };
}

// ---------- Local JSON file (development / single server) ----------
function fileRepo() {
  const file = path.join(config.dataDir, 'listings.json');
  let queue = Promise.resolve();
  const read = async () => {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  };
  const write = async (docs) => {
    await fs.mkdir(config.dataDir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(docs, null, 2));
    await fs.rename(tmp, file); // atomic replace
  };
  // Serialise writes so concurrent requests can't clobber each other.
  const locked = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
  const unique = (docs) => {
    const seen = new Set();
    for (const d of docs) { if (d.jvIdKey && seen.has(d.jvIdKey)) throw conflict('A listing with this JV ID already exists.'); seen.add(d.jvIdKey); }
  };
  return {
    kind: 'file',
    all: () => read(),
    insertMany: (docs) => locked(async () => { const all = [...(await read()), ...docs]; unique(all); await write(all); }),
    update: (id, doc, expectedUpdatedAt) => locked(async () => {
      const all = await read();
      const i = all.findIndex((d) => d.id === id && (!expectedUpdatedAt || d.updatedAt === expectedUpdatedAt));
      if (i < 0) return false;
      all[i] = { ...all[i], ...doc, id };
      unique(all);
      await write(all);
      return true;
    }),
    remove: (id) => locked(async () => {
      const all = await read();
      const next = all.filter((d) => d.id !== id);
      if (next.length === all.length) return false;
      await write(next);
      return true;
    }),
  };
}

function unconfiguredRepo() {
  const fail = async () => {
    throw new StoreError('No database is configured.', { status: 503, code: 'DB_NOT_CONFIGURED', hint: 'Set MONGODB_URI in the Vercel project (Settings → Environment Variables), then redeploy.' });
  };
  return { kind: 'none', all: fail, insertMany: fail, update: fail, remove: fail };
}

// Vercel's filesystem is ephemeral, so a database is mandatory there.
export const repo = config.mongoUri ? mongoRepo() : config.isVercel ? unconfiguredRepo() : fileRepo();
