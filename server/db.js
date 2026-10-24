import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { env, SETTING_DEFAULTS, SETTING_LIMITS } from './config.js';
import { HttpError } from './util.js';

let db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  adoption_tickets INTEGER NOT NULL DEFAULT 1,
  signup_bonus_claimed INTEGER NOT NULL DEFAULT 0,
  marketing_agree INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS pets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species TEXT NOT NULL CHECK (species IN ('dog', 'cat')),
  color TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'hospital', 'dead')),
  fullness REAL NOT NULL DEFAULT 80,
  cleanliness REAL NOT NULL DEFAULT 80,
  happiness REAL NOT NULL DEFAULT 80,
  energy REAL NOT NULL DEFAULT 80,
  stats_at INTEGER NOT NULL,
  last_care_at INTEGER NOT NULL,
  hospitalized_at INTEGER,
  died_at INTEGER,
  adopted_at INTEGER NOT NULL,
  equipped TEXT NOT NULL DEFAULT '{}',
  milestones TEXT NOT NULL DEFAULT '[]'
);
CREATE UNIQUE INDEX IF NOT EXISTS pets_one_active ON pets(user_id) WHERE status != 'dead';

CREATE TABLE IF NOT EXISTS inventory (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  kind TEXT NOT NULL,
  memo TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_user ON transactions(user_id, id DESC);

CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id INTEGER,
  kind TEXT NOT NULL,
  day_key TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  meta TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS actions_user_day ON actions(user_id, day_key, kind);
CREATE INDEX IF NOT EXISTS actions_kind ON actions(kind, created_at);

CREATE TABLE IF NOT EXISTS activity_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('walk', 'sleep')),
  target INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  last_ping_at INTEGER,
  completed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS activity_user ON activity_sessions(user_id, status);

CREATE TABLE IF NOT EXISTS codes (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('signup', 'product')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'revoked')),
  bound_email TEXT COLLATE NOCASE,
  ref TEXT,
  source TEXT NOT NULL,
  batch TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  redeemed_at INTEGER,
  redeemed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS codes_active_unique ON codes(code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS codes_lookup ON codes(code, type);
CREATE INDEX IF NOT EXISTS codes_ref ON codes(type, ref);

CREATE TABLE IF NOT EXISTS photo_hashes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, hash)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function openDb(file) {
  const target = file ?? path.join(env.dataDir, 'mungnyang.db');
  if (target !== ':memory:') fs.mkdirSync(path.dirname(target), { recursive: true });
  db = new Database(target);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  ensurePartnerKey();
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not opened');
  return db;
}

export function tx(fn) {
  return getDb().transaction(fn)();
}

// ---------- settings ----------

function readRaw(key) {
  return getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
}

function writeRaw(key, value) {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

export function getSettings() {
  const rows = getDb().prepare("SELECT key, value FROM settings WHERE key LIKE 'game.%'").all();
  const out = { ...SETTING_DEFAULTS };
  for (const { key, value } of rows) {
    const name = key.slice(5);
    if (name in SETTING_DEFAULTS) {
      try {
        out[name] = JSON.parse(value);
      } catch {
        /* ignore corrupt override */
      }
    }
  }
  return out;
}

/** Validates and stores admin overrides. Returns the merged settings. */
export function updateSettings(patch) {
  const errors = [];
  const clean = {};
  for (const [name, raw] of Object.entries(patch ?? {})) {
    if (!(name in SETTING_DEFAULTS)) continue;
    const def = SETTING_DEFAULTS[name];
    let value = raw;
    if (typeof def === 'number') {
      value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`${name}: 0 이상의 숫자를 입력하세요`);
        continue;
      }
      value = Math.round(value);
      const lim = SETTING_LIMITS[name];
      if (lim && (value < lim[0] || value > lim[1])) {
        errors.push(`${name}: ${lim[0]}~${lim[1]} 사이로 입력하세요`);
        continue;
      }
    } else if (typeof def === 'boolean') {
      value = raw === true || raw === 'true';
    } else {
      value = String(raw ?? '').trim().slice(0, 300);
      if (value && name.endsWith('Url') && !/^https?:\/\//i.test(value)) {
        errors.push(`${name}: http:// 또는 https:// 로 시작해야 합니다`);
        continue;
      }
    }
    clean[name] = value;
  }
  const merged = { ...getSettings(), ...clean };
  if (merged.deathAfterDays <= merged.hospitalAfterDays) {
    errors.push('deathAfterDays는 hospitalAfterDays보다 커야 합니다');
  }
  if (errors.length) {
    throw new HttpError(400, errors.join('\n'), 'bad_settings');
  }
  tx(() => {
    for (const [name, value] of Object.entries(clean)) writeRaw(`game.${name}`, JSON.stringify(value));
  });
  return getSettings();
}

// ---------- partner API key ----------

function ensurePartnerKey() {
  if (!readRaw('partner_api_key')) {
    writeRaw('partner_api_key', 'alio_' + crypto.randomBytes(24).toString('base64url'));
  }
}

/** The env var wins so the key can be rotated from the host's secret store. */
export function getPartnerApiKey() {
  return env.partnerApiKey || readRaw('partner_api_key');
}

export function rotatePartnerApiKey() {
  const key = 'alio_' + crypto.randomBytes(24).toString('base64url');
  writeRaw('partner_api_key', key);
  return key;
}
