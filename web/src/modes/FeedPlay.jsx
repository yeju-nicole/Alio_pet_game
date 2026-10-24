import { useState } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { useGame, particle, fmt } from '../store.jsx';
import Pet from '../components/Pet.jsx';
import { HouseScene } from '../components/Scenes.jsx';
import { Sheet, Empty } from '../components/UI.jsx';
import { useSky, timeLeft } from '../lib/hooks.js';
import { buzz } from '../lib/device.js';

const STAT_KO = { fullness: '배부름', happiness: '행복', cleanliness: '청결', energy: '에너지' };

export function FeedMode({ onClose, goShop }) {
  const { state, items, run, toast } = useGame();
  const { pet, inventory, today } = state;
  const { now, sky } = useSky();
  const [eating, setEating] = useState(null);

  const foods = [...items.values()].filter((i) => i.category === 'food' && inventory[i.id] > 0);
  const wait = today.nextFeedAt - Date.now();

  async function feed(item) {
    try {
      const data = await run('/pet/feed', { itemId: item.id });
      buzz(15);
      setEating({ item, loved: data.loved });
      setTimeout(() => {
        toast(data.loved ? `최애 간식이에요! ${pet.name}${particle(pet.name, '이/가')} 엄청 좋아해요 💕` : `냠냠! ${pet.name}${particle(pet.name, '이/가')} 맛있게 먹었어요`, 'reward');
        onClose();
      }, 2300);
    } catch {
      /* toast shown */
    }
  }

  if (eating) {
    return (
      <div className="mode">
        <div style={{ marginTop: 'calc(var(--safe-top) + 60px)', padding: '0 14px' }}>
          <div style={{ borderRadius: 26, overflow: 'hidden' }}>
            <HouseScene sky={sky} date={now} height="90%">
              <div className="pet-slot" style={{ bottom: '10%', width: '46%' }}>
                <Pet species={pet.species} color={pet.color} mood="eating" equipped={pet.equipped} excited />
              </div>
              <div style={{ position: 'absolute', left: '50%', bottom: '4%', transform: 'translateX(-50%)', fontSize: 44 }}>{eating.item.emoji}</div>
              <div className="bubble" style={{ left: '50%', bottom: '62%' }}>
                냠냠 쩝쩝 {eating.loved ? '💕' : '😋'}
              </div>
            </HouseScene>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Sheet title="🍚 무엇을 줄까요?" onClose={onClose}>
      {wait > 0 && (
        <div className="notice warn" style={{ marginBottom: 12 }}>
          {pet.name}
          {particle(pet.name, '이/가')} 아직 배불러요. {timeLeft(wait)} 뒤에 다시 줄 수 있어요.
        </div>
      )}
      {foods.length === 0 ? (
        <Empty emoji="🥣" title="밥이 다 떨어졌어요">
          상점에서 사료와 간식을 살 수 있어요.
          <div style={{ marginTop: 14 }}>
            <button className="btn small" onClick={goShop}>
              <ShoppingBag size={16} /> 상점 가기
            </button>
          </div>
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {foods.map((f) => (
            <button
              key={f.id}
              className="card"
              onClick={() => feed(f)}
              disabled={wait > 0}
              style={{ border: 0, padding: 12, textAlign: 'left', cursor: wait > 0 ? 'default' : 'pointer', opacity: wait > 0 ? 0.5 : 1 }}
            >
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 32 }}>{f.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{f.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{inventory[f.id]}개 있어요</div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 6 }}>
                {Object.entries(f.effect)
                  .map(([k, v]) => `${STAT_KO[k]} +${v}`)
                  .join(' · ')}
                {f.favorite === pet.species && <span style={{ color: 'var(--pink-deep)', fontWeight: 800 }}> · 최애 💕</span>}
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="muted center" style={{ fontSize: 12.5, margin: '14px 0 0' }}>
        밥을 주면 +{fmt(state.settings.feedReward)}P · 하루 {state.settings.feedDailyLimit}번까지
      </p>
    </Sheet>
  );
}

const THROWS = 3;

export function PlayMode({ onClose }) {
  const { state, items, run } = useGame();
  const { pet, inventory } = state;
  const { now, sky } = useSky();
  const toys = [...items.values()].filter((i) => i.category === 'toy' && inventory[i.id] > 0);
  const [toy, setToy] = useState(toys.find((t) => t.favorite === pet.species) ?? toys[0] ?? null);
  const [throws, setThrows] = useState(0);
  const [flying, setFlying] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function toss() {
    if (busy || result) return;
    buzz(12);
    setFlying((n) => n + 1);
    const n = throws + 1;
    setThrows(n);
    if (n >= THROWS) {
      setBusy(true);
      try {
        const data = await run('/pet/play', { itemId: toy?.id });
        setTimeout(() => setResult(data), 700);
      } catch {
        setThrows(0);
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <div className="mode">
      <div className="mode-head">
        <button className="icon-btn" onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
        <div className="mode-title">🎾 놀아주기</div>
      </div>
      <div style={{ marginTop: 'calc(var(--safe-top) + 64px)', padding: '0 14px' }}>
        <div style={{ borderRadius: 26, overflow: 'hidden', boxShadow: 'var(--shadow)' }} onClick={toss}>
          <HouseScene sky={sky} date={now} height="88%">
            <div className="pet-slot" style={{ bottom: '6%', width: '44%' }}>
              <div key={flying} className={flying ? 'pet-hop' : ''}>
                <Pet species={pet.species} color={pet.color} mood={result || throws ? 'happy' : 'normal'} equipped={pet.equipped} excited />
              </div>
            </div>
            {flying > 0 && (
              <span key={flying} style={{ position: 'absolute', left: '50%', bottom: '10%', fontSize: 38, animation: 'toss 0.7s ease-out forwards', pointerEvents: 'none' }}>
                {toy?.emoji ?? '💗'}
              </span>
            )}
            {result && (
              <div className="bubble" style={{ left: '50%', bottom: '60%' }}>
                {result.loved ? '이 장난감 최고야! 💕' : '또 놀자! 💗'}
              </div>
            )}
          </HouseScene>
        </div>
      </div>
      <div className="mode-panel">
        {result ? (
          <>
            <div className="center">
              <div className="cute" style={{ fontSize: 24 }}>신나게 놀았어요!</div>
              <div className="points" style={{ fontSize: 20, margin: '4px 0 14px' }}>
                +{fmt(result.reward)}P
              </div>
            </div>
            <button className="btn block" onClick={onClose}>
              좋아요
            </button>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>어떤 장난감으로 놀까요?</div>
            <div className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
              <button className={`tag ${!toy ? 'mint' : 'gray'}`} style={{ border: 0, fontSize: 14, padding: '9px 12px', cursor: 'pointer', flex: 'none' }} onClick={() => setToy(null)}>
                🤚 손으로
              </button>
              {toys.map((t) => (
                <button
                  key={t.id}
                  className={`tag ${toy?.id === t.id ? 'mint' : 'gray'}`}
                  style={{ border: 0, fontSize: 14, padding: '9px 12px', cursor: 'pointer', flex: 'none' }}
                  onClick={() => setToy(t)}
                >
                  {t.emoji} {t.name}
                  {t.favorite === pet.species && ' 💕'}
                </button>
              ))}
            </div>
            <button className="btn block" onClick={toss} disabled={busy}>
              {toy ? `${toy.emoji} 던지기!` : '🤚 쓰다듬기!'} ({throws}/{THROWS})
            </button>
          </>
        )}
      </div>
    </div>
  );
}
