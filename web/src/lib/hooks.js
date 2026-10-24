import { useEffect, useState } from 'react';
import { skyAt } from './sky.js';

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useSky() {
  const now = useNow(60000);
  return { now, sky: skyAt(now) };
}

export function petTalk(species) {
  const e = species === 'cat' ? '냥' : '멍';
  return {
    happy: [`오늘 너무 행복해${e}!`, `최고의 하루${e} 💕`, `사랑해${e}!`, `헤헤, 기분 좋아${e}~`],
    normal: [`뭐 하고 놀까${e}?`, `산책 가고 싶어${e}~`, `오늘도 지구 지키기${e}!`, `쓰다듬어 줘${e}!`],
    hungry: [`배고파${e}...`, `꼬르륵... 밥 줘${e}`],
    dirty: [`몸이 근질근질해${e}`, `목욕하고 싶어${e}`],
    sleepy: [`졸려${e}... 쿨쿨`, `하암~ 재워 줘${e}`],
    sad: [`심심해${e}...`, `같이 놀아 줘${e}`],
    sick: [`아파${e}... 😢`],
    pet: [`간지러워${e}!`, `좋아${e}~ 💗`, `히히히${e}!`, `더 쓰다듬어 줘${e}!`],
  };
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function timeLeft(ms) {
  if (ms <= 0) return '곧';
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간${m % 60 ? ` ${m % 60}분` : ''}`;
  const d = Math.floor(h / 24);
  return `${d}일${h % 24 ? ` ${h % 24}시간` : ''}`;
}
