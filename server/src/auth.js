import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

const COOKIE = 'jvcrm_session';
// Used to equalise timing when the username does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function verifyLogin(username, password) {
  const user = config.users.find((u) => u.username === String(username || '').trim().toLowerCase());
  const ok = await bcrypt.compare(String(password || ''), user ? user.passwordHash : DUMMY_HASH);
  return ok && user ? { username: user.username, role: user.role } : null;
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.username, role: user.role }, config.sessionSecret, { expiresIn: `${config.sessionHours}h` });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: config.isProd, maxAge: config.sessionHours * 3600 * 1000, path: '/' });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: config.isProd, path: '/' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not signed in', code: 'UNAUTHENTICATED' });
  try {
    const payload = jwt.verify(token, config.sessionSecret);
    // Users removed from APP_USERS lose access immediately.
    const user = config.users.find((u) => u.username === payload.sub);
    if (!user) throw new Error('unknown user');
    req.user = { username: user.username, role: user.role };
    next();
  } catch {
    clearSession(res);
    res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'UNAUTHENTICATED' });
  }
}

export function requireRole(role) {
  return (req, res, next) => (req.user?.role === role ? next() : res.status(403).json({ error: 'You do not have permission for this action.', code: 'FORBIDDEN' }));
}
