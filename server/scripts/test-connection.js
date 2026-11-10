// Verifies the Google Sheet connection with the configured credentials.
// Usage: npm run test:connection
import { config } from '../src/config.js';
import { fetchWorkbook, resolveMode } from '../src/sheets/source.js';
import { buildDataset } from '../src/data/model.js';

console.log(`Spreadsheet: ${config.spreadsheetId}`);
console.log(`Mode:        ${resolveMode()}`);
try {
  const wb = await fetchWorkbook();
  console.log(`OK in ${wb.fetchMs}ms${wb.title ? ` — "${wb.title}"` : ''}`);
  for (const tab of wb.tabs) {
    const ds = buildDataset(tab, config.spreadsheetId);
    console.log(`  • ${tab.name} (gid ${tab.gid}): ${ds.records.length} records, ${ds.columns.length} columns, ${ds.blankRows.length} blank rows skipped`);
    console.log(`    headers: ${ds.columns.map((c) => c.label).join(' | ')}`);
  }
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  if (err.hint) console.error(`Hint:   ${err.hint}`);
  process.exit(1);
}
