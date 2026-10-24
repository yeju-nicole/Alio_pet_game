/**
 * Small in-memory sliding-window limiter. Good enough for a single Node
 * process; swap for Redis if the app is ever scaled horizontally.
 */
const buckets = new Map();

function prune(list, now, windowMs) {
  while (list.length && list[0] <= now - windowMs) list.shift();
}

export function isLimited(key, limit, windowMs) {
  const list = buckets.get(key);
  if (!list) return false;
  prune(list, Date.now(), windowMs);
  return list.length >= limit;
}

export function hit(key, windowMs) {
  const now = Date.now();
  let list = buckets.get(key);
  if (!list) {
    list = [];
    buckets.set(key, list);
  }
  prune(list, now, windowMs);
  list.push(now);
}

/** Counts a hit and reports whether the caller is now over the limit. */
export function consume(key, limit, windowMs) {
  if (isLimited(key, limit, windowMs)) return false;
  hit(key, windowMs);
  return true;
}

export function resetLimit(key) {
  buckets.delete(key);
}

export function resetAllLimits() {
  buckets.clear();
}

setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, list] of buckets) {
    if (!list.length || list[list.length - 1] < cutoff) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();
