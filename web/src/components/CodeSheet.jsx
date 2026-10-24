import { useRef, useState } from 'react';
import { Gift, Ticket } from 'lucide-react';
import { useGame, fmt } from '../store.jsx';
import { Sheet } from './UI.jsx';

/**
 * Enter an alio code.
 *  type="signup"  → 5-digit code from alio's website (500P)
 *  type="product" → XXXX-XXXX code that comes with an alio product (입양권)
 */
export default function CodeSheet({ type, initial = '', onClose, onSuccess }) {
  const { state, run, toast } = useGame();
  const signup = type === 'signup';
  const len = signup ? 5 : 8;
  const clean = (v) => (signup ? v.replace(/\D/g, '') : v.toUpperCase().replace(/[^A-Z0-9]/g, '')).slice(0, len);
  const [code, setCode] = useState(clean(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  const { settings } = state;

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const data = await run(signup ? '/codes/signup' : '/codes/product', { code }, { quiet: true });
      toast(signup ? `🎉 alio 회원가입 보너스 ${fmt(data.points)}P를 받았어요!` : '🎟️ 입양권을 받았어요! 새 친구를 만날 수 있어요', 'reward', 3500);
      onSuccess?.(data);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const display = signup ? code : code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

  return (
    <Sheet title={signup ? 'alio 회원가입 코드' : 'alio 제품 코드'} onClose={onClose}>
      <div className="notice mint" style={{ marginBottom: 16 }}>
        {signup ? <Gift size={18} style={{ flex: 'none', marginTop: 1 }} /> : <Ticket size={18} style={{ flex: 'none', marginTop: 1 }} />}
        <span>
          {signup ? (
            <>
              alio 웹사이트에 회원가입하면 받는 <b>5자리 숫자 코드</b>를 입력하면 <b>{fmt(settings.signupCodeReward)}P</b>를 드려요. (계정당 1번)
            </>
          ) : (
            <>
              alio 제품에 들어 있는 <b>8자리 코드</b>를 입력하면 <b>입양권 1장</b>을 받아요. 입양권으로 새 친구를 데려올 수 있어요.
            </>
          )}
        </span>
      </div>

      {signup ? (
        <div style={{ position: 'relative', margin: '6px 0 4px' }} onClick={() => input.current?.focus()}>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="cute"
                style={{
                  width: 52,
                  height: 62,
                  borderRadius: 16,
                  background: 'white',
                  border: `2.5px solid ${i === code.length ? 'var(--pink)' : code[i] ? 'var(--mint)' : 'var(--line)'}`,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 30,
                }}
              >
                {code[i] ?? ''}
              </div>
            ))}
          </div>
          <input
            ref={input}
            value={code}
            onChange={(e) => (setCode(clean(e.target.value)), setError(''))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            aria-label="5자리 코드"
            style={{ position: 'absolute', inset: 0, opacity: 0, fontSize: 16 }}
            onKeyDown={(e) => e.key === 'Enter' && code.length === len && submit()}
          />
        </div>
      ) : (
        <input
          className="input cute center"
          value={display}
          onChange={(e) => (setCode(clean(e.target.value)), setError(''))}
          placeholder="ABCD-1234"
          autoCapitalize="characters"
          autoFocus
          style={{ fontSize: 28, letterSpacing: 3 }}
          onKeyDown={(e) => e.key === 'Enter' && code.length === len && submit()}
        />
      )}

      {error && (
        <div className="error-text center" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
      <button className="btn block" style={{ marginTop: 18 }} disabled={code.length !== len || busy} onClick={submit}>
        {busy ? '확인 중…' : signup ? `${fmt(settings.signupCodeReward)}P 받기` : '입양권 받기'}
      </button>
      {signup && settings.alioSignupUrl && (
        <a href={settings.alioSignupUrl} target="_blank" rel="noreferrer" className="link-btn" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>
          아직 alio 회원이 아니라면? 회원가입하러 가기 →
        </a>
      )}
      {!signup && settings.alioStoreUrl && (
        <a href={settings.alioStoreUrl} target="_blank" rel="noreferrer" className="link-btn" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>
          alio 제품 보러 가기 →
        </a>
      )}
    </Sheet>
  );
}
