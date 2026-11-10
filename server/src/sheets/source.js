import fs from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
import { config } from '../config.js';
import { parseCsv } from './csv.js';

/** Thrown for access/permission problems so the UI can show actionable guidance. */
export class SourceError extends Error {
  constructor(message, { code = 'SOURCE_ERROR', status = 502, hint } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
}

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const TIMEOUT_MS = 20000;

export function resolveMode() {
  if (config.authMode !== 'auto') return config.authMode;
  if (config.serviceAccountFile || config.serviceAccountJson) return 'service_account';
  if (config.apiKey) return 'api_key';
  return 'public_csv';
}

async function http(url, init = {}) {
  try {
    return await fetch(url, { ...init, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new SourceError(`Could not reach Google: ${err.message}`, { code: 'NETWORK', hint: "Check the server's internet connection, then refresh." });
  }
}

async function apiError(res) {
  let msg = `${res.status} ${res.statusText}`;
  try { msg = (await res.json()).error?.message || msg; } catch { /* non-JSON body */ }
  if (res.status === 401) return new SourceError(`Google rejected the credentials: ${msg}`, { code: 'AUTH_EXPIRED', hint: 'Credentials are invalid or expired. Replace the service-account key or API key.' });
  if (res.status === 403) return new SourceError(`Google denied access: ${msg}`, { code: 'FORBIDDEN', hint: 'Share the spreadsheet (Viewer) with the service-account email and enable the Google Sheets API in the Cloud project.' });
  if (res.status === 404) return new SourceError('Spreadsheet not found.', { code: 'NOT_FOUND', hint: 'Check GOOGLE_SPREADSHEET_ID.' });
  if (res.status === 429) return new SourceError('Google API quota exceeded.', { code: 'RATE_LIMIT', status: 503, hint: 'Wait a minute and refresh again.' });
  return new SourceError(`Google Sheets API error: ${msg}`);
}

// ---- Sheets API v4 (service account or API key) ----
let authClient;

function loadServiceAccount() {
  if (config.serviceAccountJson) {
    try { return JSON.parse(config.serviceAccountJson); } catch { throw new SourceError('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.', { code: 'CONFIG' }); }
  }
  if (!fs.existsSync(config.serviceAccountFile)) throw new SourceError('Service-account key file not found (GOOGLE_SERVICE_ACCOUNT_FILE).', { code: 'CONFIG' });
  try { return JSON.parse(fs.readFileSync(config.serviceAccountFile, 'utf8')); } catch { throw new SourceError('Service-account key file is not valid JSON.', { code: 'CONFIG' }); }
}

async function bearerHeaders() {
  if (!authClient) authClient = new GoogleAuth({ credentials: loadServiceAccount(), scopes: [READONLY_SCOPE] });
  try {
    const client = await authClient.getClient();
    const { token } = await client.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  } catch (err) {
    authClient = undefined;
    throw new SourceError(`Service-account authentication failed: ${err.message}`, { code: 'AUTH_EXPIRED', hint: 'The key may be revoked/disabled, or the server clock is wrong. Generate a new key.' });
  }
}

/** Email the company must share the sheet with (service-account mode). */
export function serviceAccountEmail() {
  try { return loadServiceAccount().client_email || null; } catch { return null; }
}

async function fetchViaApi(mode) {
  const id = encodeURIComponent(config.spreadsheetId);
  const headers = mode === 'service_account' ? await bearerHeaders() : {};
  const key = mode === 'api_key' ? `&key=${encodeURIComponent(config.apiKey)}` : '';

  const metaRes = await http(`${SHEETS_API}/${id}?fields=properties.title,sheets.properties(sheetId,title,hidden,index)${key}`, { headers });
  if (!metaRes.ok) throw await apiError(metaRes);
  const meta = await metaRes.json();
  const sheets = (meta.sheets || []).map((s) => s.properties).sort((a, b) => a.index - b.index);
  if (!sheets.length) return { title: meta.properties?.title || null, tabs: [] };

  const ranges = sheets.map((s) => `ranges=${encodeURIComponent(`'${s.title.replace(/'/g, "''")}'`)}`).join('&');
  const valRes = await http(`${SHEETS_API}/${id}/values:batchGet?${ranges}&valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS${key}`, { headers });
  if (!valRes.ok) throw await apiError(valRes);
  const vals = await valRes.json();

  return {
    title: meta.properties?.title || null,
    tabs: sheets.map((s, i) => ({ name: s.title, gid: s.sheetId, hidden: !!s.hidden, rows: vals.valueRanges?.[i]?.values || [] })),
  };
}

// ---- Public "anyone with the link can view" CSV export (no credentials) ----
async function discoverPublicTabs() {
  const res = await http(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.spreadsheetId)}/htmlview`);
  if (!res.ok) return { tabs: [{ name: 'Sheet1', gid: 0 }], title: null };
  const html = await res.text();
  const tabs = [];
  const re = /\{name: "((?:[^"\\]|\\.)*)", pageUrl: "[^"]*?gid=(\d+)/g;
  let m;
  while ((m = re.exec(html))) {
    let name = m[1];
    try { name = JSON.parse(`"${m[1]}"`); } catch { /* keep raw */ }
    if (!tabs.some((t) => t.gid === Number(m[2]))) tabs.push({ name, gid: Number(m[2]) });
  }
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/ - Google (Sheets|Drive)$/, '').trim() || null;
  return { tabs: tabs.length ? tabs : [{ name: 'Sheet1', gid: 0 }], title };
}

async function fetchPublicCsv() {
  const { tabs, title } = await discoverPublicTabs();
  const out = [];
  for (const tab of tabs) {
    const res = await http(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.spreadsheetId)}/export?format=csv&gid=${tab.gid}`);
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.includes('text/csv')) {
      throw new SourceError('The spreadsheet is not publicly readable (link sharing is off or restricted).', {
        code: 'FORBIDDEN',
        hint: 'Configure a service account (recommended): set GOOGLE_SERVICE_ACCOUNT_FILE and share the sheet with the service-account email as Viewer.',
      });
    }
    out.push({ ...tab, hidden: false, rows: parseCsv(await res.text()) });
  }
  return { title: title && title !== 'Google Sheets' ? title : null, tabs: out };
}

/** Reads every tab of the spreadsheet. Strictly read-only: never writes to Google. */
export async function fetchWorkbook() {
  const mode = resolveMode();
  const started = Date.now();
  let wb;
  if (mode === 'service_account' || mode === 'api_key') wb = await fetchViaApi(mode);
  else if (mode === 'public_csv') wb = await fetchPublicCsv();
  else throw new SourceError(`Unknown GOOGLE_AUTH_MODE "${mode}".`, { code: 'CONFIG' });
  return { ...wb, mode, fetchMs: Date.now() - started };
}
