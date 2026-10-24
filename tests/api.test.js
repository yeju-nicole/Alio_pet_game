import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getDb, getPartnerApiKey, updateSettings } from '../server/db.js';
import { createApp } from '../server/app.js';
import { resetAllLimits } from '../server/ratelimit.js';

const DAY = 86400000;
let server;
let base;

before(async () => {
  openDb(':memory:');
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

/** Minimal cookie-keeping client. */
function client() {
  let cookie = '';
  async function call(method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(';');
      const [name] = pair.split('=');
      const rest = cookie
        .split('; ')
        .filter((p) => p && !p.startsWith(name + '='));
      cookie = [...rest, pair].join('; ');
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }
  return {
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, b = {}, h) => call('POST', p, b, h),
    put: (p, b = {}, h) => call('PUT', p, b, h),
    del: (p, b, h) => call('DELETE', p, b, h),
  };
}

let n = 0;
async function newPlayer(adoptPet = true) {
  const c = client();
  const email = `user${++n}@test.kr`;
  const res = await c.post('/api/auth/signup', {
    email,
    password: 'pass1234',
    nickname: '테스터',
    agreeAge: true,
    agreeTerms: true,
    agreePrivacy: true,
    timezone: 'Asia/Seoul',
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  if (adoptPet) {
    const a = await c.post('/api/pet/adopt', { species: 'dog', color: 'cream', name: '초코' });
    assert.equal(a.status, 200, JSON.stringify(a.data));
  }
  const userId = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email).id;
  return { c, email, userId };
}

const petOf = (userId) => getDb().prepare("SELECT * FROM pets WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(userId);

test('signup validates input and requires consent', async () => {
  resetAllLimits();
  const c = client();
  let r = await c.post('/api/auth/signup', { email: 'bad', password: 'pass1234', nickname: 'a', agreeAge: 1, agreeTerms: 1, agreePrivacy: 1 });
  assert.equal(r.data.code, 'bad_email');
  r = await c.post('/api/auth/signup', { email: 'a@b.kr', password: 'short', nickname: 'a', agreeAge: 1, agreeTerms: 1, agreePrivacy: 1 });
  assert.equal(r.data.code, 'weak_password');
  r = await c.post('/api/auth/signup', { email: 'a@b.kr', password: 'pass1234', nickname: 'a' });
  assert.equal(r.data.code, 'terms_required');
  r = await c.get('/api/me');
  assert.equal(r.data, null);
  r = await c.get('/api/wallet/history');
  assert.equal(r.status, 401);
});

test('new player adopts a pet and gets the starter pack', async () => {
  const { c } = await newPlayer(false);
  let r = await c.get('/api/me');
  assert.equal(r.data.pet, null);
  assert.equal(r.data.user.adoptionTickets, 1);
  r = await c.post('/api/pet/adopt', { species: 'cat', color: 'blue', name: '나비' });
  assert.equal(r.data.code, 'bad_color');
  r = await c.post('/api/pet/adopt', { species: 'cat', color: 'cheese', name: '나비' });
  assert.equal(r.data.state.pet.name, '나비');
  assert.equal(r.data.state.pet.day, 1);
  assert.equal(r.data.state.inventory.kibble, 3);
  assert.equal(r.data.state.user.adoptionTickets, 0);
  r = await c.post('/api/pet/adopt', { species: 'dog', color: 'cream', name: '둘째' });
  assert.equal(r.data.code, 'has_pet');
});

test('login and logout', async () => {
  const { email } = await newPlayer(false);
  const c = client();
  let r = await c.post('/api/auth/login', { email, password: 'wrong999' });
  assert.equal(r.status, 401);
  r = await c.post('/api/auth/login', { email: email.toUpperCase(), password: 'pass1234' });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.email, email);
  await c.post('/api/auth/logout');
  r = await c.get('/api/me');
  assert.equal(r.data, null);
});

test('feeding, playing and washing earn points with limits', async () => {
  const { c } = await newPlayer();
  let r = await c.post('/api/pet/feed', { itemId: 'kibble' });
  assert.equal(r.data.reward, 100);
  assert.equal(r.data.state.user.points, 100);
  assert.equal(r.data.state.inventory.kibble, 2);
  r = await c.post('/api/pet/feed', { itemId: 'kibble' });
  assert.equal(r.data.code, 'cooldown');
  r = await c.post('/api/pet/feed', { itemId: 'chicken_jerky' });
  assert.equal(r.status, 400);

  r = await c.post('/api/pet/play', { itemId: 'sock_toy' });
  assert.equal(r.data.reward, 10);
  r = await c.post('/api/pet/play', { itemId: 'frisbee' });
  assert.equal(r.data.code, 'item_missing');

  r = await c.post('/api/pet/wash', { waterUsed: 25 });
  assert.equal(r.data.reward, 100);
  assert.equal(r.data.saved, 15);
  assert.equal(r.data.state.pet.stats.cleanliness, 100);
  await c.post('/api/pet/wash', { waterUsed: 25 });
  r = await c.post('/api/pet/wash', { waterUsed: 25 });
  assert.equal(r.data.code, 'daily_limit');
});

test('walks need real steps over a believable time', async () => {
  const { c } = await newPlayer();
  let r = await c.post('/api/pet/walk/start');
  assert.equal(r.data.target, 800);
  const { sessionId } = r.data;
  r = await c.post('/api/pet/walk/complete', { sessionId, steps: 500 });
  assert.equal(r.data.code, 'not_enough_steps');
  r = await c.post('/api/pet/walk/complete', { sessionId, steps: 800 });
  assert.equal(r.data.code, 'too_fast');
  getDb().prepare('UPDATE activity_sessions SET started_at = ? WHERE id = ?').run(Date.now() - 8 * 60000, sessionId);
  r = await c.post('/api/pet/walk/complete', { sessionId, steps: 812 });
  assert.equal(r.data.reward, 100);
  assert.equal(r.data.steps, 812);
  r = await c.post('/api/pet/walk/complete', { sessionId, steps: 812 });
  assert.equal(r.data.code, 'no_session');
  r = await c.get('/api/impact');
  assert.equal(r.data.steps, 812);
  assert.ok(r.data.co2SavedG > 100);
});

test('sleep needs the phone left alone for the full time', async () => {
  const { c } = await newPlayer();
  let r = await c.post('/api/pet/sleep/start');
  assert.equal(r.data.minutes, 10);
  const { sessionId } = r.data;
  r = await c.post('/api/pet/sleep/ping', { sessionId });
  assert.equal(r.data.ok, true);
  r = await c.post('/api/pet/sleep/complete', { sessionId });
  assert.equal(r.data.code, 'too_early');
  // Heartbeats stopped (user switched apps) → fails.
  getDb().prepare('UPDATE activity_sessions SET started_at = ?, last_ping_at = ? WHERE id = ?').run(Date.now() - 11 * 60000, Date.now() - 5 * 60000, sessionId);
  r = await c.post('/api/pet/sleep/complete', { sessionId });
  assert.equal(r.data.code, 'sleep_interrupted');

  r = await c.post('/api/pet/sleep/start');
  const s2 = r.data.sessionId;
  getDb().prepare('UPDATE activity_sessions SET started_at = ? WHERE id = ?').run(Date.now() - 10 * 60000 - 1000, s2);
  r = await c.post('/api/pet/sleep/complete', { sessionId: s2 });
  assert.equal(r.data.reward, 100);
  assert.equal(r.data.state.today.counts.sleep, 1);
});

test('shop purchases and dressing up', async () => {
  const { c, userId } = await newPlayer();
  let r = await c.post('/api/shop/buy', { itemId: 'ribbon' });
  assert.equal(r.data.code, 'insufficient_points');
  getDb().prepare('UPDATE users SET points = 1000 WHERE id = ?').run(userId);
  r = await c.post('/api/shop/buy', { itemId: 'ribbon' });
  assert.equal(r.data.state.user.points, 850);
  r = await c.post('/api/shop/buy', { itemId: 'ribbon' });
  assert.equal(r.data.code, 'owned');
  r = await c.post('/api/shop/buy', { itemId: 'kibble', qty: 3 });
  assert.equal(r.data.state.inventory.kibble, 6);
  r = await c.post('/api/pet/equip', { slot: 'face', itemId: 'ribbon' });
  assert.equal(r.data.code, 'bad_item');
  r = await c.post('/api/pet/equip', { slot: 'head', itemId: 'ribbon' });
  assert.deepEqual(r.data.state.pet.equipped, { head: 'ribbon' });
  r = await c.post('/api/pet/equip', { slot: 'head', itemId: null });
  assert.deepEqual(r.data.state.pet.equipped, {});
  r = await c.get('/api/wallet/history');
  assert.equal(r.data.items[0].memo, '기본 사료 ×3 구매');
});

test('alio signup codes: partner API issues, player redeems once', async () => {
  resetAllLimits();
  const partner = client();
  let r = await partner.post('/api/partner/v1/signup-codes', { memberId: 'm-1' });
  assert.equal(r.status, 401);
  const key = { 'x-api-key': getPartnerApiKey() };
  r = await partner.post('/api/partner/v1/signup-codes', { memberId: 'm-1' }, key);
  assert.equal(r.status, 201);
  assert.match(r.data.code, /^\d{5}$/);
  assert.match(r.data.redeemUrl, /\?code=\d{5}$/);
  const code = r.data.code;
  r = await partner.post('/api/partner/v1/signup-codes', { memberId: 'm-1' }, key);
  assert.equal(r.status, 200);
  assert.equal(r.data.code, code, 'retries for the same member return the same code');

  const { c } = await newPlayer();
  r = await c.post('/api/codes/signup', { code: '1234' });
  assert.equal(r.data.code, 'bad_format');
  r = await c.post('/api/codes/signup', { code });
  assert.equal(r.data.points, 500);
  assert.equal(r.data.state.user.points, 500);
  assert.equal(r.data.state.user.signupBonusClaimed, true);
  r = await c.post('/api/codes/signup', { code });
  assert.equal(r.data.code, 'invalid_code');
  assert.equal(r.data.error, '이미 사용된 코드예요');

  r = await partner.get(`/api/partner/v1/codes/${code}`, key);
  assert.equal(r.data.status, 'redeemed');
  r = await partner.post('/api/partner/v1/signup-codes', { memberId: 'm-1' }, key);
  assert.equal(r.data.code, 'already_redeemed');

  // A second code can't be stacked onto the same account.
  const second = (await partner.post('/api/partner/v1/signup-codes', { memberId: 'm-2' }, key)).data.code;
  r = await c.post('/api/codes/signup', { code: second });
  assert.equal(r.data.code, 'already_claimed');
});

test('email-bound codes and brute-force protection', async () => {
  resetAllLimits();
  const key = { 'x-api-key': getPartnerApiKey() };
  const partner = client();
  const bound = (await partner.post('/api/partner/v1/signup-codes', { email: 'someone@else.kr' }, key)).data.code;
  const { c } = await newPlayer();
  let r = await c.post('/api/codes/signup', { code: bound });
  assert.equal(r.data.code, 'email_mismatch');
  for (let i = 0; i < 5; i++) await c.post('/api/codes/signup', { code: String(10000 + i) });
  r = await c.post('/api/codes/signup', { code: '99999' });
  assert.equal(r.status, 429);
  resetAllLimits();
});

test('neglect: 3 days → hospital (1000P to heal), 7 days → rainbow bridge', async () => {
  const { c, userId } = await newPlayer();
  const pet = petOf(userId);
  getDb().prepare('UPDATE pets SET last_care_at = ?, stats_at = ? WHERE id = ?').run(Date.now() - 3.5 * DAY, Date.now() - 3.5 * DAY, pet.id);
  let r = await c.get('/api/me');
  assert.equal(r.data.pet.status, 'hospital');
  assert.equal(r.data.pet.mood, 'sick');
  r = await c.post('/api/pet/feed', { itemId: 'kibble' });
  assert.equal(r.data.code, 'pet_in_hospital');
  r = await c.post('/api/pet/heal');
  assert.equal(r.data.code, 'insufficient_points');
  // Eco missions stay open so the bill can be earned.
  r = await c.post('/api/eco/quiz', { answer: 0 });
  assert.equal(r.status, 200);
  getDb().prepare('UPDATE users SET points = 1200 WHERE id = ?').run(userId);
  r = await c.post('/api/pet/heal');
  assert.equal(r.data.state.pet.status, 'alive');
  assert.equal(r.data.state.user.points, 200);

  getDb().prepare('UPDATE pets SET last_care_at = ?, stats_at = ? WHERE id = ?').run(Date.now() - 8 * DAY, Date.now() - 8 * DAY, pet.id);
  r = await c.get('/api/me');
  assert.equal(r.data.pet.status, 'dead');
  assert.equal(r.data.pet.mood, 'angel');
  for (const [path, body] of [
    ['/api/pet/feed', { itemId: 'kibble' }],
    ['/api/shop/buy', { itemId: 'kibble' }],
    ['/api/eco/quiz', { answer: 0 }],
  ]) {
    r = await c.post(path, body);
    assert.equal(r.data.code, 'pet_dead', path);
  }
  r = await c.post('/api/pet/adopt', { species: 'cat', color: 'gray', name: '새봄' });
  assert.equal(r.data.code, 'needs_ticket');

  // Buying another alio product unlocks a new adoption.
  const product = (await client().post('/api/partner/v1/product-codes', { orderId: 'order-77' }, { 'x-api-key': getPartnerApiKey() })).data;
  assert.match(product.code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  r = await c.post('/api/codes/product', { code: product.code.toLowerCase() });
  assert.equal(r.data.state.user.adoptionTickets, 1);
  r = await c.post('/api/pet/adopt', { species: 'cat', color: 'gray', name: '새봄' });
  assert.equal(r.data.state.pet.name, '새봄');
  assert.equal(r.data.state.pet.status, 'alive');
  assert.equal(r.data.state.user.points, 200, 'wallet survives');
});

test('day-count milestones pay out once', async () => {
  const { c, userId } = await newPlayer();
  getDb().prepare('UPDATE pets SET adopted_at = ? WHERE user_id = ?').run(Date.now() - 8 * DAY, userId);
  let r = await c.get('/api/me');
  assert.equal(r.data.pet.day, 9);
  assert.equal(r.data.celebrations.length, 1);
  assert.equal(r.data.celebrations[0].day, 7);
  assert.equal(r.data.user.points, 100);
  r = await c.get('/api/me');
  assert.equal(r.data.celebrations.length, 0);
  assert.equal(r.data.pet.nextMilestone.day, 30);
});

test('eco quiz and photo missions', async () => {
  const { c } = await newPlayer();
  let r = await c.get('/api/eco/today');
  assert.equal(r.data.missions.length, 7);
  assert.equal(r.data.quiz.answered, false);
  assert.equal(r.data.quiz.answer, undefined, 'answer is hidden before answering');
  r = await c.post('/api/eco/quiz', { answer: 1 });
  assert.equal(typeof r.data.correct, 'boolean');
  r = await c.post('/api/eco/quiz', { answer: 1 });
  assert.equal(r.data.code, 'quiz_done');

  const image = 'data:image/jpeg;base64,' + Buffer.alloc(4000, 7).toString('base64');
  r = await c.post('/api/eco/mission', { missionId: 'tumbler', image });
  assert.equal(r.data.pass, true);
  assert.equal(r.data.reward, 50);
  r = await c.post('/api/eco/mission', { missionId: 'tumbler', image });
  assert.equal(r.data.code, 'mission_done');
  r = await c.post('/api/eco/mission', { missionId: 'recycle', image });
  assert.equal(r.data.code, 'duplicate_photo');
  r = await c.post('/api/eco/mission', { missionId: 'plogging', image: 'data:image/jpeg;base64,' + Buffer.alloc(4000, 9).toString('base64') });
  assert.equal(r.data.reward, 100);
  r = await c.get('/api/eco/today');
  assert.deepEqual(
    r.data.missions.filter((m) => m.done).map((m) => m.id),
    ['tumbler', 'plogging'],
  );
});

test('demo mode lets presenters finish walks instantly', async () => {
  const { c } = await newPlayer();
  updateSettings({ demoMode: true });
  try {
    let r = await c.post('/api/pet/walk/start');
    r = await c.post('/api/pet/walk/complete', { sessionId: r.data.sessionId, steps: 0 });
    assert.equal(r.data.reward, 100);
  } finally {
    updateSettings({ demoMode: false });
  }
});

test('admin dashboard: login, overview, codes, settings', async () => {
  resetAllLimits();
  const a = client();
  let r = await a.get('/api/admin/overview');
  assert.equal(r.status, 401);
  r = await a.post('/api/admin/login', { password: 'nope' });
  assert.equal(r.status, 401);
  r = await a.post('/api/admin/login', { password: 'admin1234' });
  assert.equal(r.status, 200);
  r = await a.get('/api/admin/overview');
  assert.ok(r.data.users.total > 5);
  assert.ok(r.data.eco.steps >= 812);
  r = await a.post('/api/admin/codes', { type: 'product', count: 3, label: '11월 박스' });
  assert.equal(r.data.codes.length, 3);
  assert.equal(r.data.codes[0].ref, '11월 박스');
  r = await a.get(`/api/admin/codes?batch=${r.data.batch}`);
  assert.equal(r.data.total, 3);
  r = await a.get('/api/admin/codes.csv?type=product');
  assert.match(r.data, /11월 박스/);
  r = await a.put('/api/admin/settings', { walkSteps: 50 });
  assert.equal(r.status, 400);
  r = await a.put('/api/admin/settings', { walkSteps: 1000, alioSignupUrl: 'https://example.com/join' });
  assert.equal(r.data.settings.walkSteps, 1000);
  r = await a.get('/api/catalog');
  r = await client().get('/api/catalog');
  assert.ok(r.data.items.length > 20);
  await a.put('/api/admin/settings', { walkSteps: 800 });
  const users = (await a.get('/api/admin/users?q=user1')).data;
  assert.ok(users.total >= 1);
  r = await a.post(`/api/admin/users/${users.items[0].id}/grant`, { amount: 300, reason: '이벤트' });
  assert.equal(r.data.ok, true);
});

test('cross-site writes are rejected', async () => {
  const { c } = await newPlayer();
  const r = await c.post('/api/pet/play', {}, { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});
