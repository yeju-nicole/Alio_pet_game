import crypto from 'node:crypto';
import { Router } from 'express';
import { getDb, tx, getSettings, updateSettings, getPartnerApiKey, rotatePartnerApiKey } from '../db.js';
import { env, SETTING_DEFAULTS } from '../config.js';
import { safeEqual, createAdminSession, destroyAdminSession, requireAdmin, hashPassword } from '../auth.js';
import { issueBatch, publicCode, revokeCode, formatCode } from '../codes.js';
import { addPoints, spendPoints, getImpact, getHistory, syncPet } from '../game.js';
import { consume } from '../ratelimit.js';
import { fail, dayKey } from '../util.js';

const r = Router();

r.post('/login', (req, res) => {
  if (!consume(`admin-login:${req.ip}`, 10, 15 * 60 * 1000)) fail(429, '로그인 시도가 너무 많습니다. 15분 뒤 다시 시도하세요', 'rate_limited');
  if (!env.adminPassword) fail(503, 'ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다', 'admin_disabled');
  if (!safeEqual(String(req.body?.password ?? ''), env.adminPassword)) fail(401, '비밀번호가 올바르지 않습니다', 'bad_credentials');
  createAdminSession(res);
  res.json({ ok: true });
});

r.post('/logout', (req, res) => {
  destroyAdminSession(req, res);
  res.json({ ok: true });
});

r.use(requireAdmin);

r.get('/session', (req, res) => res.json({ ok: true, defaultPassword: env.adminPassword === 'admin1234' }));

// ---------------------------------------------------------------- overview

r.get('/overview', (req, res) => {
  const db = getDb();
  const now = Date.now();
  const settings = getSettings();
  // Bring neglected pets up to date so the hospital / rainbow bridge counts are current.
  const live = db.prepare("SELECT * FROM pets WHERE status != 'dead'").all();
  tx(() => {
    for (const row of live) syncPet({ ...row, equipped: JSON.parse(row.equipped), milestones: JSON.parse(row.milestones) }, settings, now);
  });

  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const since = (days) => now - days * 86400000;
  const pets = Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM pets GROUP BY status').all().map((r) => [r.status, r.n]));
  const codeStats = db.prepare('SELECT type, status, COUNT(*) n FROM codes GROUP BY type, status').all();
  const codes = { signup: { active: 0, redeemed: 0, revoked: 0 }, product: { active: 0, redeemed: 0, revoked: 0 } };
  for (const c of codeStats) codes[c.type][c.status] = c.n;

  const eco = one(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'walk' THEN json_extract(meta, '$.steps') END), 0) AS steps,
       COALESCE(SUM(kind = 'walk'), 0) AS walks,
       COALESCE(SUM(CASE WHEN kind = 'sleep' THEN json_extract(meta, '$.minutes') END), 0) AS phoneFreeMinutes,
       COALESCE(SUM(kind LIKE 'mission:%'), 0) AS missions,
       COALESCE(SUM(kind = 'quiz'), 0) AS quizzes,
       COALESCE(SUM(kind IN ('feed', 'wash', 'play')), 0) AS careActions
     FROM actions`,
  );
  const missionBreakdown = db
    .prepare("SELECT substr(kind, 9) AS id, COUNT(*) n FROM actions WHERE kind LIKE 'mission:%' GROUP BY kind ORDER BY n DESC")
    .all();

  // Last 14 days, bucketed by Korean calendar day.
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(dayKey(now - i * 86400000, 'Asia/Seoul'));
  const signupsByDay = Object.fromEntries(days.map((d) => [d, 0]));
  for (const { created_at } of db.prepare('SELECT created_at FROM users WHERE created_at >= ?').all(since(15))) {
    const k = dayKey(created_at, 'Asia/Seoul');
    if (k in signupsByDay) signupsByDay[k]++;
  }
  const actionsByDay = Object.fromEntries(days.map((d) => [d, 0]));
  for (const { day_key, n } of db.prepare('SELECT day_key, COUNT(*) n FROM actions WHERE created_at >= ? GROUP BY day_key').all(since(15))) {
    if (day_key in actionsByDay) actionsByDay[day_key] += n;
  }

  res.json({
    users: {
      total: one('SELECT COUNT(*) n FROM users').n,
      today: one('SELECT COUNT(*) n FROM users WHERE created_at >= ?', Date.parse(dayKey(now, 'Asia/Seoul') + 'T00:00:00+09:00')).n,
      active7d: one('SELECT COUNT(*) n FROM users WHERE last_seen_at >= ?', since(7)).n,
      marketing: one('SELECT COUNT(*) n FROM users WHERE marketing_agree = 1').n,
    },
    pets: { alive: pets.alive ?? 0, hospital: pets.hospital ?? 0, dead: pets.dead ?? 0 },
    codes,
    points: {
      circulating: one('SELECT COALESCE(SUM(points), 0) n FROM users').n,
      earned: one('SELECT COALESCE(SUM(amount), 0) n FROM transactions WHERE amount > 0').n,
      spent: -one('SELECT COALESCE(SUM(amount), 0) n FROM transactions WHERE amount < 0').n,
    },
    eco: {
      ...eco,
      distanceKm: +((eco.steps * 0.7) / 1000).toFixed(1),
      co2SavedKg: +((eco.steps * 0.7 * 0.21) / 1000).toFixed(2),
      missionBreakdown,
    },
    daily: days.map((d) => ({ day: d, signups: signupsByDay[d], actions: actionsByDay[d] })),
    demoMode: settings.demoMode,
    aiVerification: Boolean(env.anthropicApiKey),
  });
});

// ---------------------------------------------------------------- codes

function codeFilters(q) {
  const where = [];
  const args = [];
  if (q.type === 'signup' || q.type === 'product') {
    where.push('c.type = ?');
    args.push(q.type);
  }
  if (['active', 'redeemed', 'revoked'].includes(q.status)) {
    where.push('c.status = ?');
    args.push(q.status);
  }
  if (q.batch) {
    where.push('c.batch = ?');
    args.push(String(q.batch));
  }
  if (q.q) {
    const term = String(q.q).trim().toUpperCase().replace(/-/g, '');
    where.push('(c.code LIKE ? OR c.ref LIKE ? OR c.bound_email LIKE ? OR u.email LIKE ?)');
    args.push(`%${term}%`, `%${q.q}%`, `%${q.q}%`, `%${q.q}%`);
  }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
}

r.get('/codes', (req, res) => {
  const db = getDb();
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = 50;
  const { sql, args } = codeFilters(req.query);
  const total = db.prepare(`SELECT COUNT(*) n FROM codes c LEFT JOIN users u ON u.id = c.redeemed_by ${sql}`).get(...args).n;
  const rows = db
    .prepare(`SELECT c.*, u.email AS redeemer FROM codes c LEFT JOIN users u ON u.id = c.redeemed_by ${sql} ORDER BY c.id DESC LIMIT ? OFFSET ?`)
    .all(...args, size, (page - 1) * size);
  const batches = db
    .prepare("SELECT batch, type, MIN(ref) AS label, COUNT(*) n, SUM(status = 'redeemed') used, MIN(created_at) at FROM codes WHERE batch IS NOT NULL GROUP BY batch ORDER BY at DESC LIMIT 20")
    .all();
  res.json({ total, page, size, items: rows.map((r) => ({ ...publicCode(r), redeemer: r.redeemer })), batches });
});

r.post('/codes', (req, res) => {
  const { type, count, validDays, label } = req.body ?? {};
  if (type !== 'signup' && type !== 'product') fail(400, '코드 종류를 선택하세요', 'bad_type');
  const days = validDays === '' || validDays == null ? undefined : Math.max(0, Math.floor(Number(validDays)));
  res.status(201).json(issueBatch({ type, count, validDays: days, label }));
});

r.post('/codes/:code/revoke', (req, res) => res.json(revokeCode(req.params.code)));

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  // Neutralise spreadsheet formula injection as well as quoting.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

r.get('/codes.csv', (req, res) => {
  const { sql, args } = codeFilters(req.query);
  const rows = getDb()
    .prepare(`SELECT c.*, u.email AS redeemer FROM codes c LEFT JOIN users u ON u.id = c.redeemed_by ${sql} ORDER BY c.id ASC LIMIT 100000`)
    .all(...args);
  const iso = (t) => (t ? new Date(t).toISOString() : '');
  const lines = [['code', 'type', 'status', 'label_or_ref', 'bound_email', 'source', 'batch', 'created_at', 'expires_at', 'redeemed_at', 'redeemed_by'].join(',')];
  for (const r of rows) {
    lines.push(
      [formatCode(r.code, r.type), r.type, r.status, r.ref, r.bound_email, r.source, r.batch, iso(r.created_at), iso(r.expires_at), iso(r.redeemed_at), r.redeemer]
        .map(csvCell)
        .join(','),
    );
  }
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="alio-codes-${Date.now()}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});

// ---------------------------------------------------------------- members

r.get('/users', (req, res) => {
  const db = getDb();
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = 30;
  const q = String(req.query.q ?? '').trim();
  const where = q ? 'WHERE u.email LIKE ? OR u.nickname LIKE ?' : '';
  const args = q ? [`%${q}%`, `%${q}%`] : [];
  const total = db.prepare(`SELECT COUNT(*) n FROM users u ${where}`).get(...args).n;
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.nickname, u.points, u.adoption_tickets, u.signup_bonus_claimed, u.created_at, u.last_seen_at,
         p.name AS pet_name, p.species, p.status AS pet_status
       FROM users u
       LEFT JOIN pets p ON p.id = (SELECT id FROM pets WHERE user_id = u.id ORDER BY (status != 'dead') DESC, id DESC LIMIT 1)
       ${where} ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, size, (page - 1) * size);
  res.json({ total, page, size, items: rows });
});

function loadUserOr404(id) {
  const u = getDb()
    .prepare('SELECT id, email, nickname, points, adoption_tickets, signup_bonus_claimed, marketing_agree, timezone, created_at, last_seen_at FROM users WHERE id = ?')
    .get(Number(id));
  if (!u) fail(404, '회원을 찾을 수 없습니다', 'not_found');
  return u;
}

r.get('/users/:id', (req, res) => {
  const u = loadUserOr404(req.params.id);
  const pets = getDb()
    .prepare('SELECT id, species, color, name, status, adopted_at, last_care_at, died_at FROM pets WHERE user_id = ? ORDER BY id DESC')
    .all(u.id);
  res.json({ user: u, pets, impact: getImpact(u.id), history: getHistory(u.id, 30) });
});

r.post('/users/:id/grant', (req, res) => {
  const u = loadUserOr404(req.params.id);
  const amount = Math.trunc(Number(req.body?.amount));
  const reason = String(req.body?.reason ?? '').trim().slice(0, 60) || '고객센터 조정';
  if (!amount || Math.abs(amount) > 100000) fail(400, '-100,000 ~ 100,000 사이의 0이 아닌 값을 입력하세요', 'bad_amount');
  const balance = tx(() => (amount > 0 ? addPoints(u.id, amount, 'admin', reason) : spendPoints(u.id, -amount, 'admin', reason)));
  res.json({ ok: true, points: balance });
});

r.post('/users/:id/ticket', (req, res) => {
  const u = loadUserOr404(req.params.id);
  getDb().prepare('UPDATE users SET adoption_tickets = adoption_tickets + 1 WHERE id = ?').run(u.id);
  res.json({ ok: true, adoptionTickets: u.adoption_tickets + 1 });
});

r.post('/users/:id/reset-password', async (req, res) => {
  const u = loadUserOr404(req.params.id);
  const temp = 'alio' + crypto.randomInt(100000, 1000000) + crypto.randomBytes(2).toString('hex');
  const db = getDb();
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(temp), u.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  res.json({ ok: true, tempPassword: temp });
});

// ---------------------------------------------------------------- settings & integration

r.get('/settings', (req, res) => res.json({ settings: getSettings(), defaults: SETTING_DEFAULTS }));
r.put('/settings', (req, res) => res.json({ settings: updateSettings(req.body ?? {}), defaults: SETTING_DEFAULTS }));

r.get('/integration', (req, res) => {
  res.json({
    apiKey: getPartnerApiKey(),
    keyFromEnv: Boolean(env.partnerApiKey),
    baseUrl: env.publicUrl || `${req.protocol}://${req.get('host')}`,
    aiVerification: Boolean(env.anthropicApiKey),
  });
});

r.post('/integration/rotate', (req, res) => {
  if (env.partnerApiKey) fail(400, 'PARTNER_API_KEY 환경 변수로 설정된 키는 서버 설정에서 바꿔야 합니다', 'key_from_env');
  res.json({ apiKey: rotatePartnerApiKey() });
});

export default r;
