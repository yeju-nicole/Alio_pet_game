import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, post, ApiError } from './api.js';

const GameCtx = createContext(null);

export function useGame() {
  return useContext(GameCtx);
}

let toastSeq = 0;

export function GameProvider({ children }) {
  const [state, setStateRaw] = useState(undefined); // undefined = loading, null = signed out
  const [catalog, setCatalog] = useState({ items: [], milestones: [] });
  const [toasts, setToasts] = useState([]);
  const [floats, setFloats] = useState([]);
  const [walletBump, setWalletBump] = useState(0);
  const [celebrations, setCelebrations] = useState([]);
  const lastPoints = useRef(null);

  const toast = useCallback((text, type = 'info', ms = 2800) => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-2), { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  const floatPoints = useCallback((amount) => {
    if (!amount) return;
    const id = ++toastSeq;
    setFloats((f) => [...f, { id, amount }]);
    setWalletBump((n) => n + 1);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1500);
  }, []);

  const setState = useCallback((next) => {
    setStateRaw(next);
    if (next?.celebrations?.length) setCelebrations((c) => [...c, ...next.celebrations]);
    if (next?.user) lastPoints.current = next.user.points;
  }, []);

  const refresh = useCallback(async () => {
    try {
      setState(await api('/me'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setStateRaw(null);
      else if (state === undefined) setStateRaw(null);
    }
  }, [setState, state]);

  /**
   * Calls a game endpoint, shows the error as a toast and applies the new
   * state that every action returns.
   */
  const run = useCallback(
    async (path, body, { quiet = false } = {}) => {
      try {
        const data = await post(path, body);
        if (data?.state) setState(data.state);
        if (data?.reward > 0) floatPoints(data.reward);
        return data;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setStateRaw(null);
          toast('다시 로그인해 주세요', 'error');
        } else if (!quiet) {
          toast(e.message, 'error');
        }
        if (e instanceof ApiError && ['pet_in_hospital', 'pet_dead', 'no_pet'].includes(e.code)) refresh();
        throw e;
      }
    },
    [setState, floatPoints, toast, refresh],
  );

  useEffect(() => {
    refresh();
    api('/catalog')
      .then(setCatalog)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep stats fresh while the app is open and whenever it comes back.
  useEffect(() => {
    if (!state) return undefined;
    const timer = setInterval(refresh, 60000);
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [Boolean(state), refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => new Map(catalog.items.map((i) => [i.id, i])), [catalog]);

  const value = {
    state,
    setState,
    refresh,
    run,
    catalog,
    items,
    toast,
    toasts,
    floats,
    floatPoints,
    walletBump,
    celebrations,
    dismissCelebration: () => setCelebrations((c) => c.slice(1)),
    signOut: async () => {
      try {
        await post('/auth/logout');
      } finally {
        setStateRaw(null);
      }
    },
  };
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

/** Korean particle helpers: 초코가 / 나비가 · 초코를 · 초코와 */
export function josa(word, pair) {
  const [withBatchim, without] = pair.split('/');
  const ch = String(word).trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return word + without;
  return word + (code % 28 ? withBatchim : without);
}

export const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

/** Just the particle: particle('초코', '이/가') → '가' */
export const particle = (word, pair) => josa(word, pair).slice(String(word).length);
