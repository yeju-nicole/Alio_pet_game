import { Router } from 'express';
import { getPartnerApiKey } from '../db.js';
import { env } from '../config.js';
import { safeEqual } from '../auth.js';
import { issueCode, lookupCode, revokeCode } from '../codes.js';
import { consume } from '../ratelimit.js';
import { fail } from '../util.js';

/**
 * Server-to-server API for alio's website. See docs/INTEGRATION.ko.md.
 * Authenticate with `X-API-Key: <key>` (or `Authorization: Bearer <key>`).
 */
const r = Router();

r.use((req, res, next) => {
  const header = req.get('x-api-key') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!header || !safeEqual(header, getPartnerApiKey())) fail(401, 'Invalid API key', 'unauthorized');
  if (!consume('partner', 600, 60 * 1000)) fail(429, 'Too many requests', 'rate_limited');
  next();
});

function gameUrl(req) {
  return env.publicUrl || `${req.protocol}://${req.get('host')}`;
}

function withLink(req, code) {
  const base = gameUrl(req);
  const param = code.type === 'signup' ? 'code' : 'product';
  return { ...code, redeemUrl: `${base}/?${param}=${encodeURIComponent(code.code)}` };
}

/** Called by alio's website right after a member signs up. */
r.post('/signup-codes', (req, res) => {
  const { email, memberId } = req.body ?? {};
  const code = issueCode({ type: 'signup', email: email || null, ref: memberId ?? null, source: 'api' });
  res.status(code.reused ? 200 : 201).json(withLink(req, code));
});

/** Called by alio's store when an order is paid (one code per product). */
r.post('/product-codes', (req, res) => {
  const { orderId, email } = req.body ?? {};
  const code = issueCode({ type: 'product', email: email || null, ref: orderId ?? null, source: 'api' });
  res.status(code.reused ? 200 : 201).json(withLink(req, code));
});

r.get('/codes/:code', (req, res) => {
  const code = lookupCode(req.params.code);
  if (!code) fail(404, 'Code not found', 'not_found');
  res.json(code);
});

/** Revoke an unused code, e.g. when an order is refunded. */
r.delete('/codes/:code', (req, res) => {
  res.json(revokeCode(req.params.code));
});

export default r;
