import 'dotenv/config';
import path from 'node:path';

export const ROLES = ['admin', 'editor', 'viewer'];

/**
 * Configuration problems are collected instead of thrown, so a misconfigured
 * deployment answers with a clear message rather than crashing on startup.
 * Messages name the variable only — never its value.
 */
export const configErrors = [];

function required(name) {
  const v = (process.env[name] || '').trim();
  if (!v) configErrors.push(`${name} is not set.`);
  return v;
}

/** APP_USERS format: username:role:bcryptHash;username2:role:bcryptHash */
function parseUsers(raw) {
  const users = [];
  // Tolerate values pasted with surrounding quotes or a leading "APP_USERS=".
  const cleaned = raw.replace(/^APP_USERS=/, '').replace(/^["']|["']$/g, '');
  for (const entry of cleaned.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [username, role, ...hash] = entry.split(':');
    if (!username || !role || !hash.length || !hash.join(':').startsWith('$2')) {
      configErrors.push(`APP_USERS entry for "${username || '?'}" is malformed (expected username:role:bcryptHash).`);
      continue;
    }
    if (!ROLES.includes(role)) {
      configErrors.push(`APP_USERS: invalid role "${role}" for ${username}.`);
      continue;
    }
    users.push({ username: username.toLowerCase(), role, passwordHash: hash.join(':') });
  }
  return users;
}

const isProd = process.env.NODE_ENV === 'production';
const sessionSecret = required('SESSION_SECRET').replace(/^SESSION_SECRET=/, '').replace(/^["']|["']$/g, '');
const usersRaw = required('APP_USERS');

export const config = {
  isProd,
  isVercel: !!process.env.VERCEL,
  port: Number(process.env.PORT || 4000),
  sessionSecret,
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  users: usersRaw ? parseUsers(usersRaw) : [],
  mongoUri: process.env.MONGODB_URI || '',
  mongoDb: process.env.MONGODB_DB || 'jv_crm',
  dataDir: path.resolve(process.env.DATA_DIR || 'data'),
  phoneCountryCode: (process.env.DEFAULT_PHONE_COUNTRY_CODE || '91').replace(/\D/g, ''),
  trustProxy: process.env.TRUST_PROXY === 'true',
};

if (sessionSecret && sessionSecret.length < 32) configErrors.push('SESSION_SECRET must be at least 32 characters.');
if (usersRaw && !config.users.length && !configErrors.some((e) => e.startsWith('APP_USERS'))) configErrors.push('APP_USERS defines no users.');
// Fallback keeps the module loadable; every API route is blocked while configErrors is non-empty.
if (!config.sessionSecret) config.sessionSecret = 'unconfigured';
