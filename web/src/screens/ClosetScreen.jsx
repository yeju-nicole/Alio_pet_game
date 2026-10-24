import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useGame, fmt, particle } from '../store.jsx';
import Pet from '../components/Pet.jsx';
import { ItemIcon } from './ShopScreen.jsx';

const SLOTS = [
  { id: 'head', label: '머리' },
  { id: 'face', label: '얼굴' },
  { id: 'neck', label: '목' },
  { id: 'body', label: '옷' },
];

export default function ClosetScreen({ goShop }) {
  const { state, catalog, run } = useGame();
  const { pet, inventory } = state;
  const [slot, setSlot] = useState('head');
  const [busy, setBusy] = useState(false);

  const clothes = catalog.items.filter((i) => i.category === 'clothes' && i.slot === slot);
  const foods = catalog.items.filter((i) => i.category === 'food' && inventory[i.id] > 0);
  const toys = catalog.items.filter((i) => i.category === 'toy' && inventory[i.id] > 0);

  async function toggle(item) {
    if (busy) return;
    setBusy(true);
    try {
      await run('/pet/equip', { slot, itemId: pet.equipped[slot] === item.id ? null : item.id });
    } catch {
      /* toast */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">옷장 👗</h1>
      <p className="page-sub">
        {pet.name}
        {particle(pet.name, '을/를')} 예쁘게 꾸며 주세요. 입힌 옷은 산책할 때도 함께해요!
      </p>
      <div className="pad">
        <div
          className="card"
          style={{
            background: 'radial-gradient(circle at 50% 40%, #FFFFFF 0, #FFF0F4 60%, #FFE3EC 100%)',
            padding: '10px 0 6px',
            marginBottom: 14,
          }}
        >
          <div style={{ width: 200, margin: '0 auto' }}>
            <Pet species={pet.species} color={pet.color} mood="happy" equipped={pet.equipped} excited />
          </div>
        </div>
        <div className="segmented" style={{ marginBottom: 12 }}>
          {SLOTS.map((s) => (
            <button key={s.id} className={slot === s.id ? 'on' : ''} onClick={() => setSlot(s.id)}>
              {s.label}
              {pet.equipped[s.id] && ' •'}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {clothes.map((i) => {
            const own = inventory[i.id] > 0;
            const on = pet.equipped[slot] === i.id;
            return (
              <button
                key={i.id}
                onClick={() => (own ? toggle(i) : goShop())}
                className="card"
                style={{
                  border: on ? '3px solid var(--pink)' : '3px solid transparent',
                  padding: '10px 4px 8px',
                  cursor: 'pointer',
                  position: 'relative',
                  textAlign: 'center',
                }}
                aria-pressed={on}
              >
                <div style={{ height: 52, display: 'grid', placeItems: 'center', opacity: own ? 1 : 0.35 }}>
                  <ItemIcon item={i} size={50} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4 }}>{i.name}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  {on ? <span style={{ color: 'var(--pink-deep)', fontWeight: 800 }}>입는 중</span> : own ? <span className="muted">입히기</span> : <span className="points">{fmt(i.price)}P</span>}
                </div>
                {!own && <Lock size={14} style={{ position: 'absolute', right: 8, top: 8, color: 'var(--ink-3)' }} />}
              </button>
            );
          })}
        </div>

        <div style={{ fontWeight: 800, margin: '22px 4px 10px' }}>🎒 내 가방</div>
        <div className="card" style={{ padding: 14 }}>
          {foods.length + toys.length === 0 ? (
            <div className="muted center" style={{ fontSize: 14 }}>
              가방이 비어 있어요.{' '}
              <button className="link-btn" onClick={goShop}>
                상점 가기
              </button>
            </div>
          ) : (
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {[...foods, ...toys].map((i) => (
                <span key={i.id} className="tag gray" style={{ fontSize: 13, padding: '6px 10px' }}>
                  {i.emoji} {i.name}
                  {i.category === 'food' && <b style={{ marginLeft: 2 }}>×{inventory[i.id]}</b>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
