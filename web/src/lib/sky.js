/**
 * Time-of-day lighting from the phone's own clock, so a walk at 9pm really
 * happens under a night sky. Sunrise and sunset follow the season using a
 * standard solar-declination approximation at Seoul's latitude.
 */
const LAT = 37.57;

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

export function sunTimes(date = new Date()) {
  const n = dayOfYear(date);
  const decl = (23.44 * Math.PI) / 180 * Math.sin(((2 * Math.PI) / 365) * (284 + n));
  const lat = (LAT * Math.PI) / 180;
  const cosH = Math.min(1, Math.max(-1, -Math.tan(lat) * Math.tan(decl)));
  const dayLen = ((2 * Math.acos(cosH) * 180) / Math.PI) / 15;
  // Seoul's solar noon sits around 12:30 local time.
  const noon = 12.5;
  return { sunrise: noon - dayLen / 2, sunset: noon + dayLen / 2 };
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const A = hex(a);
  const B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

export function skyAt(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  const { sunrise, sunset } = sunTimes(date);
  // [hour, skyTop, skyBottom, shade (scene darkness 0–1), stars 0–1, warm glow 0–1]
  const keys = [
    [sunrise - 1.6, '#151a46', '#343a78', 0.55, 1, 0],
    [sunrise - 0.5, '#3d4a8f', '#f3a6b8', 0.32, 0.35, 0.2],
    [sunrise + 0.6, '#8fd0f5', '#ffdcc0', 0.08, 0, 0.15],
    [12.5, '#5fb9f1', '#c6e9ff', 0, 0, 0],
    [sunset - 1.6, '#72b6ea', '#ffe4ad', 0.03, 0, 0.1],
    [sunset - 0.1, '#f28d6e', '#ffcb8e', 0.18, 0, 0.45],
    [sunset + 0.6, '#5b4a8d', '#e690a3', 0.36, 0.3, 0.25],
    [sunset + 1.6, '#151a46', '#343a78', 0.55, 1, 0],
  ];
  let i = keys.findIndex((k) => k[0] > h);
  let a;
  let b;
  let t;
  if (i === -1 || i === 0) {
    a = keys[keys.length - 1];
    b = keys[0];
    const span = b[0] + 24 - a[0];
    const pos = (h < b[0] ? h + 24 : h) - a[0];
    t = Math.min(1, Math.max(0, pos / span));
  } else {
    a = keys[i - 1];
    b = keys[i];
    t = (h - a[0]) / (b[0] - a[0]);
  }
  const lerp = (x, y) => x + (y - x) * t;

  const isDay = h >= sunrise && h <= sunset;
  const sunT = (h - sunrise) / (sunset - sunrise);
  const nightLen = 24 - (sunset - sunrise);
  const moonT = (((h - sunset + 24) % 24) / nightLen);

  let label = '밤';
  let emoji = '🌙';
  if (h >= sunrise - 1 && h < sunrise + 1.5) [label, emoji] = ['새벽', '🌅'];
  else if (h >= sunrise + 1.5 && h < 11.5) [label, emoji] = ['아침', '🌤️'];
  else if (h >= 11.5 && h < sunset - 1.5) [label, emoji] = ['낮', '☀️'];
  else if (h >= sunset - 1.5 && h < sunset + 0.8) [label, emoji] = ['노을', '🌇'];

  return {
    top: mix(a[1], b[1], t),
    bottom: mix(a[2], b[2], t),
    shade: lerp(a[3], b[3]),
    stars: lerp(a[4], b[4]),
    glow: lerp(a[5], b[5]),
    night: !isDay && (h > sunset + 0.5 || h < sunrise - 0.5),
    sun: isDay ? { x: 0.08 + sunT * 0.84, y: 0.62 - Math.sin(sunT * Math.PI) * 0.48 } : null,
    moon: !isDay ? { x: 0.1 + moonT * 0.8, y: 0.55 - Math.sin(moonT * Math.PI) * 0.4 } : null,
    label,
    emoji,
    hour: h,
  };
}
