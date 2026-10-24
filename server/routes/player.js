import express, { Router } from 'express';
import { getDb } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  requireUser,
} from '../auth.js';
import * as game from '../game.js';
import { redeemCode } from '../codes.js';
import { getEcoToday, answerQuiz, submitMission } from '../eco.js';
import { ITEMS, MILESTONES } from '../catalog.js';
import { consume, hit, isLimited, resetLimit } from '../ratelimit.js';
import { fail, EMAIL_RE, isValidTimeZone } from '../util.js';

const r = Router();
const MIN = 60 * 1000;
// Compared against when the email is unknown so both paths take the same time.
const DUMMY_HASH = await hashPassword('timing-equaliser-0');

// ---------------------------------------------------------------- auth

r.post('/auth/signup', async (req, res) => {
  if (!consume(`signup:${req.ip}`, 10, 60 * MIN)) fail(429, '잠시 후 다시 시도해 주세요', 'rate_limited');
  const { email, password, nickname, agreeAge, agreeTerms, agreePrivacy, agreeMarketing, timezone } = req.body ?? {};
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  const cleanNick = String(nickname ?? '').trim().replace(/\s+/g, ' ');
  if (!EMAIL_RE.test(cleanEmail)) fail(400, '이메일 주소를 확인해 주세요', 'bad_email');
  if (typeof password !== 'string' || password.length < 8 || password.length > 64 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fail(400, '비밀번호는 영문과 숫자를 포함해 8자 이상이어야 해요', 'weak_password');
  }
  if (!/^[\p{L}\p{N}_ ]{1,12}$/u.test(cleanNick)) fail(400, '닉네임은 1~12자의 한글·영문·숫자로 입력해 주세요', 'bad_nickname');
  if (!agreeAge || !agreeTerms || !agreePrivacy) fail(400, '필수 약관에 동의해 주세요', 'terms_required');

  const db = getDb();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(cleanEmail)) fail(409, '이미 가입된 이메일이에요. 로그인해 주세요', 'email_taken');
  const hash = await hashPassword(password);
  const tz = isValidTimeZone(timezone) ? timezone : 'Asia/Seoul';
  let info;
  try {
    info = db
      .prepare(
        'INSERT INTO users (email, password_hash, nickname, timezone, marketing_agree, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(cleanEmail, hash, cleanNick, tz, agreeMarketing ? 1 : 0, Date.now());
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') fail(409, '이미 가입된 이메일이에요. 로그인해 주세요', 'email_taken');
    throw e;
  }
  createSession(res, info.lastInsertRowid);
  res.status(201).json(game.getState(info.lastInsertRowid));
});

r.post('/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const ipKey = `login-ip:${req.ip}`;
  const emailKey = `login-email:${email}`;
  if (isLimited(ipKey, 30, 15 * MIN) || isLimited(emailKey, 8, 15 * MIN)) {
    fail(429, '로그인 시도가 너무 많아요. 15분 뒤에 다시 시도해 주세요', 'rate_limited');
  }
  const user = getDb().prepare('SELECT id, password_hash, timezone FROM users WHERE email = ?').get(email);
  const ok = user ? await verifyPassword(password, user.password_hash) : await verifyPassword(password, DUMMY_HASH);
  if (!user || !ok) {
    hit(ipKey, 15 * MIN);
    hit(emailKey, 15 * MIN);
    fail(401, '이메일 또는 비밀번호가 맞지 않아요', 'bad_credentials');
  }
  resetLimit(emailKey);
  const tz = req.body?.timezone;
  if (isValidTimeZone(tz) && tz !== user.timezone) getDb().prepare('UPDATE users SET timezone = ? WHERE id = ?').run(tz, user.id);
  createSession(res, user.id);
  res.json(game.getState(user.id));
});

r.post('/auth/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- public

r.get('/catalog', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ items: ITEMS, milestones: MILESTONES });
});

// Signed-out visitors get `null` rather than a 401 so the app can show the login screen quietly.
r.get('/me', (req, res, next) => (req.user ? next() : res.json(null)));

// ---------------------------------------------------------------- game (signed in)

r.use(requireUser);

r.get('/me', (req, res) => res.json(game.getState(req.user.id)));

r.patch('/me', (req, res) => {
  const { nickname, timezone } = req.body ?? {};
  const db = getDb();
  if (nickname !== undefined) {
    const clean = String(nickname).trim().replace(/\s+/g, ' ');
    if (!/^[\p{L}\p{N}_ ]{1,12}$/u.test(clean)) fail(400, '닉네임은 1~12자의 한글·영문·숫자로 입력해 주세요', 'bad_nickname');
    db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(clean, req.user.id);
  }
  if (timezone !== undefined && isValidTimeZone(timezone)) {
    db.prepare('UPDATE users SET timezone = ? WHERE id = ?').run(timezone, req.user.id);
  }
  res.json(game.getState(req.user.id));
});

r.post('/me/password', async (req, res) => {
  const { current, next } = req.body ?? {};
  const row = getDb().prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!(await verifyPassword(String(current ?? ''), row.password_hash))) fail(400, '현재 비밀번호가 맞지 않아요', 'bad_credentials');
  if (typeof next !== 'string' || next.length < 8 || next.length > 64 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
    fail(400, '새 비밀번호는 영문과 숫자를 포함해 8자 이상이어야 해요', 'weak_password');
  }
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), req.user.id);
  res.json({ ok: true });
});

r.delete('/me', async (req, res) => {
  const row = getDb().prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!(await verifyPassword(String(req.body?.password ?? ''), row.password_hash))) fail(400, '비밀번호가 맞지 않아요', 'bad_credentials');
  getDb().prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  destroySession(req, res);
  res.json({ ok: true });
});

r.post('/pet/adopt', (req, res) => res.json(game.adopt(req.user, req.body ?? {})));
r.post('/pet/feed', (req, res) => res.json(game.feed(req.user, req.body ?? {})));
r.post('/pet/play', (req, res) => res.json(game.play(req.user, req.body ?? {})));
r.post('/pet/wash', (req, res) => res.json(game.wash(req.user, req.body ?? {})));
r.post('/pet/heal', (req, res) => res.json(game.heal(req.user)));
r.post('/pet/equip', (req, res) => res.json(game.equip(req.user, req.body ?? {})));

r.post('/pet/walk/start', (req, res) => res.json(game.walkStart(req.user)));
r.post('/pet/walk/complete', (req, res) => res.json(game.walkComplete(req.user, req.body ?? {})));
r.post('/pet/walk/cancel', (req, res) => res.json(game.cancelActivity(req.user, req.body ?? {})));
r.post('/pet/sleep/start', (req, res) => res.json(game.sleepStart(req.user)));
r.post('/pet/sleep/ping', (req, res) => res.json(game.sleepPing(req.user, req.body ?? {})));
r.post('/pet/sleep/complete', (req, res) => res.json(game.sleepComplete(req.user, req.body ?? {})));
r.post('/pet/sleep/cancel', (req, res) => res.json(game.cancelActivity(req.user, req.body ?? {})));

r.post('/shop/buy', (req, res) => res.json(game.buy(req.user, req.body ?? {})));

r.get('/wallet/history', (req, res) => res.json({ items: game.getHistory(req.user.id, Number(req.query.limit) || 50) }));
r.get('/impact', (req, res) => res.json(game.getImpact(req.user.id)));

/**
 * Code redemption. 5-digit codes are guessable in principle, so failures are
 * capped per account and per IP.
 */
function redeemRoute(type) {
  return (req, res) => {
    const userKey = `redeem-user:${req.user.id}`;
    const ipKey = `redeem-ip:${req.ip}`;
    if (isLimited(userKey, 5, 30 * MIN) || isLimited(ipKey, 20, 60 * MIN)) {
      fail(429, '코드 입력을 너무 많이 틀렸어요. 30분 뒤에 다시 시도해 주세요', 'rate_limited');
    }
    try {
      const out = redeemCode(req.user, req.body?.code, type);
      res.json({ ...out, state: game.getState(req.user.id) });
    } catch (e) {
      if (e.code === 'invalid_code' || e.code === 'email_mismatch') {
        hit(userKey, 30 * MIN);
        hit(ipKey, 60 * MIN);
      }
      throw e;
    }
  };
}
r.post('/codes/signup', redeemRoute('signup'));
r.post('/codes/product', redeemRoute('product'));

r.get('/eco/today', (req, res) => res.json(getEcoToday(req.user)));
r.post('/eco/quiz', (req, res) => res.json(answerQuiz(req.user, req.body ?? {})));
r.post('/eco/mission', express.json({ limit: '4mb' }), async (req, res) => {
  if (!consume(`mission:${req.user.id}`, 20, 60 * MIN)) fail(429, '잠시 후 다시 시도해 주세요', 'rate_limited');
  res.json(await submitMission(req.user, req.body ?? {}));
});

export default r;
