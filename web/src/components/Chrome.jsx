import { useEffect, useRef, useState } from 'react';
import { House, Leaf, ShoppingBag, Shirt, UserRound } from 'lucide-react';
import { useGame, fmt, particle } from '../store.jsx';
import { Coin } from './UI.jsx';

/** Wallet + "days together" tracker shown at the top of every main screen. */
export function TopBar({ onWallet }) {
  const { state, walletBump } = useGame();
  const chip = useRef(null);
  const [bumping, setBumping] = useState(false);

  useEffect(() => {
    if (!walletBump) return undefined;
    setBumping(false);
    const raf = requestAnimationFrame(() => setBumping(true));
    const t = setTimeout(() => setBumping(false), 550);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [walletBump]);

  const pet = state.pet;
  const m = pet?.nextMilestone;
  const pct = m ? ((pet.day - m.fromDay) / (m.day - m.fromDay)) * 100 : 100;

  return (
    <header className="topbar">
      <button ref={chip} className={`wallet-chip ${bumping ? 'bump' : ''}`} onClick={onWallet} aria-label="내 지갑">
        <Coin />
        <span>{fmt(state.user.points)}</span>
      </button>
      {pet && pet.status !== 'dead' && (
        <div className="day-tracker" aria-label={`${pet.name}${particle(pet.name, '과/와')} 함께한 지 ${pet.day}일째`}>
          <div className="top">
            <span>
              <b style={{ color: 'var(--ink)' }}>{pet.name}</b>
              {particle(pet.name, '과/와')} 함께한 지
            </span>
            <span className="dday">D+{pet.day}</span>
          </div>
          <div className="bar">
            <i style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
          </div>
          {m && (
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3, textAlign: 'right' }}>
              {m.day}일 기념일까지 {m.day - pet.day}일 · 🎁 {fmt(m.reward)}P
            </div>
          )}
        </div>
      )}
    </header>
  );
}

const TABS = [
  { id: 'home', label: '홈', icon: House },
  { id: 'eco', label: '에코 미션', icon: Leaf },
  { id: 'shop', label: '상점', icon: ShoppingBag },
  { id: 'closet', label: '옷장', icon: Shirt },
  { id: 'me', label: '내 정보', icon: UserRound },
];

export function BottomNav({ tab, setTab, ecoBadge }) {
  return (
    <nav className="bottom-nav" aria-label="메뉴">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
          <Icon size={23} strokeWidth={tab === id ? 2.4 : 2} />
          {label}
          {id === 'eco' && ecoBadge && <span className="dot" />}
        </button>
      ))}
    </nav>
  );
}
