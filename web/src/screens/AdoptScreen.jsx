import { useState } from 'react';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { useGame, particle } from '../store.jsx';
import Pet, { PALETTES } from '../components/Pet.jsx';
import { Logo } from '../components/UI.jsx';

const COLORS = { dog: ['cream', 'choco', 'shiba'], cat: ['cheese', 'tuxedo', 'gray'] };
const NAME_IDEAS = { dog: ['초코', '보리', '콩이', '두부', '몽이'], cat: ['나비', '치즈', '모모', '코코', '루루'] };

export default function AdoptScreen({ again = false }) {
  const { run, state } = useGame();
  const [step, setStep] = useState(0);
  const [species, setSpecies] = useState('dog');
  const [color, setColor] = useState('cream');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = (s) => {
    setSpecies(s);
    setColor(COLORS[s][0]);
    setStep(1);
  };

  async function adopt() {
    setBusy(true);
    try {
      await run('/pet/adopt', { species, color, name: name.trim() });
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen no-nav" style={{ background: 'linear-gradient(#E6F7F1 0%, #FFF7F0 50%)' }}>
      <div style={{ padding: 'calc(var(--safe-top) + 14px) 16px 0' }} className="row">
        {step > 0 ? (
          <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label="이전">
            <ChevronLeft size={22} />
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
        <div className="spacer" />
        <Logo size={24} />
        <div className="spacer" />
        <div style={{ width: 40 }} />
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 6, margin: '14px 0 4px' }}>
        {[0, 1, 2].map((i) => (
          <i key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 8, background: i <= step ? 'var(--mint)' : '#e6dcd6', transition: 'all 0.3s' }} />
        ))}
      </div>

      {step === 0 && (
        <div className="pad">
          <h1 className="page-title center" style={{ margin: '14px 0 6px' }}>
            {again ? '새로운 친구를 만나요' : `${state.user.nickname}님, 반가워요!`}
          </h1>
          <p className="page-sub center" style={{ margin: '0 0 22px' }}>
            함께 지낼 친구를 골라 주세요.
            <br />
            산책하고, 밥 주고, 재워 주면서 함께 친환경 습관을 만들어요.
          </p>
          <div className="row" style={{ gap: 14 }}>
            {['dog', 'cat'].map((s) => (
              <button
                key={s}
                onClick={() => pick(s)}
                className="card"
                style={{ flex: 1, border: 0, cursor: 'pointer', padding: '18px 10px 16px', textAlign: 'center' }}
              >
                <div style={{ width: '100%', maxWidth: 150, margin: '0 auto' }}>
                  <Pet species={s} color={COLORS[s][0]} mood="happy" excited />
                </div>
                <div className="cute" style={{ fontSize: 24, marginTop: 6 }}>
                  {s === 'dog' ? '멍멍이' : '냥냥이'}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {s === 'dog' ? '산책을 정말 좋아해요' : '낮잠을 정말 좋아해요'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="pad">
          <h1 className="page-title center" style={{ margin: '14px 0 6px' }}>
            어떤 {species === 'dog' ? '멍멍이' : '냥냥이'}인가요?
          </h1>
          <div style={{ width: 220, margin: '0 auto' }} key={color} className="pet-hop">
            <Pet species={species} color={color} mood="happy" excited />
          </div>
          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            {COLORS[species].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="card"
                style={{
                  flex: 1,
                  border: c === color ? '3px solid var(--mint)' : '3px solid transparent',
                  padding: '8px 6px 10px',
                  cursor: 'pointer',
                }}
                aria-pressed={c === color}
              >
                <div style={{ width: 70, margin: '0 auto' }}>
                  <Pet species={species} color={c} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{PALETTES[c].label}</div>
              </button>
            ))}
          </div>
          <button className="btn mint block" style={{ marginTop: 22 }} onClick={() => setStep(2)}>
            이 친구로 할래요
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="pad">
          <h1 className="page-title center" style={{ margin: '14px 0 6px' }}>
            이름을 지어 주세요
          </h1>
          <div style={{ width: 190, margin: '0 auto' }}>
            <Pet species={species} color={color} mood={name ? 'happy' : 'normal'} excited={Boolean(name)} />
          </div>
          <input
            className="input cute center"
            style={{ fontSize: 24, padding: '14px', marginTop: 8 }}
            maxLength={10}
            placeholder="이름 (최대 10자)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            {NAME_IDEAS[species].map((n) => (
              <button key={n} className="tag gray" style={{ border: 0, cursor: 'pointer', fontSize: 13, padding: '7px 12px' }} onClick={() => setName(n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="notice mint" style={{ marginTop: 18 }}>
            <Sparkles size={18} style={{ flex: 'none', marginTop: 1 }} />
            <span>
              입양 선물로 <b>기본 사료 3개, 고구마 말랭이, 양말 인형</b>을 드려요!
            </span>
          </div>
          <button className="btn block" style={{ marginTop: 18 }} disabled={!name.trim() || busy} onClick={adopt}>
            {name.trim() ? `${name.trim()}${particle(name.trim(), '과/와')} 가족이 될래요` : '이름을 입력해 주세요'}
          </button>
        </div>
      )}
    </div>
  );
}
