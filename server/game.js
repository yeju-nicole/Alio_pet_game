import crypto from 'node:crypto';
import { getDb, tx, getSettings } from './db.js';
import { DAY_MS, HOUR_MS, env } from './config.js';
import { ITEM_MAP, STARTER_PACK, PET_COLORS, MILESTONES } from './catalog.js';
import { clamp, dayKey, calendarDaysBetween, fail } from './util.js';

/** Points lost per hour while the pet is at home. */
const DECAY = { fullness: 4, cleanliness: 2, happiness: 3, energy: 2.5 };
const STATS = Object.keys(DECAY);

export const CARE_KINDS = ['walk', 'feed', 'wash', 'play', 'sleep'];

/** Fastest believable walking cadence (steps per second) used to reject faked walks. */
const MAX_CADENCE = 3.2;
/** A sleeping pet expects a heartbeat from the foreground page at least this often. */
const SLEEP_PING_GAP_MS = 150 * 1000;
const SESSION_MAX_AGE_MS = 6 * HOUR_MS;

// ---------------------------------------------------------------- wallet

export function addPoints(userId, amount, kind, memo) {
  const db = getDb();
  const row = db.prepare('UPDATE users SET points = points + ? WHERE id = ? RETURNING points').get(amount, userId);
  db.prepare(
    'INSERT INTO transactions (user_id, amount, balance_after, kind, memo, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(userId, amount, row.points, kind, memo, Date.now());
  return row.points;
}

export function spendPoints(userId, cost, kind, memo) {
  const { points } = getDb().prepare('SELECT points FROM users WHERE id = ?').get(userId);
  if (points < cost) fail(400, `포인트가 부족해요. ${(cost - points).toLocaleString()}P가 더 필요해요`, 'insufficient_points');
  return addPoints(userId, -cost, kind, memo);
}

// ---------------------------------------------------------------- inventory

export function getInventory(userId) {
  const rows = getDb().prepare('SELECT item_id, qty FROM inventory WHERE user_id = ? AND qty > 0').all(userId);
  return Object.fromEntries(rows.map((r) => [r.item_id, r.qty]));
}

export function addItem(userId, itemId, qty) {
  getDb()
    .prepare(
      `INSERT INTO inventory (user_id, item_id, qty) VALUES (?, ?, ?)
       ON CONFLICT(user_id, item_id) DO UPDATE SET qty = qty + excluded.qty`,
    )
    .run(userId, itemId, qty);
}

function takeItem(userId, itemId) {
  const res = getDb()
    .prepare('UPDATE inventory SET qty = qty - 1 WHERE user_id = ? AND item_id = ? AND qty > 0')
    .run(userId, itemId);
  if (res.changes === 0) fail(400, '가방에 그 아이템이 없어요', 'item_missing');
}

function ownsItem(userId, itemId) {
  const row = getDb().prepare('SELECT qty FROM inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
  return Boolean(row && row.qty > 0);
}

// ---------------------------------------------------------------- pets

function rowToPet(row) {
  if (!row) return null;
  return { ...row, equipped: JSON.parse(row.equipped), milestones: JSON.parse(row.milestones) };
}

function savePet(p) {
  getDb()
    .prepare(
      `UPDATE pets SET status = ?, fullness = ?, cleanliness = ?, happiness = ?, energy = ?, stats_at = ?,
       last_care_at = ?, hospitalized_at = ?, died_at = ?, equipped = ?, milestones = ? WHERE id = ?`,
    )
    .run(
      p.status,
      p.fullness,
      p.cleanliness,
      p.happiness,
      p.energy,
      p.stats_at,
      p.last_care_at,
      p.hospitalized_at,
      p.died_at,
      JSON.stringify(p.equipped),
      JSON.stringify(p.milestones),
      p.id,
    );
}

/** The living pet if there is one, otherwise the most recently deceased pet. */
function loadPet(userId) {
  return rowToPet(
    getDb()
      .prepare(`SELECT * FROM pets WHERE user_id = ? ORDER BY (status != 'dead') DESC, id DESC LIMIT 1`)
      .get(userId),
  );
}

/**
 * Brings a pet up to date: applies stat decay and moves it to the hospital
 * or the rainbow bridge when it has been neglected for too long.
 */
export function syncPet(pet, settings, now = Date.now()) {
  if (!pet || pet.status === 'dead') return pet;
  const hospitalAt = pet.last_care_at + settings.hospitalAfterDays * DAY_MS;
  const deathAt = pet.last_care_at + settings.deathAfterDays * DAY_MS;
  let changed = false;

  if (pet.status === 'alive') {
    const until = Math.min(now, hospitalAt);
    const hours = (until - pet.stats_at) / HOUR_MS;
    if (hours > 0) {
      for (const s of STATS) pet[s] = clamp(pet[s] - DECAY[s] * hours);
      pet.stats_at = until;
      changed = true;
    }
    if (now >= hospitalAt) {
      pet.status = 'hospital';
      pet.hospitalized_at = hospitalAt;
      changed = true;
    }
  }
  if (pet.status === 'hospital' && now >= deathAt) {
    pet.status = 'dead';
    pet.died_at = deathAt;
    changed = true;
  }
  if (changed) savePet(pet);
  return pet;
}

function moodOf(p) {
  if (p.status === 'dead') return 'angel';
  if (p.status === 'hospital') return 'sick';
  if (p.energy < 20) return 'sleepy';
  if (p.fullness < 25) return 'hungry';
  if (p.cleanliness < 25) return 'dirty';
  if (p.happiness < 25) return 'sad';
  const avg = STATS.reduce((a, s) => a + p[s], 0) / STATS.length;
  return avg >= 70 ? 'happy' : 'normal';
}

function daysTogether(pet, tz, now) {
  const end = pet.status === 'dead' ? pet.died_at : now;
  return Math.max(1, calendarDaysBetween(pet.adopted_at, end, tz) + 1);
}

function serializePet(pet, user, settings, now) {
  const day = daysTogether(pet, user.timezone, now);
  const next = MILESTONES.find((m) => m.day > day) ?? null;
  const prevDay = [...MILESTONES].reverse().find((m) => m.day <= day)?.day ?? 0;
  return {
    id: pet.id,
    species: pet.species,
    color: pet.color,
    name: pet.name,
    status: pet.status,
    mood: moodOf(pet),
    stats: Object.fromEntries(STATS.map((s) => [s, Math.round(pet[s])])),
    equipped: pet.equipped,
    day,
    adoptedAt: pet.adopted_at,
    lastCareAt: pet.last_care_at,
    hospitalAt: pet.last_care_at + settings.hospitalAfterDays * DAY_MS,
    deathAt: pet.last_care_at + settings.deathAfterDays * DAY_MS,
    diedAt: pet.died_at,
    nextMilestone: next && { ...next, fromDay: prevDay },
  };
}

/** Grants any day-count milestone rewards the pet has reached. */
function claimMilestones(pet, user, now) {
  if (pet.status !== 'alive') return [];
  const day = daysTogether(pet, user.timezone, now);
  const won = MILESTONES.filter((m) => m.day <= day && !pet.milestones.includes(m.day));
  for (const m of won) {
    pet.milestones.push(m.day);
    addPoints(user.id, m.reward, 'milestone', `${pet.name}와(과) ${m.title} 기념 선물`);
  }
  if (won.length) savePet(pet);
  return won.map((m) => ({ type: 'milestone', ...m, petName: pet.name }));
}

// ---------------------------------------------------------------- daily limits

function todayKey(user, now = Date.now()) {
  return dayKey(now, user.timezone);
}

function countsToday(userId, key) {
  const rows = getDb()
    .prepare('SELECT kind, COUNT(*) AS n FROM actions WHERE user_id = ? AND day_key = ? GROUP BY kind')
    .all(userId, key);
  return Object.fromEntries(rows.map((r) => [r.kind, r.n]));
}

function countToday(userId, kind, key) {
  return getDb().prepare('SELECT COUNT(*) AS n FROM actions WHERE user_id = ? AND day_key = ? AND kind = ?').get(userId, key, kind).n;
}

export function recordAction(user, petId, kind, points, meta = null, now = Date.now()) {
  getDb()
    .prepare('INSERT INTO actions (user_id, pet_id, kind, day_key, points, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(user.id, petId, kind, todayKey(user, now), points, meta && JSON.stringify(meta), now);
}

function assertUnderLimit(user, kind, limit, label) {
  if (countToday(user.id, kind, todayKey(user)) >= limit) {
    fail(429, `오늘의 ${label}은(는) 모두 완료했어요. 내일 또 만나요!`, 'daily_limit');
  }
}

function lastFeedAt(userId) {
  return getDb().prepare("SELECT MAX(created_at) AS t FROM actions WHERE user_id = ? AND kind = 'feed'").get(userId).t;
}

// ---------------------------------------------------------------- state

function freshUser(userId) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function publicSettings(settings) {
  return { ...settings, aiVerification: Boolean(env.anthropicApiKey) };
}

export function getState(userId) {
  return tx(() => {
    const now = Date.now();
    const settings = getSettings();
    const user = freshUser(userId);
    const pet = syncPet(loadPet(userId), settings, now);
    const celebrations = pet ? claimMilestones(pet, user, now) : [];
    const after = celebrations.length ? freshUser(userId) : user;
    const key = todayKey(user, now);
    const counts = countsToday(userId, key);
    const lastFeed = lastFeedAt(userId);
    const missions = Object.keys(counts)
      .filter((k) => k.startsWith('mission:'))
      .map((k) => k.slice(8));

    return {
      user: {
        id: after.id,
        email: after.email,
        nickname: after.nickname,
        points: after.points,
        adoptionTickets: after.adoption_tickets,
        signupBonusClaimed: Boolean(after.signup_bonus_claimed),
        timezone: after.timezone,
        createdAt: after.created_at,
      },
      pet: pet && serializePet(pet, after, settings, now),
      inventory: getInventory(userId),
      today: {
        dayKey: key,
        counts: Object.fromEntries(CARE_KINDS.map((k) => [k, counts[k] ?? 0])),
        nextFeedAt: lastFeed ? lastFeed + settings.feedCooldownMinutes * 60000 : 0,
        quizDone: Boolean(counts.quiz),
        missionsDone: missions,
      },
      settings: publicSettings(settings),
      celebrations,
      serverTime: now,
    };
  });
}

// ---------------------------------------------------------------- guards

function activePet(user, settings) {
  const pet = syncPet(loadPet(user.id), settings);
  if (!pet) fail(400, '먼저 반려동물을 입양해 주세요', 'no_pet');
  return pet;
}

function alivePet(user, settings) {
  const pet = activePet(user, settings);
  if (pet.status === 'hospital') fail(409, `${pet.name}이(가) 병원에 입원해 있어요. 먼저 치료해 주세요`, 'pet_in_hospital');
  if (pet.status === 'dead') fail(409, `${pet.name}은(는) 무지개다리를 건넜어요`, 'pet_dead');
  return pet;
}

/** Eco missions stay open while the pet is in hospital so the user can earn the bill. */
export function assertNotLocked(user) {
  const pet = syncPet(loadPet(user.id), getSettings());
  if (pet?.status === 'dead') fail(409, '새 친구를 입양하면 다시 이용할 수 있어요', 'pet_dead');
  return pet;
}

function applyEffects(pet, effects) {
  for (const [s, v] of Object.entries(effects)) {
    if (STATS.includes(s)) pet[s] = clamp(pet[s] + v);
  }
}

function careDone(user, pet, kind, reward, effects, meta, memo) {
  const now = Date.now();
  applyEffects(pet, effects);
  pet.last_care_at = now;
  pet.stats_at = now;
  savePet(pet);
  if (reward > 0) addPoints(user.id, reward, kind, memo);
  recordAction(user, pet.id, kind, reward, meta, now);
  return reward;
}

const result = (userId, reward, extra = {}) => ({ reward, ...extra, state: getState(userId) });

// ---------------------------------------------------------------- adopt

const NAME_RE = /^[\p{L}\p{N} ]{1,10}$/u;

export function adopt(user, { species, color, name }) {
  if (!PET_COLORS[species]) fail(400, '강아지 또는 고양이를 선택해 주세요', 'bad_species');
  if (!PET_COLORS[species].includes(color)) fail(400, '털 색을 선택해 주세요', 'bad_color');
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(clean)) fail(400, '이름은 한글·영문·숫자로 1~10자까지 가능해요', 'bad_name');

  return tx(() => {
    const settings = getSettings();
    const current = syncPet(loadPet(user.id), settings);
    if (current && current.status !== 'dead') fail(409, '이미 함께하는 친구가 있어요', 'has_pet');
    const u = freshUser(user.id);
    if (u.adoption_tickets < 1) fail(402, 'alio 제품 코드를 입력하면 새 친구를 입양할 수 있어요', 'needs_ticket');

    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO pets (user_id, species, color, name, stats_at, last_care_at, adopted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(user.id, species, color, clean, now, now, now);
    getDb().prepare('UPDATE users SET adoption_tickets = adoption_tickets - 1 WHERE id = ?').run(user.id);
    for (const { itemId, qty } of STARTER_PACK) addItem(user.id, itemId, qty);
    return result(user.id, 0);
  });
}

// ---------------------------------------------------------------- care actions

export function feed(user, { itemId }) {
  return tx(() => {
    const settings = getSettings();
    const pet = alivePet(user, settings);
    const item = ITEM_MAP.get(itemId);
    if (!item || item.category !== 'food') fail(400, '먹을 수 있는 아이템을 골라 주세요', 'bad_item');
    if (!ownsItem(user.id, item.id)) fail(400, '가방에 그 아이템이 없어요. 상점에서 사 주세요', 'item_missing');
    assertUnderLimit(user, 'feed', settings.feedDailyLimit, '밥 주기');
    const last = lastFeedAt(user.id);
    const readyAt = last ? last + settings.feedCooldownMinutes * 60000 : 0;
    if (readyAt > Date.now()) {
      const mins = Math.ceil((readyAt - Date.now()) / 60000);
      fail(429, `${pet.name}이(가) 아직 배불러요. ${mins}분 뒤에 다시 주세요`, 'cooldown');
    }
    takeItem(user.id, item.id);
    const effects = { ...item.effect };
    const loved = item.favorite === pet.species;
    if (loved) effects.happiness = (effects.happiness ?? 0) + 10;
    const reward = careDone(user, pet, 'feed', settings.feedReward, effects, { itemId: item.id }, `${pet.name}에게 ${item.name} 주기`);
    return result(user.id, reward, { loved });
  });
}

export function play(user, { itemId } = {}) {
  return tx(() => {
    const settings = getSettings();
    const pet = alivePet(user, settings);
    let toy = null;
    if (itemId) {
      toy = ITEM_MAP.get(itemId);
      if (!toy || toy.category !== 'toy') fail(400, '장난감을 골라 주세요', 'bad_item');
      if (!ownsItem(user.id, toy.id)) fail(400, '아직 없는 장난감이에요', 'item_missing');
    }
    assertUnderLimit(user, 'play', settings.playDailyLimit, '놀아주기');
    const loved = toy?.favorite === pet.species;
    const effects = { happiness: (toy?.happiness ?? 8) + (loved ? 8 : 0), energy: -6 };
    const reward = careDone(user, pet, 'play', settings.playReward, effects, { itemId: toy?.id ?? null }, `${pet.name}와(과) 놀아주기`);
    return result(user.id, reward, { loved });
  });
}

/** A typical pet bath uses ~40L; the mini game reports how much the player used. */
export const BATH_BASELINE_LITERS = 40;

export function wash(user, { waterUsed }) {
  return tx(() => {
    const settings = getSettings();
    const pet = alivePet(user, settings);
    assertUnderLimit(user, 'wash', settings.washDailyLimit, '목욕');
    const water = Math.round(clamp(Number(waterUsed) || BATH_BASELINE_LITERS, 1, 200));
    const reward = careDone(
      user,
      pet,
      'wash',
      settings.washReward,
      { cleanliness: 100, happiness: 5 },
      { water },
      `${pet.name} 목욕시키기`,
    );
    return result(user.id, reward, { water, saved: Math.max(0, BATH_BASELINE_LITERS - water) });
  });
}

// ---------------------------------------------------------------- timed activities

function startActivity(user, kind, target) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const db = getDb();
  db.prepare("UPDATE activity_sessions SET status = 'cancelled' WHERE user_id = ? AND kind = ? AND status = 'active'").run(user.id, kind);
  const pet = loadPet(user.id);
  db.prepare(
    'INSERT INTO activity_sessions (id, user_id, pet_id, kind, target, started_at, last_ping_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, user.id, pet.id, kind, target, now, now);
  return id;
}

function loadActivity(user, sessionId, kind) {
  const s = getDb().prepare('SELECT * FROM activity_sessions WHERE id = ? AND user_id = ? AND kind = ?').get(String(sessionId ?? ''), user.id, kind);
  if (!s || s.status !== 'active') fail(404, '진행 중인 활동이 없어요. 처음부터 다시 시작해 주세요', 'no_session');
  if (Date.now() - s.started_at > SESSION_MAX_AGE_MS) {
    endActivity(s.id, 'expired');
    fail(410, '시간이 너무 오래 지났어요. 다시 시작해 주세요', 'session_expired');
  }
  return s;
}

function endActivity(id, status) {
  getDb().prepare('UPDATE activity_sessions SET status = ?, completed_at = ? WHERE id = ?').run(status, Date.now(), id);
}

export function cancelActivity(user, { sessionId }) {
  getDb()
    .prepare("UPDATE activity_sessions SET status = 'cancelled', completed_at = ? WHERE id = ? AND user_id = ? AND status = 'active'")
    .run(Date.now(), String(sessionId ?? ''), user.id);
  return { ok: true };
}

export function walkStart(user) {
  return tx(() => {
    const settings = getSettings();
    alivePet(user, settings);
    assertUnderLimit(user, 'walk', settings.walkDailyLimit, '산책');
    const target = settings.walkSteps;
    const sessionId = startActivity(user, 'walk', target);
    return { sessionId, target, minSeconds: Math.ceil(target / MAX_CADENCE), demo: settings.demoMode };
  });
}

export function walkComplete(user, { sessionId, steps }) {
  return tx(() => {
    const settings = getSettings();
    const s = loadActivity(user, sessionId, 'walk');
    const pet = alivePet(user, settings);
    const counted = Math.floor(Number(steps) || 0);
    if (!settings.demoMode) {
      if (counted < s.target) fail(400, `아직 ${s.target - counted}보 남았어요`, 'not_enough_steps');
      const minMs = (s.target / MAX_CADENCE) * 1000;
      if (Date.now() - s.started_at < minMs) fail(400, '걸음이 너무 빨라요! 천천히 걸어 주세요', 'too_fast');
    }
    assertUnderLimit(user, 'walk', settings.walkDailyLimit, '산책');
    endActivity(s.id, 'completed');
    const walked = settings.demoMode ? Math.max(counted, s.target) : counted;
    const reward = careDone(
      user,
      pet,
      'walk',
      settings.walkReward,
      { happiness: 30, energy: -15, cleanliness: -10, fullness: -10 },
      { steps: walked, minutes: Math.round((Date.now() - s.started_at) / 60000) },
      `${pet.name}와(과) ${walked.toLocaleString()}보 산책`,
    );
    return result(user.id, reward, { steps: walked });
  });
}

export function sleepStart(user) {
  return tx(() => {
    const settings = getSettings();
    alivePet(user, settings);
    assertUnderLimit(user, 'sleep', settings.sleepDailyLimit, '재우기');
    const minutes = settings.sleepMinutes;
    const sessionId = startActivity(user, 'sleep', minutes);
    return { sessionId, minutes, pingSeconds: 45, demo: settings.demoMode };
  });
}

export function sleepPing(user, { sessionId }) {
  const s = loadActivity(user, sessionId, 'sleep');
  const now = Date.now();
  if (now - s.last_ping_at > SLEEP_PING_GAP_MS) {
    endActivity(s.id, 'failed');
    fail(409, '휴대폰을 사용해서 잠에서 깼어요', 'sleep_interrupted');
  }
  getDb().prepare('UPDATE activity_sessions SET last_ping_at = ? WHERE id = ?').run(now, s.id);
  return { ok: true, elapsed: now - s.started_at };
}

export function sleepComplete(user, { sessionId }) {
  return tx(() => {
    const settings = getSettings();
    const s = loadActivity(user, sessionId, 'sleep');
    const pet = alivePet(user, settings);
    const now = Date.now();
    if (!settings.demoMode) {
      if (now - s.last_ping_at > SLEEP_PING_GAP_MS) {
        endActivity(s.id, 'failed');
        fail(409, '휴대폰을 사용해서 잠에서 깼어요', 'sleep_interrupted');
      }
      if (now - s.started_at < s.target * 60000 - 3000) fail(400, '아직 자고 있어요. 조금만 더 기다려 주세요', 'too_early');
    }
    assertUnderLimit(user, 'sleep', settings.sleepDailyLimit, '재우기');
    endActivity(s.id, 'completed');
    const reward = careDone(
      user,
      pet,
      'sleep',
      settings.sleepReward,
      { energy: 60, happiness: 5 },
      { minutes: s.target },
      `${pet.name} 재우기 (휴대폰 ${s.target}분 쉬기)`,
    );
    return result(user.id, reward, { minutes: s.target });
  });
}

// ---------------------------------------------------------------- hospital

export function heal(user) {
  return tx(() => {
    const settings = getSettings();
    const pet = activePet(user, settings);
    if (pet.status !== 'hospital') fail(400, '치료가 필요하지 않아요', 'not_sick');
    spendPoints(user.id, settings.healCost, 'heal', `${pet.name} 병원 치료비`);
    const now = Date.now();
    for (const s of STATS) pet[s] = Math.max(pet[s], 60);
    pet.status = 'alive';
    pet.hospitalized_at = null;
    pet.last_care_at = now;
    pet.stats_at = now;
    savePet(pet);
    recordAction(user, pet.id, 'heal', -settings.healCost, null, now);
    return result(user.id, 0);
  });
}

// ---------------------------------------------------------------- shop & closet

export function buy(user, { itemId, qty }) {
  return tx(() => {
    assertNotLocked(user);
    const item = ITEM_MAP.get(itemId);
    if (!item) fail(404, '없는 상품이에요', 'bad_item');
    let n = 1;
    if (item.category === 'food') {
      n = Math.floor(Number(qty) || 1);
      if (n < 1 || n > 20) fail(400, '한 번에 1~20개까지 살 수 있어요', 'bad_qty');
    } else if (ownsItem(user.id, item.id)) {
      fail(409, '이미 가지고 있는 아이템이에요', 'owned');
    }
    spendPoints(user.id, item.price * n, 'shop', `${item.name}${n > 1 ? ` ×${n}` : ''} 구매`);
    addItem(user.id, item.id, n);
    return result(user.id, 0, { item: item.id, qty: n });
  });
}

const SLOTS = ['head', 'face', 'neck', 'body'];

export function equip(user, { slot, itemId }) {
  return tx(() => {
    if (!SLOTS.includes(slot)) fail(400, '잘못된 위치예요', 'bad_slot');
    const pet = activePet(user, getSettings());
    if (pet.status === 'dead') fail(409, '새 친구를 입양하면 다시 꾸밀 수 있어요', 'pet_dead');
    if (itemId) {
      const item = ITEM_MAP.get(itemId);
      if (!item || item.slot !== slot) fail(400, '그 자리에 입힐 수 없는 아이템이에요', 'bad_item');
      if (!ownsItem(user.id, item.id)) fail(400, '먼저 상점에서 구매해 주세요', 'item_missing');
      pet.equipped[slot] = item.id;
    } else {
      delete pet.equipped[slot];
    }
    savePet(pet);
    return result(user.id, 0);
  });
}

// ---------------------------------------------------------------- history & impact

export function getHistory(userId, limit = 50) {
  return getDb()
    .prepare('SELECT id, amount, balance_after AS balance, kind, memo, created_at AS at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, Math.min(200, Math.max(1, limit)));
}

/** Car emissions avoided per metre walked (≈ 210 g CO₂/km for a passenger car). */
const CO2_G_PER_M = 0.21;
const STEP_LENGTH_M = 0.7;

export function getImpact(userId) {
  const db = getDb();
  const agg = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'walk' THEN json_extract(meta, '$.steps') END), 0) AS steps,
         COALESCE(SUM(CASE WHEN kind = 'walk' THEN 1 END), 0) AS walks,
         COALESCE(SUM(CASE WHEN kind = 'sleep' THEN json_extract(meta, '$.minutes') END), 0) AS phoneFreeMinutes,
         COALESCE(SUM(CASE WHEN kind = 'wash' THEN MAX(0, ${BATH_BASELINE_LITERS} - json_extract(meta, '$.water')) END), 0) AS waterSaved,
         COALESCE(SUM(CASE WHEN kind LIKE 'mission:%' THEN 1 END), 0) AS missions,
         COALESCE(SUM(CASE WHEN kind = 'quiz' AND json_extract(meta, '$.correct') = 1 THEN 1 END), 0) AS quizCorrect
       FROM actions WHERE user_id = ?`,
    )
    .get(userId);
  const distanceM = agg.steps * STEP_LENGTH_M;
  return { ...agg, distanceKm: +(distanceM / 1000).toFixed(2), co2SavedG: Math.round(distanceM * CO2_G_PER_M) };
}
