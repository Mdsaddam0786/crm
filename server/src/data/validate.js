import { StoreError } from './repo.js';
import { FIELDS } from './fields.js';
import { normaliseSharing } from './model.js';

const badRequest = (msg) => new StoreError(msg, { status: 400, code: 'VALIDATION' });
const MAX_LEN = { notes: 5000 };

/** Validates and normalises submitted field values. Unknown keys are ignored. */
export function sanitize(input) {
  if (!input || typeof input !== 'object') throw badRequest('Missing listing values.');
  const values = {};
  for (const f of FIELDS) {
    let v = input[f.key];
    if (v == null) v = '';
    if (typeof v !== 'string' && typeof v !== 'number') throw badRequest(`${f.label} must be text.`);
    v = String(v).trim();
    if (!f.multiline) v = v.replace(/\s*\n\s*/g, ' ');
    if (v.length > (MAX_LEN[f.key] || 1000)) throw badRequest(`${f.label} is too long.`);
    if (f.key === 'sharing') v = normaliseSharing(v);
    if (f.type === 'url' && v && !/^https?:\/\/\S+$/i.test(v)) throw badRequest(`${f.label} must be a link starting with http:// or https://`);
    values[f.key] = v;
  }
  if (!values.jv_id) throw badRequest('JV ID is required.');
  if (values.jv_id.length > 60) throw badRequest('JV ID is too long.');
  return values;
}

