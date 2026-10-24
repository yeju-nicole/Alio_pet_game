import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { getDb } from './db.js';
import { env, DAY_MS } from './config.js';
import { parseCookies, fail } from './util.js';

const scrypt = promisify(crypto.scrypt);

export const SESSION_COOKIE = 'mn_session';
export const ADMIN_COOKIE = 'mn_admin';
const SESSION_DAYS = 30;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  getDb()
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, now, now + SESSION_DAYS * DAY_MS);
  res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_DAYS * DAY_MS));
}

export function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Attaches req.user when a valid session cookie is present. */
export function loadUser(req, res, next) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return next();
  const db = getDb();
  const now = Date.now();
  const row = db
    .prepare(
      `SELECT s.token_hash, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(sha256(token));
  if (!row || row.expires_at < now) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return next();
  }
  // Slide the session forward once it is past its halfway point.
  if (row.expires_at - now < (SESSION_DAYS / 2) * DAY_MS) {
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(now + SESSION_DAYS * DAY_MS, row.token_hash);
    res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_DAYS * DAY_MS));
  }
  if (!row.last_seen_at || now - row.last_seen_at > 5 * 60 * 1000) {
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now, row.id);
  }
  const { token_hash, expires_at, password_hash, ...user } = row;
  req.user = user;
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) fail(401, '로그인이 필요해요', 'auth_required');
  next();
}

// ---------- admin ----------

const adminTokens = new Map();
const ADMIN_TTL = 12 * 60 * 60 * 1000;

export function createAdminSession(res) {
  const token = crypto.randomBytes(32).toString('base64url');
  adminTokens.set(sha256(token), Date.now() + ADMIN_TTL);
  res.cookie(ADMIN_COOKIE, token, { ...cookieOptions(ADMIN_TTL), sameSite: 'strict' });
}

export function destroyAdminSession(req, res) {
  const token = parseCookies(req.headers.cookie)[ADMIN_COOKIE];
  if (token) adminTokens.delete(sha256(token));
  res.clearCookie(ADMIN_COOKIE, { path: '/' });
}

export function requireAdmin(req, res, next) {
  const token = parseCookies(req.headers.cookie)[ADMIN_COOKIE];
  const exp = token && adminTokens.get(sha256(token));
  if (!exp || exp < Date.now()) {
    if (token) adminTokens.delete(sha256(token));
    fail(401, '관리자 로그인이 필요합니다', 'admin_required');
  }
  next();
}
