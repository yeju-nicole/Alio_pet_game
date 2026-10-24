import { useEffect, useRef, useState } from 'react';
import { X, Footprints, Smartphone } from 'lucide-react';
import { useGame, particle, fmt } from '../store.jsx';
import { post } from '../api.js';
import Pet from '../components/Pet.jsx';
import { OutdoorScene } from '../components/Scenes.jsx';
import { Ring, Confetti } from '../components/UI.jsx';
import { useSky } from '../lib/hooks.js';
import { hasMotionSensor, requestMotionPermission, startPedometer, keepScreenOn, buzz } from '../lib/device.js';

const STEP_M = 0.7;
const CO2_G_PER_M = 0.21;

export default function WalkMode({ onClose }) {
  const { state, run, toast } = useGame();
  const { pet, settings } = state;
  const { sky } = useSky();
  const [phase, setPhase] = useState('intro');
  const [session, setSession] = useState(null);
  const [steps, setSteps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [noSignal, setNoSignal] = useState(false);
  const [result, setResult] = useState(null);
  const [moving, setMoving] = useState(false);

  const layers = useRef({});
  const panel = useRef(null);
  const sceneBox = useRef(null);
  const [panelH, setPanelH] = useState(260);
  const [scale, setScale] = useState(1);
  const stepTimes = useRef([]);
  const pedo = useRef(null);
  const release = useRef(() => {});
  const startedAt = useRef(0);
  const finishing = useRef(false);

  const target = session?.target ?? settings.walkSteps;
  const minSeconds = session?.minSeconds ?? Math.ceil(target / 3.2);

  // Parallax scrolling driven by recent step cadence.
  useEffect(() => {
    let raf;
    let last = performance.now();
    let offset = 0;
    let speed = 0;
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const recent = stepTimes.current.filter((x) => t - x < 2000).length;
      const goal = phase === 'walking' ? recent * 9 : phase === 'intro' ? 6 : 0;
      speed += (goal - speed) * Math.min(1, dt * 3);
      offset += speed * dt;
      const L = layers.current;
      if (L.far) L.far.setAttribute('transform', `translate(${-((offset * 0.12) % 400)} 0)`);
      if (L.mid) L.mid.setAttribute('transform', `translate(${-((offset * 0.45) % 400)} 0)`);
      if (L.near) L.near.setAttribute('transform', `translate(${-(offset % 400)} 0)`);
      const isMoving = speed > 3;
      setMoving((m) => (m !== isMoving ? isMoving : m));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Keep the park (and the path the pet walks on) above the bottom panel.
  useEffect(() => {
    if (!panel.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      setPanelH(panel.current.offsetHeight);
      const box = sceneBox.current;
      // Matches the SVG's "slice" scaling so the pet stands on the drawn path.
      if (box) setScale(Math.max(box.offsetWidth / 400, box.offsetHeight / 640));
    });
    ro.observe(panel.current);
    if (sceneBox.current) ro.observe(sceneBox.current);
    return () => ro.disconnect();
  }, []);

  // Clock while walking.
  useEffect(() => {
    if (phase !== 'walking') return undefined;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(
    () => () => {
      pedo.current?.stop();
      release.current();
    },
    [],
  );

  async function start() {
    if (!settings.demoMode && !hasMotionSensor()) {
      toast('이 기기에서는 걸음 수를 셀 수 없어요.\n휴대폰으로 접속해 주세요 📱', 'error', 4000);
      return;
    }
    const allowed = settings.demoMode || (await requestMotionPermission());
    if (!allowed) {
      toast('동작 센서 권한을 허용해야 걸음 수를 셀 수 있어요', 'error', 4000);
      return;
    }
    let s;
    try {
      s = await run('/pet/walk/start');
    } catch {
      return;
    }
    setSession(s);
    setSteps(0);
    startedAt.current = Date.now();
    setPhase('walking');
    release.current = await keepScreenOn();
    pedo.current = startPedometer(() => {
      stepTimes.current = [...stepTimes.current.slice(-20), performance.now()];
      setSteps((n) => n + 1);
    });
    setTimeout(() => {
      if (pedo.current && !pedo.current.receiving) setNoSignal(true);
    }, 6000);
  }

  // Finish once the goal is reached and enough time has passed to be believable.
  useEffect(() => {
    if (phase !== 'walking' || finishing.current) return;
    const ready = steps >= target && (settings.demoMode || elapsed >= minSeconds);
    if (!ready) return;
    finishing.current = true;
    (async () => {
      try {
        const data = await run('/pet/walk/complete', { sessionId: session.sessionId, steps }, { quiet: true });
        pedo.current?.stop();
        release.current();
        buzz([30, 60, 30]);
        setResult(data);
        setPhase('done');
      } catch (e) {
        if (e.code === 'too_fast' || e.code === 'network') {
          // Clocks can differ by a few seconds; quietly try again shortly.
          setTimeout(() => (finishing.current = false), 5000);
        } else {
          pedo.current?.stop();
          release.current();
          toast(e.message, 'error');
          onClose();
        }
      }
    })();
  }, [steps, elapsed, phase, target, minSeconds, settings.demoMode, session, run, toast, onClose]);

  async function quit() {
    pedo.current?.stop();
    release.current();
    if (session && phase === 'walking') post('/pet/walk/cancel', { sessionId: session.sessionId }).catch(() => {});
    onClose();
  }

  const shown = phase === 'done' ? result?.steps ?? steps : steps;
  const meters = Math.round(shown * STEP_M);
  const co2 = Math.round(meters * CO2_G_PER_M);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const stepsLeft = Math.max(0, target - steps);
  const waitLeft = Math.max(0, minSeconds - elapsed);

  return (
    <div className="mode">
      <div ref={sceneBox} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: panelH - 30 }}>
        <OutdoorScene sky={sky} ref={layers} />
        <div className="pet-slot" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 96 * scale, width: '40%', maxWidth: 190 }}>
          <div className={moving || phase === 'done' ? 'pet-bob' : ''}>
            <Pet species={pet.species} color={pet.color} mood="happy" equipped={pet.equipped} excited />
          </div>
        </div>
      </div>

      <div className="mode-head">
        <button className="icon-btn" onClick={quit} aria-label="산책 그만두기">
          <X size={22} />
        </button>
        <div className="mode-title">
          {sky.emoji} {sky.label} 산책
        </div>
      </div>

      {phase === 'done' && <Confetti />}

      <div className="mode-panel" ref={panel}>
        {phase === 'intro' && (
          <>
            <div className="cute" style={{ fontSize: 24 }}>
              {pet.name}
              {particle(pet.name, '과/와')} 산책 가요!
            </div>
            <p className="muted" style={{ margin: '6px 0 14px', fontSize: 14, lineHeight: 1.55 }}>
              진짜로 <b style={{ color: 'var(--mint-deep)' }}>{fmt(settings.walkSteps)}보</b>를 걸으면 산책 완료! 가까운 거리는 차 대신 걸어서 지구도 지켜요 🌏
            </p>
            <div className="notice" style={{ marginBottom: 16 }}>
              <Smartphone size={18} style={{ flex: 'none', marginTop: 1 }} />
              <span>휴대폰을 손에 들고 걸어 주세요. 화면이 켜져 있어야 걸음이 세져요.</span>
            </div>
            <button className="btn mint block" onClick={start}>
              <Footprints size={20} /> 산책 시작!
            </button>
          </>
        )}

        {phase === 'walking' && (
          <>
            <div className="row" style={{ gap: 16 }}>
              <Ring value={steps} max={target} size={96}>
                <div>
                  <div style={{ fontSize: 22 }}>🐾</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--mint-deep)' }}>{Math.min(100, Math.floor((steps / target) * 100))}%</div>
                </div>
              </Ring>
              <div style={{ flex: 1 }}>
                <div className="steps-big">
                  {fmt(steps)}
                  <span style={{ fontSize: 18, color: 'var(--ink-3)' }}> / {fmt(target)}보</span>
                </div>
                <div className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
                  {stepsLeft > 0 ? `${fmt(stepsLeft)}보만 더 걸으면 돼요!` : waitLeft > 0 ? `천천히~ ${waitLeft}초만 더 걸어 주세요` : '산책 완료 확인 중...'}
                </div>
              </div>
            </div>
            <div className="stat-pills">
              <div className="stat-pill">
                <b>{mm}:{ss}</b>
                <span>산책 시간</span>
              </div>
              <div className="stat-pill">
                <b>{fmt(meters)}m</b>
                <span>걸은 거리</span>
              </div>
              <div className="stat-pill">
                <b style={{ color: 'var(--mint-deep)' }}>{fmt(co2)}g</b>
                <span>CO₂ 절약</span>
              </div>
            </div>
            {noSignal && steps === 0 && (
              <div className="notice warn" style={{ marginBottom: 12 }}>
                걸음이 감지되지 않아요. 휴대폰을 손에 들고 걸어 보세요. 계속 안 되면 브라우저의 동작 센서 권한을 확인해 주세요.
              </div>
            )}
            {settings.demoMode && (
              <button className="btn butter block small" style={{ marginBottom: 10 }} onClick={() => setSteps(target)}>
                🎬 시연용: 걸음 채우기
              </button>
            )}
            <button className="btn ghost block small" onClick={quit}>
              오늘은 여기까지
            </button>
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="center">
              <div className="cute" style={{ fontSize: 26 }}>산책 완료! 🎉</div>
              <div className="points" style={{ fontSize: 22, margin: '4px 0 2px' }}>
                +{fmt(result?.reward)}P
              </div>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                {pet.name}
                {particle(pet.name, '이/가')} 신나게 꼬리를 흔들어요
              </p>
            </div>
            <div className="stat-pills">
              <div className="stat-pill">
                <b>{fmt(shown)}보</b>
                <span>걸음 수</span>
              </div>
              <div className="stat-pill">
                <b>{fmt(meters)}m</b>
                <span>걸은 거리</span>
              </div>
              <div className="stat-pill">
                <b style={{ color: 'var(--mint-deep)' }}>{fmt(co2)}g</b>
                <span>CO₂ 절약</span>
              </div>
            </div>
            <div className="notice mint" style={{ marginBottom: 14 }}>
              🌱 같은 거리를 자동차 대신 걸어서 이산화탄소를 약 {fmt(co2)}g 줄였어요!
            </div>
            <button className="btn block" onClick={onClose}>
              집으로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
