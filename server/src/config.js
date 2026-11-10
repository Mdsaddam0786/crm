import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return v;
}

/** APP_USERS format: username:role:bcryptHash;username2:role:bcryptHash */
function parseUsers(raw) {
  return (raw || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [username, role, ...hash] = entry.split(':');
      if (!username || !role || !hash.length) throw new Error(`Invalid APP_USERS entry for "${username || '?'}"`);
      if (!['admin', 'viewer'].includes(role)) throw new Error(`Invalid role "${role}" for user ${username}`);
      return { username: username.toLowerCase(), role, passwordHash: hash.join(':') };
    });
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: Number(process.env.PORT || 4000),
  sessionSecret: required('SESSION_SECRET'),
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  users: parseUsers(required('APP_USERS')),
  spreadsheetId: required('GOOGLE_SPREADSHEET_ID'),
  // auto | service_account | api_key | public_csv
  authMode: (process.env.GOOGLE_AUTH_MODE || 'auto').toLowerCase(),
  serviceAccountFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '',
  serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  apiKey: process.env.GOOGLE_API_KEY || '',
  primaryTab: process.env.GOOGLE_PRIMARY_TAB || '',
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 300),
  phoneCountryCode: (process.env.DEFAULT_PHONE_COUNTRY_CODE || '91').replace(/\D/g, ''),
  trustProxy: process.env.TRUST_PROXY === 'true',
};

if (config.sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
if (!config.users.length) throw new Error('APP_USERS must define at least one user.');
