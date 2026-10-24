import { useState } from 'react';
import { Eye, EyeOff, ChevronRight } from 'lucide-react';
import { post, timezone } from '../api.js';
import { useGame } from '../store.jsx';
import Pet from '../components/Pet.jsx';
import { Logo, Sheet } from '../components/UI.jsx';
import { TERMS, PRIVACY, MARKETING } from '../legal.js';

const DOCS = {
  terms: ['이용약관', TERMS],
  privacy: ['개인정보 수집·이용 동의', PRIVACY],
  marketing: ['마케팅 정보 수신 동의', MARKETING],
};

export default function AuthScreen({ pendingCode }) {
  const { setState } = useGame();
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const [agree, setAgree] = useState({ age: false, terms: false, privacy: false, marketing: false });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const allAgreed = agree.age && agree.terms && agree.privacy && agree.marketing;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && !(agree.age && agree.terms && agree.privacy)) {
      setError('필수 약관에 모두 동의해 주세요');
      return;
    }
    setBusy(true);
    try {
      const body =
        mode === 'login'
          ? { email: form.email, password: form.password, timezone: timezone() }
          : {
              ...form,
              agreeAge: agree.age,
              agreeTerms: agree.terms,
              agreePrivacy: agree.privacy,
              agreeMarketing: agree.marketing,
              timezone: timezone(),
            };
      setState(await post(mode === 'login' ? '/auth/login' : '/auth/signup', body));
    } catch (err) {
      setError(err.message);
      if (err.code === 'email_taken') setMode('login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen no-nav" style={{ background: 'linear-gradient(#FFE3EC 0%, #FFF7F0 46%)' }}>
      <div style={{ padding: 'calc(var(--safe-top) + 26px) 20px 0', textAlign: 'center' }}>
        <Logo size={40} />
        <p className="cute" style={{ fontSize: 17, color: 'var(--ink-2)', margin: '10px 0 0', lineHeight: 1.45 }}>
          걷고, 아끼고, 분리수거하면
          <br />
          우리 멍냥이가 쑥쑥 자라요 🌱
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 0, margin: '6px 0 -8px' }}>
          <div style={{ width: 132 }} className="pet-float">
            <Pet species="dog" color="cream" mood="happy" equipped={{ neck: 'bandana' }} excited />
          </div>
          <div style={{ width: 132, animationDelay: '-1.6s' }} className="pet-float">
            <Pet species="cat" color="cheese" mood="happy" equipped={{ head: 'ribbon' }} excited />
          </div>
        </div>
      </div>

      <div className="pad">
        {pendingCode && (
          <div className="notice mint" style={{ marginBottom: 12 }}>
            🎁 alio 회원가입 코드 <b>{pendingCode}</b>가 준비됐어요! 가입하거나 로그인하면 500P를 바로 받을 수 있어요.
          </div>
        )}
        <form className="card" onSubmit={submit} noValidate>
          <div className="segmented" style={{ marginBottom: 18 }}>
            <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => (setMode('signup'), setError(''))}>
              회원가입
            </button>
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => (setMode('login'), setError(''))}>
              로그인
            </button>
          </div>

          <label className="field">
            <span>이메일</span>
            <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="mung@example.com" value={form.email} onChange={set('email')} required />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'signup' ? '영문+숫자 8자 이상' : '비밀번호'}
                value={form.password}
                onChange={set('password')}
                style={{ paddingRight: 48 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                style={{ position: 'absolute', right: 6, top: 6, border: 0, background: 'none', padding: 8, color: 'var(--ink-3)', cursor: 'pointer' }}
              >
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>

          {mode === 'signup' && (
            <>
              <label className="field">
                <span>닉네임</span>
                <input className="input" maxLength={12} placeholder="멍냥이 집사님의 이름" value={form.nickname} onChange={set('nickname')} required />
              </label>

              <div style={{ background: '#FFF8F4', borderRadius: 16, padding: '6px 12px', margin: '4px 0 12px' }}>
                <label className="check" style={{ fontWeight: 800, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={allAgreed}
                    onChange={(e) => setAgree({ age: e.target.checked, terms: e.target.checked, privacy: e.target.checked, marketing: e.target.checked })}
                  />
                  <span className="grow">전체 동의하기</span>
                </label>
                {[
                  ['age', '[필수] 만 14세 이상이에요'],
                  ['terms', '[필수] 이용약관 동의', 'terms'],
                  ['privacy', '[필수] 개인정보 수집·이용 동의', 'privacy'],
                  ['marketing', '[선택] 이벤트·혜택 소식 받기', 'marketing'],
                ].map(([k, label, d]) => (
                  <label key={k} className="check">
                    <input type="checkbox" checked={agree[k]} onChange={(e) => setAgree((a) => ({ ...a, [k]: e.target.checked }))} />
                    <span className="grow">{label}</span>
                    {d && (
                      <button type="button" className="link-btn" onClick={(e) => (e.preventDefault(), setDoc(d))} style={{ fontSize: 12 }}>
                        보기
                      </button>
                    )}
                  </label>
                ))}
              </div>
            </>
          )}

          {error && <div className="error-text">{error}</div>}
          <button className="btn block" disabled={busy}>
            {busy ? <span className="spinner" style={{ width: 20, height: 20, borderTopColor: '#fff' }} /> : mode === 'signup' ? '가입하고 입양하러 가기' : '로그인'}
            {!busy && <ChevronRight size={20} />}
          </button>
          {mode === 'login' && (
            <p className="muted center" style={{ fontSize: 12.5, margin: '14px 0 0' }}>
              비밀번호를 잊으셨나요? 고객센터에 문의하면 임시 비밀번호를 보내드려요.
            </p>
          )}
        </form>

        <div className="row" style={{ justifyContent: 'center', gap: 16, margin: '22px 0 8px', fontSize: 13, color: 'var(--ink-2)' }}>
          <span>🚶 함께 산책</span>
          <span>📵 폰 내려놓기</span>
          <span>♻️ 에코 미션</span>
        </div>
      </div>

      {doc && (
        <Sheet title={DOCS[doc][0]} onClose={() => setDoc(null)}>
          <div style={{ whiteSpace: 'pre-line', fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>{DOCS[doc][1]}</div>
          <button
            className="btn block"
            style={{ marginTop: 18 }}
            onClick={() => {
              setAgree((a) => ({ ...a, [doc]: true }));
              setDoc(null);
            }}
          >
            동의하기
          </button>
        </Sheet>
      )}
    </div>
  );
}
