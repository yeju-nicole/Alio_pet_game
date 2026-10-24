import { useEffect, useRef, useState } from 'react';
import { X, Moon } from 'lucide-react';
import { useGame, particle, fmt } from '../store.jsx';
import { post } from '../api.js';
import Pet from '../components/Pet.jsx';
import { Confetti } from '../components/UI.jsx';
import { keepScreenOn, buzz } from '../lib/device.js';

function Bedroom({ dim, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: dim ? '#05060f' : 'linear-gradient(#1d2357, #3a3f7d 60%, #4b4f8f)', transition: 'background 1.2s' }}>
      <svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: dim ? 0.35 : 1, transition: 'opacity 1.2s' }} aria-hidden="true">
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={i} cx={(i * 137) % 400} cy={(i * 89) % 300} r={(i % 3) * 0.6 + 0.7} fill="#fff" style={{ animation: `twinkle ${2 + (i % 4)}s ${i % 3}s infinite` }} />
        ))}
        <g transform="translate(300 120)">
          <circle r="40" fill="#FFF6C8" opacity="0.12" />
          <circle r="26" fill="#FFF1B0" />
          <circle cx="12" cy="-8" r="22" fill="#1d2357" />
        </g>
      </svg>
      {children}
    </div>
  );
}

export default function SleepMode({ onClose }) {
  const { state, run, toast } = useGame();
  const { pet, settings } = state;
  const [phase, setPhase] = useState('intro');
  const [session, setSession] = useState(null);
  const [left, setLeft] = useState(settings.sleepMinutes * 60);
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState(null);
  const endAt = useRef(0);
  const release = useRef(() => {});
  const done = useRef(false);

  const fail = (why) => {
    if (done.current) return;
    done.current = true;
    release.current();
    if (session) post('/pet/sleep/cancel', { sessionId: session.sessionId }).catch(() => {});
    setPhase('woke');
    if (why) toast(why, 'error');
  };

  async function start() {
    let s;
    try {
      s = await run('/pet/sleep/start');
    } catch {
      return;
    }
    done.current = false;
    setSession(s);
    endAt.current = Date.now() + s.minutes * 60000;
    setLeft(s.minutes * 60);
    release.current = await keepScreenOn();
    setPhase('sleeping');
  }

  // Countdown, heartbeat and the "don't leave the app" rule.
  useEffect(() => {
    if (phase !== 'sleeping' || !session) return undefined;
    const tick = setInterval(() => setLeft(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))), 500);
    const ping = setInterval(() => {
      post('/pet/sleep/ping', { sessionId: session.sessionId }).catch((e) => {
        if (e.code === 'sleep_interrupted' || e.code === 'no_session') fail();
      });
    }, (session.pingSeconds || 45) * 1000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') fail();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(tick);
      clearInterval(ping);
      document.removeEventListener('visibilitychange', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session]);

  useEffect(() => {
    if (phase !== 'sleeping' || left > 0 || done.current) return;
    done.current = true;
    (async () => {
      try {
        const data = await run('/pet/sleep/complete', { sessionId: session.sessionId });
        release.current();
        buzz([40, 80, 40]);
        setResult(data);
        setPhase('done');
      } catch (e) {
        release.current();
        setPhase(e.code === 'sleep_interrupted' ? 'woke' : 'intro');
      }
    })();
  }, [left, phase, session, run]);

  useEffect(() => () => release.current(), []);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const sleeping = phase === 'sleeping';

  return (
    <div className="mode" style={{ background: '#05060f' }}>
      <Bedroom dim={sleeping}>
        <div
          style={{ position: 'absolute', left: '50%', top: sleeping ? '36%' : '20%', width: '46%', maxWidth: 220, transform: 'translateX(-50%)', opacity: sleeping ? 0.55 : 1, transition: 'opacity 1.2s, top 0.6s ease' }}
          onClick={() => sleeping && (setHint(true), setTimeout(() => setHint(false), 2200))}
        >
          <div style={{ position: 'absolute', left: '-18%', right: '-18%', bottom: '-6%', height: '26%', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 40%, #B3A9F0, #8F86D9 70%)' }} />
          <Pet species={pet.species} color={pet.color} mood={phase === 'done' ? 'happy' : phase === 'woke' ? 'sad' : sleeping ? 'sleeping' : 'sleepy'} equipped={pet.equipped} />
          {sleeping && (
            <div className="cute" style={{ position: 'absolute', right: -8, top: -10, color: '#C9C2FF', fontSize: 26, animation: 'floaty 3s ease-in-out infinite' }}>
              Z<span style={{ fontSize: 20 }}>z</span>
              <span style={{ fontSize: 15 }}>z</span>
            </div>
          )}
        </div>
      </Bedroom>

      {!sleeping && (
        <div className="mode-head">
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <X size={22} />
          </button>
          <div className="mode-title">🌙 재우기</div>
        </div>
      )}
      {phase === 'done' && <Confetti />}

      {sleeping ? (
        <div style={{ position: 'relative', zIndex: 3, marginTop: 'calc(var(--safe-top) + 70px)', textAlign: 'center', color: '#B9B3E6' }}>
          <div className="cute" style={{ fontSize: 64, color: '#E7E3FF', letterSpacing: 2 }}>
            {mm}:{ss}
          </div>
          <div style={{ fontSize: 15, marginTop: 6 }}>쉿… {pet.name}{particle(pet.name, '이/가')} 자고 있어요</div>
          <div style={{ fontSize: 13, marginTop: 4, opacity: 0.75 }}>휴대폰을 내려놓고 잠깐 쉬어요 📵</div>
          {hint && <div className="toast" style={{ display: 'inline-block', marginTop: 16, background: '#2b2f66' }}>깨우면 안 돼요… 조금만 기다려 주세요 🤫</div>}
          {settings.demoMode && (
            <div>
              <button className="btn butter small" style={{ marginTop: 18 }} onClick={() => (endAt.current = Date.now())}>
                🎬 시연용: 바로 완료
              </button>
            </div>
          )}
          <button
            onClick={() => fail()}
            style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(var(--safe-bottom) + 30px)', background: 'none', border: '1px solid #3b3f70', color: '#7d78a8', borderRadius: 99, padding: '10px 18px', cursor: 'pointer' }}
          >
            깨우기 (그만두기)
          </button>
        </div>
      ) : (
        <div className="mode-panel">
          {phase === 'intro' && (
            <>
              <div className="cute" style={{ fontSize: 24 }}>
                {pet.name}
                {particle(pet.name, '이/가')} 졸려 해요
              </div>
              <p className="muted" style={{ margin: '6px 0 14px', fontSize: 14, lineHeight: 1.55 }}>
                <b style={{ color: '#7b63e8' }}>{settings.sleepMinutes}분 동안 휴대폰을 내려놓으면</b> {pet.name}
                {particle(pet.name, '이/가')} 푹 잘 수 있어요. 디지털 디톡스로 전기도 아끼고 눈도 쉬어요!
              </p>
              <div className="notice" style={{ marginBottom: 16, background: '#efeaff', color: '#5b48b8' }}>
                <Moon size={18} style={{ flex: 'none', marginTop: 1 }} />
                <span>앱을 켜 둔 채로 내려놓아 주세요. 다른 앱을 열거나 화면을 끄면 {pet.name}{particle(pet.name, '이/가')} 깨요.</span>
              </div>
              <button className="btn block" style={{ background: '#9d8cf5', boxShadow: '0 5px 0 #7b63e8' }} onClick={start}>
                재우기 시작 ({settings.sleepMinutes}분)
              </button>
            </>
          )}
          {phase === 'woke' && (
            <>
              <div className="cute" style={{ fontSize: 24 }}>앗, {pet.name}{particle(pet.name, '이/가')} 깼어요!</div>
              <p className="muted" style={{ margin: '6px 0 16px', fontSize: 14, lineHeight: 1.55 }}>
                휴대폰을 사용하면 잠에서 깨요. 이번엔 정말 내려놓고 쉬어 볼까요?
              </p>
              <button className="btn block" style={{ background: '#9d8cf5', boxShadow: '0 5px 0 #7b63e8' }} onClick={start}>
                다시 재우기
              </button>
            </>
          )}
          {phase === 'done' && (
            <>
              <div className="center">
                <div className="cute" style={{ fontSize: 26 }}>푹 잤어요! ✨</div>
                <div className="points" style={{ fontSize: 22, margin: '4px 0 2px' }}>
                  +{fmt(result?.reward)}P
                </div>
                <p className="muted" style={{ margin: '4px 0 14px', fontSize: 14 }}>
                  휴대폰 없이 {result?.minutes}분! 에너지가 가득 찼어요
                </p>
              </div>
              <div className="notice mint" style={{ marginBottom: 14 }}>
                📵 잠깐 화면을 쉬는 것만으로도 전기를 아끼고 디지털 탄소 발자국을 줄일 수 있어요.
              </div>
              <button className="btn block" onClick={onClose}>
                좋아요
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
