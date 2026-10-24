import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, '..');
export const IS_PROD = process.env.NODE_ENV === 'production';

export const env = {
  port: Number(process.env.PORT) || 3000,
  dataDir: process.env.DATA_DIR || path.join(ROOT_DIR, 'data'),
  adminPassword: process.env.ADMIN_PASSWORD || (IS_PROD ? '' : 'admin1234'),
  partnerApiKey: process.env.PARTNER_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : IS_PROD,
  trustProxy: process.env.TRUST_PROXY || (IS_PROD ? '1' : ''),
  // Public address of the game, used in links handed to alio's website (e.g. https://pet.example.com)
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
};

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

/**
 * Game balance settings. Every value here can be changed from the admin
 * dashboard without a redeploy; the stored overrides live in the `settings`
 * table and are merged over these defaults.
 */
export const SETTING_DEFAULTS = {
  // 산책: real steps counted by the phone's motion sensor
  walkSteps: 800,
  walkReward: 100,
  walkDailyLimit: 3,
  // 밥 주기
  feedReward: 100,
  feedDailyLimit: 3,
  feedCooldownMinutes: 120,
  // 목욕
  washReward: 100,
  washDailyLimit: 2,
  // 놀아주기
  playReward: 10,
  playDailyLimit: 10,
  // 재우기: phone must be left untouched
  sleepMinutes: 10,
  sleepReward: 100,
  sleepDailyLimit: 2,
  // 에코 미션 & 퀴즈
  quizReward: 30,
  missionReward: 50,
  ploggingReward: 100,
  // alio 연동
  signupCodeReward: 500,
  signupCodeValidDays: 30,
  productCodeValidDays: 365,
  // 돌봄 규칙
  hospitalAfterDays: 3,
  deathAfterDays: 7,
  healCost: 1000,
  // 외부 링크 (비워 두면 버튼이 숨겨집니다)
  alioSignupUrl: '',
  alioStoreUrl: '',
  supportEmail: '',
  // 발표·시연용: 산책/재우기 즉시 완료 버튼 노출 (운영 시 반드시 끄세요)
  demoMode: false,
};

export const SETTING_LIMITS = {
  walkSteps: [100, 30000],
  sleepMinutes: [1, 120],
  hospitalAfterDays: [1, 30],
  deathAfterDays: [2, 60],
};

/** Settings the game client is allowed to see. */
export const PUBLIC_SETTING_KEYS = Object.keys(SETTING_DEFAULTS);
