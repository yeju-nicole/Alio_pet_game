import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { env, ROOT_DIR, IS_PROD } from './config.js';
import { loadUser } from './auth.js';
import { HttpError } from './util.js';
import playerRoutes from './routes/player.js';
import partnerRoutes from './routes/partner.js';
import adminRoutes from './routes/admin.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', /^\d+$/.test(env.trustProxy) ? Number(env.trustProxy) : env.trustProxy);

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'accelerometer=(self), gyroscope=(self), camera=(self), geolocation=(), microphone=()',
    });
    if (IS_PROD) {
      res.set('Content-Security-Policy', CSP);
      if (env.cookieSecure) res.set('Strict-Transport-Security', 'max-age=15552000');
    }
    next();
  });

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  // Partner API: authenticated by API key, called from alio's servers.
  app.use('/api/partner/v1', express.json({ limit: '32kb' }), partnerRoutes);

  // Browser APIs: reject cross-site writes (cookies are SameSite=Lax as well).
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.get('origin');
      if (origin) {
        let host;
        try {
          host = new URL(origin).host;
        } catch {
          host = '';
        }
        // Behind a proxy the Host header may be rewritten; browsers can't forge either header cross-site.
        const allowed = [req.get('host'), req.get('x-forwarded-host')].filter(Boolean);
        if (!allowed.includes(host)) return next(new HttpError(403, '잘못된 요청이에요', 'bad_origin'));
      }
    }
    res.set('Cache-Control', 'no-store');
    next();
  });

  const smallJson = express.json({ limit: '64kb' });
  // Photo uploads get a larger body limit on their own route.
  app.use('/api', (req, res, next) => (req.path === '/eco/mission' ? next() : smallJson(req, res, next)));
  app.use('/api', loadUser);
  app.use('/api/admin', adminRoutes);
  app.use('/api', playerRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: '없는 API예요', code: 'not_found' }));

  // Built front end (npm run build).
  const dist = path.join(ROOT_DIR, 'dist');
  if (fs.existsSync(dist)) {
    app.use(
      express.static(dist, {
        index: false,
        setHeaders(res, file) {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
          else res.set('Cache-Control', 'no-cache');
        },
      }),
    );
    const page = (name) => (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, name));
    app.get(['/admin', '/admin/{*rest}'], page('admin.html'));
    app.get('/{*rest}', page('index.html'));
  } else {
    app.get('/', (req, res) => res.type('text').send('Front end not built yet. Run `npm run build`, or use `npm run dev`.'));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: '사진 용량이 너무 커요', code: 'too_large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: '잘못된 요청이에요', code: 'bad_json' });
    console.error(err);
    res.status(500).json({ error: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요', code: 'server_error' });
  });

  return app;
}
