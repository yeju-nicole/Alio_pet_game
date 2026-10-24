export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const fail = (status, message, code) => {
  throw new HttpError(status, message, code);
};

export const clamp = (n, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

const dayFormatters = new Map();

function formatterFor(timeZone) {
  let f = dayFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try {
    formatterFor(tz);
    return true;
  } catch {
    return false;
  }
}

/** Calendar date (YYYY-MM-DD) of `ts` in the given IANA time zone. */
export function dayKey(ts, timeZone = 'Asia/Seoul') {
  return formatterFor(timeZone).format(new Date(ts));
}

/** Whole calendar days between two timestamps in a time zone. */
export function calendarDaysBetween(fromTs, toTs, timeZone) {
  const a = Date.parse(dayKey(fromTs, timeZone) + 'T00:00:00Z');
  const b = Date.parse(dayKey(toTs, timeZone) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
