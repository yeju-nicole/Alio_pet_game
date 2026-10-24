import crypto from 'node:crypto';
import { getDb, tx, getSettings } from './db.js';
import { DAY_MS } from './config.js';
import { addPoints } from './game.js';
import { fail, EMAIL_RE } from './util.js';

/**
 * Two kinds of codes:
 *  - signup:  5 digits, given by alio's website after a member signs up → 500P
 *  - product: 8 characters (XXXX-XXXX), packed with an alio product → 입양권 1장
 *
 * Product codes avoid look-alike characters (0/O, 1/I/L) because people type
 * them from a printed card.
 */
const PRODUCT_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomSignupCode() {
  return String(crypto.randomInt(10000, 100000));
}

function randomProductCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += PRODUCT_ALPHABET[crypto.randomInt(PRODUCT_ALPHABET.length)];
  return s;
}

export function normalizeCode(raw, type) {
  const s = String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (type === 'signup') return /^\d{5}$/.test(s) ? s : null;
  return /^[A-Z0-9]{8}$/.test(s) ? s : null;
}

export function formatCode(code, type) {
  return type === 'product' ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function expireStale() {
  getDb().prepare("UPDATE codes SET status = 'revoked' WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?").run(Date.now());
}

function activeSignupCount() {
  return getDb().prepare("SELECT COUNT(*) AS n FROM codes WHERE type = 'signup' AND status = 'active'").get().n;
}

/**
 * Issues one code. When `ref` (an alio member ID or order number) already has
 * an unused code, that code is returned instead, so retries from alio's
 * website never hand the same person two codes.
 */
export function issueCode({ type, email = null, ref = null, source, batch = null, validDays, idempotent = true }) {
  if (type !== 'signup' && type !== 'product') fail(400, 'type must be signup or product', 'bad_type');
  const settings = getSettings();
  const days = validDays ?? (type === 'signup' ? settings.signupCodeValidDays : settings.productCodeValidDays);
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  if (cleanEmail && !EMAIL_RE.test(cleanEmail)) fail(400, 'email is not valid', 'bad_email');
  const cleanRef = ref == null || ref === '' ? null : String(ref).slice(0, 120);

  return tx(() => {
    const db = getDb();
    expireStale();
    if (cleanRef && idempotent) {
      const existing = db
        .prepare("SELECT * FROM codes WHERE type = ? AND ref = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
        .get(type, cleanRef);
      if (existing) return { ...publicCode(existing), reused: true };
      if (type === 'signup') {
        const used = db.prepare("SELECT 1 FROM codes WHERE type = 'signup' AND ref = ? AND status = 'redeemed'").get(cleanRef);
        if (used) fail(409, 'This member has already redeemed a signup code', 'already_redeemed');
      }
    }
    // Keep the 5-digit space sparse so guessing a live code stays impractical.
    if (type === 'signup' && activeSignupCount() >= 20000) {
      fail(503, 'Too many unused signup codes are outstanding. Shorten signupCodeValidDays or revoke old codes.', 'code_space_full');
    }
    const now = Date.now();
    const insert = db.prepare(
      `INSERT INTO codes (code, type, bound_email, ref, source, batch, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = type === 'signup' ? randomSignupCode() : randomProductCode();
      try {
        const info = insert.run(code, type, cleanEmail, cleanRef, source, batch, now, days ? now + days * DAY_MS : null);
        return publicCode(db.prepare('SELECT * FROM codes WHERE id = ?').get(info.lastInsertRowid));
      } catch (e) {
        if (e.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw e;
      }
    }
    fail(503, 'Could not allocate a unique code, please retry', 'code_collision');
  });
}

export function issueBatch({ type, count, validDays, label }) {
  const n = Math.floor(Number(count));
  if (!(n >= 1 && n <= 5000)) fail(400, '한 번에 1~5,000개까지 만들 수 있어요', 'bad_count');
  const batch = `${type}-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;
  const ref = label ? String(label).slice(0, 60) : null;
  return tx(() => {
    const codes = [];
    for (let i = 0; i < n; i++) codes.push(issueCode({ type, source: 'admin', batch, validDays, ref, idempotent: false }));
    return { batch, codes };
  });
}

export function publicCode(row) {
  return {
    code: formatCode(row.code, row.type),
    type: row.type,
    status: row.status,
    email: row.bound_email,
    ref: row.ref,
    source: row.source,
    batch: row.batch,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at,
    redeemedBy: row.redeemed_by,
  };
}

export function lookupCode(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');
  const type = /^\d{5}$/.test(s) ? 'signup' : 'product';
  const row = getDb().prepare('SELECT * FROM codes WHERE code = ? AND type = ? ORDER BY id DESC LIMIT 1').get(s, type);
  return row ? publicCode(row) : null;
}

export function revokeCode(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');
  const res = getDb().prepare("UPDATE codes SET status = 'revoked' WHERE code = ? AND status = 'active'").run(s);
  if (!res.changes) fail(404, '사용 가능한 코드가 아니에요', 'not_found');
  return { ok: true };
}

/** Redeems a code for a game user. Throws an HttpError the UI can show as-is. */
export function redeemCode(user, raw, type) {
  const code = normalizeCode(raw, type);
  if (!code) {
    fail(400, type === 'signup' ? '5자리 숫자 코드를 입력해 주세요' : '8자리 제품 코드를 입력해 주세요 (예: AB12-CD34)', 'bad_format');
  }
  return tx(() => {
    const db = getDb();
    const now = Date.now();
    const row = db.prepare("SELECT * FROM codes WHERE code = ? AND type = ? AND status = 'active'").get(code, type);
    if (!row || (row.expires_at && row.expires_at < now)) {
      const used = db.prepare("SELECT 1 FROM codes WHERE code = ? AND type = ? AND status = 'redeemed'").get(code, type);
      fail(400, used ? '이미 사용된 코드예요' : '유효하지 않거나 만료된 코드예요', 'invalid_code');
    }
    if (row.bound_email && row.bound_email.toLowerCase() !== String(user.email).toLowerCase()) {
      fail(400, 'alio 회원가입에 사용한 이메일과 같은 이메일로 로그인해야 쓸 수 있는 코드예요', 'email_mismatch');
    }
    const settings = getSettings();
    if (type === 'signup') {
      const u = db.prepare('SELECT signup_bonus_claimed FROM users WHERE id = ?').get(user.id);
      if (u.signup_bonus_claimed) fail(409, '회원가입 보너스는 한 번만 받을 수 있어요', 'already_claimed');
      db.prepare('UPDATE users SET signup_bonus_claimed = 1 WHERE id = ?').run(user.id);
      addPoints(user.id, settings.signupCodeReward, 'signup_code', 'alio 회원가입 보너스');
    } else {
      db.prepare('UPDATE users SET adoption_tickets = adoption_tickets + 1 WHERE id = ?').run(user.id);
    }
    db.prepare("UPDATE codes SET status = 'redeemed', redeemed_at = ?, redeemed_by = ? WHERE id = ?").run(now, user.id, row.id);
    return type === 'signup' ? { points: settings.signupCodeReward } : { tickets: 1 };
  });
}
