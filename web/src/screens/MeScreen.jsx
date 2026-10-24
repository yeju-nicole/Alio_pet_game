import { useEffect, useState } from 'react';
import { Gift, Ticket, LogOut, ChevronRight, KeyRound, Smartphone, Mail, FileText, Trash2, PencilLine } from 'lucide-react';
import { api, post } from '../api.js';
import { useGame, fmt, particle } from '../store.jsx';
import { Coin, Sheet } from '../components/UI.jsx';
import { TERMS, PRIVACY } from '../legal.js';
import { isStandalone } from '../lib/device.js';

const KIND_EMOJI = {
  walk: '🦮',
  feed: '🍚',
  wash: '🛁',
  play: '🎾',
  sleep: '🌙',
  shop: '🛍️',
  heal: '🏥',
  quiz: '💡',
  mission: '🌱',
  signup_code: '🎁',
  milestone: '🎉',
  admin: '💌',
};

function when(ts) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `오늘 ${time}` : `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

function MenuRow({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: 0, background: 'none', padding: '14px 4px', cursor: 'pointer', borderBottom: '1px solid var(--line)', color: danger ? 'var(--pink-deep)' : 'var(--ink)', fontSize: 15, fontWeight: 600 }}
    >
      <Icon size={19} />
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      <ChevronRight size={18} color="var(--ink-3)" />
    </button>
  );
}

export default function MeScreen({ openCode }) {
  const { state, setState, signOut, toast } = useGame();
  const { user, settings, pet } = state;
  const [impact, setImpact] = useState(null);
  const [history, setHistory] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    api('/impact').then(setImpact).catch(() => {});
    api('/wallet/history?limit=40')
      .then((d) => setHistory(d.items))
      .catch(() => {});
  }, [user.points]);

  const close = () => {
    setSheet(null);
    setForm({});
    setError('');
  };

  async function saveNickname() {
    try {
      setState(await api('/me', { method: 'PATCH', body: { nickname: form.nickname } }));
      toast('닉네임을 바꿨어요');
      close();
    } catch (e) {
      setError(e.message);
    }
  }

  async function changePassword() {
    try {
      await post('/me/password', { current: form.current, next: form.next });
      toast('비밀번호를 바꿨어요');
      close();
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteAccount() {
    try {
      await api('/me', { method: 'DELETE', body: { password: form.password } });
      await signOut();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">내 정보</h1>
      <p className="page-sub">
        {user.nickname}님, 오늘도 지구를 지켜 줘서 고마워요 🌏
      </p>

      <div className="pad" style={{ display: 'grid', gap: 12 }}>
        {/* wallet */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #FFE7A3, #FFF6D8)' }}>
          <div className="row">
            <div>
              <div style={{ fontSize: 13, color: '#8a6200', fontWeight: 700 }}>내 지갑</div>
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <Coin size={30} />
                <span className="cute" style={{ fontSize: 34, color: '#6b4a00' }}>
                  {fmt(user.points)}
                </span>
                <span style={{ fontWeight: 800, color: '#8a6200', marginTop: 6 }}>P</span>
              </div>
            </div>
            <span className="spacer" />
            {user.adoptionTickets > 0 && (
              <span className="tag lilac">
                <Ticket size={13} /> 입양권 {user.adoptionTickets}
              </span>
            )}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <button className="btn small" style={{ flex: 1 }} onClick={() => openCode('signup')} disabled={user.signupBonusClaimed}>
              <Gift size={16} /> {user.signupBonusClaimed ? '가입 보너스 받음 ✓' : `alio 가입 코드 (+${fmt(settings.signupCodeReward)}P)`}
            </button>
            <button className="btn small ghost" onClick={() => openCode('product')}>
              <Ticket size={16} /> 제품 코드
            </button>
          </div>
        </div>

        {!user.signupBonusClaimed && settings.alioSignupUrl && (
          <a
            href={settings.alioSignupUrl}
            target="_blank"
            rel="noreferrer"
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--ink)', background: 'linear-gradient(135deg, #DDF6EF, #fff)' }}
          >
            <span style={{ fontSize: 34 }}>🎁</span>
            <span style={{ flex: 1 }}>
              <b style={{ display: 'block' }}>alio 회원가입하고 {fmt(settings.signupCodeReward)}P 받기</b>
              <span className="muted" style={{ fontSize: 12.5 }}>
                가입 후 받은 5자리 코드를 위에 입력해 주세요
              </span>
            </span>
            <ChevronRight size={20} color="var(--ink-3)" />
          </a>
        )}

        {/* eco report */}
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <b style={{ fontSize: 16 }}>🌏 나의 에코 리포트</b>
          </div>
          {impact ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                ['🚶', `${fmt(impact.steps)}보`, '함께 걸은 걸음'],
                ['🌳', `${fmt(impact.co2SavedG)}g`, 'CO₂ 절약'],
                ['💧', `${fmt(impact.waterSaved)}L`, '아낀 물'],
                ['📵', `${fmt(impact.phoneFreeMinutes)}분`, '폰 쉬는 시간'],
                ['📸', `${fmt(impact.missions)}회`, '에코 미션'],
                ['💡', `${fmt(impact.quizCorrect)}개`, '퀴즈 정답'],
              ].map(([e, v, l]) => (
                <div key={l} style={{ background: '#FAF6F3', borderRadius: 16, padding: '10px 4px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20 }}>{e}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2 }}>{v}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{l}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="center">
              <span className="spinner" />
            </div>
          )}
        </div>

        {/* history */}
        <div className="card">
          <b style={{ fontSize: 16 }}>💰 포인트 내역</b>
          <div style={{ marginTop: 8 }}>
            {!history ? (
              <div className="center">
                <span className="spinner" />
              </div>
            ) : history.length === 0 ? (
              <div className="muted center" style={{ padding: 16, fontSize: 14 }}>
                아직 내역이 없어요. {pet ? `${pet.name}${particle(pet.name, '을/를')} 돌보면 포인트가 쌓여요!` : ''}
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid #f6eee9' }}>
                  <span style={{ fontSize: 22, width: 32, textAlign: 'center' }}>{KIND_EMOJI[h.kind] ?? '✨'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.memo}</span>
                    <span className="muted" style={{ fontSize: 11.5 }}>{when(h.at)}</span>
                  </span>
                  <b style={{ color: h.amount > 0 ? 'var(--mint-deep)' : 'var(--pink-deep)', fontSize: 15 }}>
                    {h.amount > 0 ? '+' : ''}
                    {fmt(h.amount)}P
                  </b>
                </div>
              ))
            )}
          </div>
        </div>

        {/* settings */}
        <div className="card" style={{ padding: '4px 16px' }}>
          <div className="row" style={{ padding: '14px 4px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>{user.nickname}</div>
              <div className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
          </div>
          <MenuRow icon={PencilLine} label="닉네임 바꾸기" onClick={() => (setForm({ nickname: user.nickname }), setSheet('nickname'))} />
          <MenuRow icon={KeyRound} label="비밀번호 바꾸기" onClick={() => setSheet('password')} />
          {!isStandalone() && <MenuRow icon={Smartphone} label="홈 화면에 앱 추가하기" onClick={() => setSheet('install')} />}
          <MenuRow icon={FileText} label="이용약관" onClick={() => setSheet('terms')} />
          <MenuRow icon={FileText} label="개인정보 처리 안내" onClick={() => setSheet('privacy')} />
          {settings.supportEmail && <MenuRow icon={Mail} label="고객센터 문의" onClick={() => (window.location.href = `mailto:${settings.supportEmail}`)} />}
          <MenuRow icon={LogOut} label="로그아웃" onClick={signOut} />
          <MenuRow icon={Trash2} label="회원 탈퇴" danger onClick={() => setSheet('delete')} />
        </div>
        <div className="muted center" style={{ fontSize: 11.5, padding: '4px 0 8px' }}>
          alio 멍냥이 · 친환경 행동으로 키우는 디지털 반려동물
        </div>
      </div>

      {sheet === 'nickname' && (
        <Sheet title="닉네임 바꾸기" onClose={close}>
          <input className="input" maxLength={12} value={form.nickname ?? ''} onChange={(e) => setForm({ nickname: e.target.value })} autoFocus />
          {error && <div className="error-text">{error}</div>}
          <button className="btn block" style={{ marginTop: 14 }} onClick={saveNickname}>
            저장하기
          </button>
        </Sheet>
      )}
      {sheet === 'password' && (
        <Sheet title="비밀번호 바꾸기" onClose={close}>
          <label className="field">
            <span>현재 비밀번호</span>
            <input className="input" type="password" autoComplete="current-password" onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} />
          </label>
          <label className="field">
            <span>새 비밀번호 (영문+숫자 8자 이상)</span>
            <input className="input" type="password" autoComplete="new-password" onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} />
          </label>
          {error && <div className="error-text">{error}</div>}
          <button className="btn block" onClick={changePassword}>
            바꾸기
          </button>
        </Sheet>
      )}
      {sheet === 'delete' && (
        <Sheet title="정말 떠나시나요? 😢" onClose={close}>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
            탈퇴하면 {pet ? `${pet.name}${particle(pet.name, '과/와')}의 추억, ` : ''}포인트, 아이템이 모두 사라지고 되돌릴 수 없어요.
          </p>
          <label className="field">
            <span>비밀번호 확인</span>
            <input className="input" type="password" onChange={(e) => setForm({ password: e.target.value })} />
          </label>
          {error && <div className="error-text">{error}</div>}
          <button className="btn block" style={{ background: '#ff6b6b', boxShadow: '0 5px 0 #e04848' }} onClick={deleteAccount}>
            탈퇴하기
          </button>
        </Sheet>
      )}
      {sheet === 'install' && (
        <Sheet title="홈 화면에 추가하기" onClose={close}>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-2)' }}>
            <b style={{ color: 'var(--ink)' }}>아이폰 (Safari)</b>
            <br />
            아래 공유 버튼 <b>⬆︎</b> → <b>홈 화면에 추가</b>
            <br />
            <br />
            <b style={{ color: 'var(--ink)' }}>안드로이드 (Chrome · 삼성 인터넷)</b>
            <br />
            오른쪽 위 메뉴 <b>⋮</b> → <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>
            <br />
            <br />
            홈 화면에서 앱처럼 바로 멍냥이를 만날 수 있어요!
          </div>
        </Sheet>
      )}
      {(sheet === 'terms' || sheet === 'privacy') && (
        <Sheet title={sheet === 'terms' ? '이용약관' : '개인정보 처리 안내'} onClose={close}>
          <div style={{ whiteSpace: 'pre-line', fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>{sheet === 'terms' ? TERMS : PRIVACY}</div>
        </Sheet>
      )}
    </div>
  );
}
