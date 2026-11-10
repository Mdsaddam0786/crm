// Imports a CSV file into the configured storage (local file, or MongoDB when MONGODB_URI is set).
// Usage: npm run import -- <file.csv> [--update] [--dry-run]
import fs from 'node:fs';
import { importCsv } from '../src/data/importer.js';
import { storageKind } from '../src/data/store.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: npm run import -- <file.csv> [--update] [--dry-run]');
  process.exit(1);
}
try {
  const r = await importCsv(fs.readFileSync(file, 'utf8'), { mode: args.includes('--update') ? 'update' : 'skip', dryRun: args.includes('--dry-run'), username: 'import-script' });
  console.log(`Storage: ${storageKind()}${r.dryRun ? ' (dry run — nothing saved)' : ''}`);
  console.log(`Created ${r.created}, updated ${r.updated}, skipped existing ${r.skipped}, blank rows ${r.blankRows}`);
  console.log('Columns:', r.mapping.map((m) => `${m.column} → ${m.field}`).join(', '));
  if (r.ignoredColumns.length) console.log('Ignored columns:', r.ignoredColumns.join(', '));
  if (r.emptyHeaderData) console.log('Warning: a column without a header contains data and was ignored.');
  for (const e of r.errors) console.log(`Line ${e.line}: ${e.message}`);
  process.exit(0);
} catch (err) {
  console.error(`Import failed: ${err.message}${err.hint ? `\n${err.hint}` : ''}`);
  process.exit(1);
}
