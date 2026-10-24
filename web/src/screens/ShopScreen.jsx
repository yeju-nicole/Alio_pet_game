import { useState } from 'react';
import { Minus, Plus, Check } from 'lucide-react';
import { useGame, fmt, particle } from '../store.jsx';
import Pet from '../components/Pet.jsx';
import { AccessoryIcon } from '../components/Accessories.jsx';
import { Sheet, Coin } from '../components/UI.jsx';

const TABS = [
  { id: 'food', label: '🍖 사료·간식' },
  { id: 'clothes', label: '👕 옷·소품' },
  { id: 'toy', label: '🧸 장난감' },
];

const STAT_KO = { fullness: '배부름', happiness: '행복', cleanliness: '청결', energy: '에너지' };

export function ItemIcon({ item, size = 54 }) {
  if (item.category === 'clothes') return <AccessoryIcon id={item.id} slot={item.slot} size={size} />;
  return <span style={{ fontSize: size * 0.78, lineHeight: 1 }}>{item.emoji}</span>;
}

export default function ShopScreen({ initialTab = 'food' }) {
  const { state, catalog, run, toast } = useGame();
  const { pet, inventory, user } = state;
  const [tab, setTab] = useState(initialTab);
  const [sel, setSel] = useState(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [bought, setBought] = useState(null);

  const list = catalog.items.filter((i) => i.category === tab);
  const owned = (i) => i.category !== 'food' && inventory[i.id] > 0;

  async function buy() {
    setBusy(true);
    try {
      await run('/shop/buy', { itemId: sel.id, qty: sel.category === 'food' ? qty : 1 });
      toast(`${sel.emoji} ${sel.name}${sel.category === 'food' && qty > 1 ? ` ${qty}개를` : particle(sel.name, '을/를')} 샀어요!`, 'reward');
      if (sel.category === 'clothes') setBought(sel);
      else setSel(null);
    } catch {
      /* toast */
    } finally {
      setBusy(false);
    }
  }

  async function wear() {
    try {
      await run('/pet/equip', { slot: bought.slot, itemId: bought.id });
      toast(`${pet.name}에게 ${bought.name}${particle(bought.name, '을/를')} 입혔어요 💕`);
    } catch {
      /* toast */
    }
    setBought(null);
    setSel(null);
  }

  const total = sel ? sel.price * (sel.category === 'food' ? qty : 1) : 0;

  return (
    <div>
      <div className="row" style={{ padding: '0 18px 0 0' }}>
        <h1 className="page-title" style={{ flex: 1 }}>
          멍냥 상점 🛍️
        </h1>
      </div>
      <p className="page-sub">돌봄과 에코 미션으로 모은 포인트로 쇼핑해요.</p>
      <div className="pad">
        <div className="segmented" style={{ marginBottom: 14 }}>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {list.map((i) => (
            <button
              key={i.id}
              className="card"
              onClick={() => {
                setSel(i);
                setQty(1);
                setBought(null);
              }}
              style={{ border: 0, padding: '14px 10px 12px', cursor: 'pointer', position: 'relative', textAlign: 'center' }}
            >
              {i.eco && (
                <span className="tag mint" style={{ position: 'absolute', left: 8, top: 8, fontSize: 10.5, padding: '2px 7px' }}>
                  🌱 친환경
                </span>
              )}
              {i.favorite === pet?.species && (
                <span className="tag" style={{ position: 'absolute', right: 8, top: 8, fontSize: 10.5, padding: '2px 7px' }}>
                  💕 최애
                </span>
              )}
              <div style={{ height: 64, display: 'grid', placeItems: 'center', marginTop: 6 }}>
                <ItemIcon item={i} size={60} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 6 }}>{i.name}</div>
              <div style={{ marginTop: 4, fontSize: 13 }}>
                {owned(i) ? (
                  <span className="tag gray">
                    <Check size={12} /> 보유 중
                  </span>
                ) : (
                  <span className="points">{fmt(i.price)}P</span>
                )}
                {i.category === 'food' && inventory[i.id] > 0 && <span className="muted" style={{ fontSize: 11.5 }}> · {inventory[i.id]}개 보유</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {sel && (
        <Sheet title={sel.name} onClose={() => (setSel(null), setBought(null))}>
          <div className="center" style={{ background: 'white', borderRadius: 22, padding: '14px 10px', marginBottom: 12 }}>
            {sel.category === 'clothes' && pet ? (
              <div style={{ width: 170, margin: '0 auto' }}>
                <Pet species={pet.species} color={pet.color} mood="happy" equipped={{ ...pet.equipped, [sel.slot]: sel.id }} excited />
              </div>
            ) : (
              <div style={{ fontSize: 80, lineHeight: 1.2 }}>{sel.emoji}</div>
            )}
          </div>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5 }}>
            {sel.desc}
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {sel.effect &&
              Object.entries(sel.effect).map(([k, v]) => (
                <span key={k} className="tag butter">
                  {STAT_KO[k]} +{v}
                </span>
              ))}
            {sel.happiness && <span className="tag">행복 +{sel.happiness}</span>}
            {sel.favorite && <span className="tag lilac">{sel.favorite === 'dog' ? '🐶 강아지' : '🐱 고양이'} 최애</span>}
            {sel.category === 'clothes' && <span className="tag gray">{{ head: '머리', face: '얼굴', neck: '목', body: '몸' }[sel.slot]}</span>}
          </div>

          {bought ? (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => (setBought(null), setSel(null))}>
                나중에
              </button>
              <button className="btn" style={{ flex: 1.4 }} onClick={wear}>
                지금 입혀 보기 💕
              </button>
            </div>
          ) : owned(sel) ? (
            <button className="btn ghost block" disabled>
              이미 가지고 있어요
            </button>
          ) : (
            <>
              {sel.category === 'food' && (
                <div className="row" style={{ justifyContent: 'center', gap: 18, marginBottom: 14 }}>
                  <button className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="하나 빼기">
                    <Minus size={18} />
                  </button>
                  <span className="cute" style={{ fontSize: 26, minWidth: 40, textAlign: 'center' }}>
                    {qty}
                  </span>
                  <button className="icon-btn" onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="하나 더하기">
                    <Plus size={18} />
                  </button>
                </div>
              )}
              <div className="row" style={{ marginBottom: 12, fontSize: 14 }}>
                <span className="muted">내 포인트</span>
                <span className="spacer" />
                <Coin size={20} /> <b>{fmt(user.points)}</b>
              </div>
              <button className="btn butter block" disabled={busy || user.points < total} onClick={buy}>
                {user.points < total ? `${fmt(total - user.points)}P가 부족해요` : `${fmt(total)}P로 구매하기`}
              </button>
            </>
          )}
        </Sheet>
      )}
    </div>
  );
}
