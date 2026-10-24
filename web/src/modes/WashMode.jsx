import { useEffect, useRef, useState } from 'react';
import { X, ShowerHead } from 'lucide-react';
import { useGame, particle, fmt } from '../store.jsx';
import Pet from '../components/Pet.jsx';
import { Confetti } from '../components/UI.jsx';
import { buzz } from '../lib/device.js';

const BASELINE = 40; // litres an average pet bath uses
const LPS = 4; // shower litres per second
const RINSE_SECONDS = 3.2;
const FOAM_GOAL = 26;
const DRY_TAPS = 5;

const STAGES = [
  { id: 'soap', title: '비누칠', tip: '멍냥이를 손가락으로 문질러 거품을 내 주세요' },
  { id: 'rinse', title: '헹구기', tip: '샤워기를 틀어 거품을 헹궈요. 다 헹구면 바로 물을 잠가 주세요!' },
  { id: 'dry', title: '말리기', tip: '수건을 톡톡 눌러 물기를 닦아 주세요' },
];

export default function WashMode({ onClose }) {
  const { state, run } = useGame();
  const { pet } = state;
  const [stage, setStage] = useState(0);
  const [foam, setFoam] = useState([]);
  const [rinsed, setRinsed] = useState(0);
  const [water, setWater] = useState(0);
  const [showering, setShowering] = useState(false);
  const [dry, setDry] = useState(0);
  const [sparkles, setSparkles] = useState([]);
  const [result, setResult] = useState(null);
  const area = useRef(null);
  const lastPt = useRef(null);
  const sending = useRef(false);

  // Shower: water flows only while held.
  useEffect(() => {
    if (!showering) return undefined;
    let last = performance.now();
    let raf;
    const loop = (t) => {
      const dt = (t - last) / 1000;
      last = t;
      setWater((w) => w + LPS * dt);
      setRinsed((r) => Math.min(1, r + dt / RINSE_SECONDS));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showering]);

  // Rinsing is done only once the player remembers to turn the water off.
  useEffect(() => {
    if (stage === 1 && rinsed >= 1 && !showering) {
      buzz(20);
      const t = setTimeout(() => setStage(2), 350);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [rinsed, stage, showering]);

  function rub(e) {
    if (stage !== 0 || !area.current) return;
    const rect = area.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const prev = lastPt.current;
    lastPt.current = { x, y };
    if (prev && Math.hypot(prev.x - x, prev.y - y) < 4) return;
    if (y < 6 || y > 70 || x < 8 || x > 92) return;
    setFoam((f) => {
      const next = [...f, { x, y, s: 0.7 + Math.random() * 0.7, id: Math.random() }];
      if (next.length >= FOAM_GOAL) {
        buzz(20);
        setTimeout(() => setStage(1), 350);
      }
      return next.slice(-40);
    });
  }

  async function towel() {
    if (stage !== 2 || sending.current) return;
    buzz(10);
    const id = Math.random();
    setSparkles((s) => [...s, { id, x: 20 + Math.random() * 60, y: 20 + Math.random() * 50 }]);
    setTimeout(() => setSparkles((s) => s.filter((x) => x.id !== id)), 900);
    const n = dry + 1;
    setDry(n);
    if (n >= DRY_TAPS) {
      sending.current = true;
      try {
        const data = await run('/pet/wash', { waterUsed: Math.round(water) });
        setResult(data);
        setStage(3);
      } catch {
        sending.current = false;
      }
    }
  }

  const foamVisible = stage === 0 ? foam : foam.slice(0, Math.round(foam.length * (1 - rinsed)));
  const liters = Math.round(water);
  const pct = stage === 0 ? foam.length / FOAM_GOAL : stage === 1 ? rinsed : stage === 2 ? dry / DRY_TAPS : 1;

  return (
    <div className="mode" style={{ background: '#E3F6F4' }}>
      {/* bathroom */}
      <svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <defs>
          <pattern id="tiles" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#D6F1EE" />
            <rect x="1.5" y="1.5" width="37" height="37" rx="6" fill="#E6F8F6" />
          </pattern>
        </defs>
        <rect width="400" height="640" fill="url(#tiles)" />
        <circle cx="70" cy="120" r="22" fill="#fff" opacity="0.6" />
        <circle cx="340" cy="190" r="14" fill="#fff" opacity="0.5" />
        <rect x="0" y="470" width="400" height="170" fill="#BFE6E1" />
      </svg>

      <div className="mode-head">
        <button className="icon-btn" onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
        <div className="mode-title">🛁 목욕 시간</div>
      </div>
      {stage === 3 && <Confetti />}

      {/* pet in the tub */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(var(--safe-top) + 64px)', bottom: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '88%', maxWidth: 380 }}>
          <div
            ref={area}
            onPointerMove={rub}
            onPointerDown={rub}
            style={{ position: 'relative', width: '74%', margin: '0 auto', touchAction: 'none', cursor: stage === 0 ? 'grab' : 'default' }}
          >
            <Pet species={pet.species} color={pet.color} mood={stage === 3 ? 'happy' : stage === 1 && showering ? 'happy' : 'normal'} equipped={{}} excited={stage === 3} />
            {foamVisible.map((b) => (
              <span
                key={b.id}
                style={{
                  position: 'absolute',
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: 34 * b.s,
                  height: 34 * b.s,
                  marginLeft: -17 * b.s,
                  marginTop: -17 * b.s,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%, #fff 0 30%, #E8F7FF 55%, #CDEBFF)',
                  boxShadow: 'inset -2px -3px 0 rgba(150,200,240,0.4)',
                  pointerEvents: 'none',
                  animation: 'pop-in 0.25s ease',
                }}
              />
            ))}
            {sparkles.map((s) => (
              <span key={s.id} className="sparkle" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                ✨
              </span>
            ))}
            {showering && (
              <div style={{ position: 'absolute', inset: '-30% 10% 30% 10%', pointerEvents: 'none', overflow: 'hidden' }}>
                {Array.from({ length: 18 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${(i * 37) % 100}%`,
                      top: -20,
                      width: 4,
                      height: 16,
                      borderRadius: 4,
                      background: '#7FD3F5',
                      opacity: 0.8,
                      animation: `rain 0.6s ${(i % 6) * 0.1}s linear infinite`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          {/* tub front */}
          <svg viewBox="0 0 300 110" style={{ width: '100%', marginTop: '-24%', position: 'relative', display: 'block' }} aria-hidden="true">
            <path d="M10 20 H290 Q284 96 220 104 H80 Q16 96 10 20 Z" fill="#fff" stroke="#BCE3EE" strokeWidth="4" />
            <rect x="0" y="10" width="300" height="18" rx="9" fill="#F2FBFF" stroke="#BCE3EE" strokeWidth="4" />
            <circle cx="60" cy="14" r="10" fill="#fff" opacity="0.9" />
            <circle cx="78" cy="8" r="7" fill="#fff" opacity="0.9" />
            <circle cx="236" cy="12" r="9" fill="#fff" opacity="0.9" />
            <text x="150" y="70" textAnchor="middle" fontSize="26">🦆</text>
          </svg>
        </div>
      </div>

      <div className="mode-panel">
        {stage < 3 ? (
          <>
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              {STAGES.map((s, i) => (
                <span key={s.id} className={`tag ${i === stage ? 'mint' : i < stage ? 'butter' : 'gray'}`}>
                  {i < stage ? '✓' : i + 1} {s.title}
                </span>
              ))}
              <span className="spacer" />
              <span className="tag" style={{ background: '#E3F4FF', color: '#2e7bb8' }}>
                💧 {liters}L
              </span>
            </div>
            <div className="bar" style={{ height: 10, marginBottom: 10 }}>
              <i style={{ width: `${Math.max(3, pct * 100)}%`, background: 'linear-gradient(90deg, #7FD3F5, #5FCFB4)' }} />
            </div>
            <p className="muted" style={{ margin: '0 0 14px', fontSize: 14 }}>
              {STAGES[stage].tip}
            </p>
            {stage === 1 && (
              <button
                className={`btn block ${showering && rinsed >= 1 ? 'pulse' : ''}`}
                style={
                  showering && rinsed >= 1
                    ? { background: 'var(--pink)', boxShadow: '0 5px 0 var(--pink-deep)' }
                    : { background: showering ? '#4FB9E8' : '#7FD3F5', boxShadow: '0 5px 0 #4FA8D6' }
                }
                onClick={() => setShowering((v) => !v)}
              >
                <ShowerHead size={22} />
                {!showering ? '샤워기 틀기' : rinsed >= 1 ? '다 헹궜어요! 물 잠그기 🚰' : '헹구는 중… (물 잠그기)'}
              </button>
            )}
            {stage === 2 && (
              <button className="btn butter block" onClick={towel}>
                🧺 톡톡 닦아 주기 ({dry}/{DRY_TAPS})
              </button>
            )}
            {stage === 0 && <div className="notice">🫧 거품이 {foam.length}/{FOAM_GOAL}개 생겼어요</div>}
          </>
        ) : (
          <>
            <div className="center">
              <div className="cute" style={{ fontSize: 26 }}>보송보송 깨끗해졌어요! 🫧</div>
              <div className="points" style={{ fontSize: 22, margin: '4px 0 2px' }}>
                +{fmt(result?.reward)}P
              </div>
              <p className="muted" style={{ margin: '4px 0 14px', fontSize: 14 }}>
                {pet.name}
                {particle(pet.name, '이/가')} 향기로워졌어요
              </p>
            </div>
            <div className={`notice ${result?.saved > 0 ? 'mint' : 'warn'}`} style={{ marginBottom: 14 }}>
              {result?.saved > 0
                ? `💧 물을 ${result.water}L만 썼어요! 보통 목욕(${BASELINE}L)보다 ${result.saved}L 아꼈어요.`
                : `💧 물을 ${result?.water}L 썼어요. 다음엔 샤워기를 필요할 때만 틀어 볼까요?`}
            </div>
            <button className="btn block" onClick={onClose}>
              좋아요
            </button>
          </>
        )}
      </div>
    </div>
  );
}
