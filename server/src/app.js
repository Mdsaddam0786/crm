import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config, configErrors } from './config.js';
import { verifyLogin, issueSession, clearSession, requireAuth } from './auth.js';
import jvRoutes from './routes/jv.js';

const app = express();
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      // Only force HTTPS in production; locally the app is opened over plain http (incl. via IP address).
      upgradeInsecureRequests: config.isProd ? [] : null,
    },
  },
  strictTransportSecurity: config.isProd,
}));
app.use(compression());
// CSV imports carry the whole file; everything else is small.
app.use('/api/jv/import', express.json({ limit: '4mb' }));
app.use(express.json({ limit: '40kb' }));
app.use(cookieParser());

// Private business data: never let browsers/proxies cache API responses.
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

app.get('/api/health', (req, res) => res.status(configErrors.length ? 500 : 200).json({ ok: !configErrors.length, configErrors }));

// Refuse to serve anything until the deployment is configured correctly.
app.use('/api', (req, res, next) => {
  if (!configErrors.length) return next();
  console.error('[config]', configErrors.join(' '));
  res.status(500).json({ error: `Server configuration error: ${configErrors.join(' ')} Fix the environment variables in Vercel and redeploy.`, code: 'CONFIG' });
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' } });

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const user = await verifyLogin(req.body?.username, req.body?.password);
  if (!user) return res.status(401).json({ error: 'Incorrect username or password.' });
  issueSession(res, user);
  res.json({ user });
});
app.post('/api/auth/logout', (req, res) => { clearSession(res); res.status(204).end(); });
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }), requireAuth, jvRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err.code || '', err.message);
  res.status(status).json({ error: status >= 500 && !err.code ? 'Internal server error' : err.message, code: err.code, hint: err.hint });
});

export default app;
