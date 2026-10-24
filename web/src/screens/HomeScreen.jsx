import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useGame, particle, fmt } from '../store.jsx';
import Pet from '../components/Pet.jsx';
import { HouseScene } from '../components/Scenes.jsx';
import { useSky, petTalk, pick, timeLeft } from '../lib/hooks.js';
import { buzz } from '../lib/device.js';

const STATS = [
  { key: 'fullness', label: '배부름', emoji: '🍖', color: '#FFB86B' },
  { key: 'cleanliness', label: '청결', emoji: '🫧', color: '#7FD3F5' },
  { key: 'happiness', label: '행복', emoji: '💗', color: '#FF8FAB' },
  { key: 'energy', label: '에너지', emoji: '⚡', color: '#B8A4FF' },
];

function StatBars({ stats }) {
  return (
    <div className="card" style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
      {STATS.map((s) => {
        const v = stats[s.key];
        const low = v < 25;
        return (
          <div key={s.key}>
            <div className="row" style={{ gap: 5, fontSize: 12.5, fontWeight: 700 }}>
              <span>{s.emoji}</span>
              <span>{s.label}</span>
              <span className="spacer" />
              <span style={{ color: low ? 'var(--danger)' : 'var(--ink-3)', fontSize: 12 }}>{v}</span>
            </div>
            <div className="bar" style={{ height: 9, marginTop: 4 }}>
              <i style={{ width: `${Math.max(3, v)}%`, background: low ? 'var(--danger)' : s.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionButton({ emoji, label, reward, sub, disabled, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 0,
        background: 'white',
        borderRadius: 20,
        padding: '10px 2px 9px',
        boxShadow: disabled ? 'none' : `0 4px 0 ${accent}55, var(--shadow)`,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        transition: 'transform 0.08s',
        minWidth: 0,
      }}
      onPointerDown={(e) => !disabled && (e.currentTarget.style.transform = 'translateY(3px)')}
      onPointerUp={(e) => (e.currentTarget.style.transform = '')}
      onPointerLeave={(e) => (e.currentTarget.style.transform = '')}
    >
      <span style={{ fontSize: 28, lineHeight: 1.1 }}>{emoji}</span>
      <span style={{ fontWeight: 800, fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#C98A00' }}>+{reward}P</span>
      <span style={{ fontSize: 10, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{sub}</span>
    </button>
  );
}

export default function HomeScreen({ openMode }) {
  const { state } = useGame();
  const { now, sky } = useSky();
  const { pet, settings: cfg, today } = state;
  const [bubble, setBubble] = useState(null);
  const [hop, setHop] = useState(0);
  const [hearts, setHearts] = useState([]);
  const bubbleTimer = useRef();
  const talk = petTalk(pet.species);

  const say = (text, ms = 2600) => {
    clearTimeout(bubbleTimer.current);
    setBubble({ text, id: Math.random() });
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  };

  useEffect(() => {
    const first = setTimeout(() => say(pick(talk[pet.mood] ?? talk.normal), 3200), 600);
    const loop = setInterval(() => say(pick(talk[pet.mood] ?? talk.normal), 3000), 14000);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
      clearTimeout(bubbleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.mood, pet.species]);

  function pat() {
    buzz(12);
    setHop((n) => n + 1);
    say(pick(talk.pet), 1800);
    const id = Math.random();
    setHearts((h) => [...h, { id, dx: (Math.random() - 0.5) * 80 }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 900);
  }

  const c = today.counts;
  const feedWait = today.nextFeedAt - now.getTime();
  const sub = (kind, limit) => (c[kind] >= limit ? '오늘 완료 ✓' : `오늘 ${c[kind]}/${limit}`);
  const idleMs = now.getTime() - pet.lastCareAt;
  const toHospital = pet.hospitalAt - now.getTime();

  return (
    <div>
      <div style={{ margin: '0 14px', borderRadius: 26, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <HouseScene sky={sky} date={now} height="74%">
          <div className="pet-slot" style={{ bottom: '4%', width: '44%' }} onClick={pat} role="button" aria-label={`${pet.name} 쓰다듬기`}>
            <div key={hop} className={hop ? 'pet-hop' : ''}>
              <Pet species={pet.species} color={pet.color} mood={pet.mood} equipped={pet.equipped} excited={hop > 0 || pet.mood === 'happy'} />
            </div>
            {hearts.map((h) => (
              <span key={h.id} className="sparkle" style={{ left: '50%', top: '25%', '--dx': `${h.dx}px`, '--dy': '-70px' }}>
                💗
              </span>
            ))}
          </div>
          {bubble && (
            <div key={bubble.id} className="bubble" style={{ left: '50%', bottom: '52%' }}>
              {bubble.text}
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: 10,
              background: 'rgba(255,255,255,0.85)',
              borderRadius: 99,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {sky.emoji} {sky.label}
          </div>
        </HouseScene>
      </div>

      <div className="pad" style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        {idleMs > 36 * 3600 * 1000 && (
          <div className="notice warn">
            <AlertTriangle size={18} style={{ flex: 'none', marginTop: 1 }} />
            <span>
              {pet.name}
              {particle(pet.name, '이/가')} 많이 외로워해요. <b>{timeLeft(toHospital)}</b> 안에 돌봐 주지 않으면 병원에 가야 해요!
            </span>
          </div>
        )}

        <StatBars stats={pet.stats} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7 }}>
          <ActionButton emoji="🦮" label="산책" reward={cfg.walkReward} accent="#5FCFB4" sub={c.walk >= cfg.walkDailyLimit ? '오늘 완료 ✓' : `${fmt(cfg.walkSteps)}보`} disabled={c.walk >= cfg.walkDailyLimit} onClick={() => openMode('walk')} />
          <ActionButton
            emoji="🍚"
            label="밥 주기"
            reward={cfg.feedReward}
            accent="#FFB86B"
            sub={c.feed >= cfg.feedDailyLimit ? '오늘 완료 ✓' : feedWait > 0 ? `${timeLeft(feedWait)} 뒤` : sub('feed', cfg.feedDailyLimit)}
            disabled={c.feed >= cfg.feedDailyLimit}
            onClick={() => openMode('feed')}
          />
          <ActionButton emoji="🛁" label="목욕" reward={cfg.washReward} accent="#7FD3F5" sub={sub('wash', cfg.washDailyLimit)} disabled={c.wash >= cfg.washDailyLimit} onClick={() => openMode('wash')} />
          <ActionButton emoji="🎾" label="놀기" reward={cfg.playReward} accent="#FF8FAB" sub={sub('play', cfg.playDailyLimit)} disabled={c.play >= cfg.playDailyLimit} onClick={() => openMode('play')} />
          <ActionButton emoji="🌙" label="재우기" reward={cfg.sleepReward} accent="#B8A4FF" sub={c.sleep >= cfg.sleepDailyLimit ? '오늘 완료 ✓' : `폰 ${cfg.sleepMinutes}분 쉬기`} disabled={c.sleep >= cfg.sleepDailyLimit} onClick={() => openMode('sleep')} />
        </div>
      </div>
    </div>
  );
}
