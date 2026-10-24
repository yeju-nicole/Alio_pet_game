import { useState } from 'react';
import { Leaf, Gift, Ticket, Store, Heart } from 'lucide-react';
import { useGame, particle, fmt } from '../store.jsx';
import Pet from '../components/Pet.jsx';
import { Confetti, Logo } from '../components/UI.jsx';
import { useNow, timeLeft } from '../lib/hooks.js';

function HospitalRoom({ children }) {
  return (
    <div className="scene" style={{ paddingTop: '74%' }}>
      <svg className="bg" viewBox="0 0 400 296" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="296" fill="#E4F6F2" />
        <rect y="200" width="400" height="96" fill="#CFEDE6" />
        <rect y="196" width="400" height="6" fill="#fff" opacity="0.8" />
        <g transform="translate(70 44)">
          <rect x="-26" y="-26" width="52" height="52" rx="14" fill="#fff" />
          <rect x="-7" y="-18" width="14" height="36" rx="4" fill="#FF7A8A" />
          <rect x="-18" y="-7" width="36" height="14" rx="4" fill="#FF7A8A" />
        </g>
        <rect x="270" y="30" width="96" height="84" rx="12" fill="#BDE6FF" stroke="#fff" strokeWidth="7" />
        <path d="M318 30 V114 M270 72 H366" stroke="#fff" strokeWidth="5" />
        {/* IV stand */}
        <rect x="320" y="120" width="5" height="120" rx="2.5" fill="#B8C4CF" />
        <rect x="306" y="120" width="34" height="5" rx="2.5" fill="#B8C4CF" />
        <rect x="308" y="126" width="16" height="26" rx="5" fill="#E7F7FF" stroke="#9FD3F2" strokeWidth="2" />
        <path d="M316 152 C316 190 270 196 250 214" stroke="#9FD3F2" strokeWidth="2" fill="none" />
        {/* bed */}
        <rect x="70" y="214" width="260" height="20" rx="10" fill="#fff" />
        <rect x="80" y="232" width="10" height="44" rx="4" fill="#C6D3DD" />
        <rect x="310" y="232" width="10" height="44" rx="4" fill="#C6D3DD" />
        <rect x="64" y="160" width="14" height="80" rx="7" fill="#C6D3DD" />
      </svg>
      {children}
      {/* blanket over the pet */}
      <svg viewBox="0 0 400 296" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
        <path d="M92 196 Q200 176 316 196 L322 226 Q200 240 86 226 Z" fill="#A9DCF5" />
        <path d="M92 196 Q200 176 316 196 L316 204 Q200 186 92 204 Z" fill="#fff" opacity="0.7" />
        {[130, 180, 230, 280].map((x) => (
          <circle key={x} cx={x} cy="214" r="4" fill="#fff" opacity="0.6" />
        ))}
      </svg>
    </div>
  );
}

export function HospitalScreen({ goEco, openCode }) {
  const { state, run, toast } = useGame();
  const { pet, user, settings } = state;
  const now = useNow(30000);
  const [busy, setBusy] = useState(false);
  const [healed, setHealed] = useState(false);
  const lacking = Math.max(0, settings.healCost - user.points);

  async function heal() {
    setBusy(true);
    try {
      await run('/pet/heal');
      setHealed(true);
      toast(`${pet.name}${particle(pet.name, '이/가')} 건강해져서 집으로 돌아왔어요! 💕`, 'reward', 3500);
    } catch {
      /* toast */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {healed && <Confetti />}
      <div style={{ margin: '0 14px', borderRadius: 26, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <HospitalRoom>
          <div className="pet-slot" style={{ bottom: '18%', width: '40%' }}>
            <Pet species={pet.species} color={pet.color} mood="sick" equipped={{}} />
          </div>
          <div className="bubble" style={{ left: '50%', bottom: '66%' }}>
            {pet.species === 'cat' ? '보고 싶었다냥… 🥺' : '보고 싶었다멍… 🥺'}
          </div>
        </HospitalRoom>
      </div>
      <div className="pad" style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <div className="card">
          <div className="cute" style={{ fontSize: 23 }}>
            {pet.name}
            {particle(pet.name, '이/가')} 병원에 입원했어요 🏥
          </div>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: '6px 0 12px' }}>
            {settings.hospitalAfterDays}일 넘게 돌봐 주지 않아서 아파요. 치료비 <b className="points">{fmt(settings.healCost)}P</b>를 내면 다시 집으로 데려올 수
            있어요.
          </p>
          <div className="notice pink" style={{ marginBottom: 14 }}>
            <Heart size={18} style={{ flex: 'none', marginTop: 1 }} />
            <span>
              <b>{timeLeft(pet.deathAt - now.getTime())}</b> 안에 치료하지 않으면 {pet.name}
              {particle(pet.name, '이/가')} 무지개다리를 건너요.
            </span>
          </div>
          <button className="btn block" disabled={lacking > 0 || busy} onClick={heal}>
            {lacking > 0 ? `${fmt(lacking)}P가 더 필요해요` : `치료하기 (${fmt(settings.healCost)}P)`}
          </button>
        </div>
        {lacking > 0 && (
          <div className="card">
            <b>포인트를 모으는 방법</b>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              <button className="btn mint small" onClick={goEco}>
                <Leaf size={16} /> 에코 미션 하고 포인트 받기
              </button>
              {!user.signupBonusClaimed && (
                <button className="btn butter small" onClick={() => openCode('signup')}>
                  <Gift size={16} /> alio 회원가입 코드로 {fmt(settings.signupCodeReward)}P 받기
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function MemorialScreen({ openCode }) {
  const { state, signOut } = useGame();
  const { pet, settings } = state;

  return (
    <div className="screen no-nav" style={{ background: 'linear-gradient(#DCD3FF 0%, #FFE1EC 45%, #FFF7F0 75%)' }}>
      <div style={{ position: 'relative', paddingTop: 'calc(var(--safe-top) + 16px)' }}>
        <Logo size={22} />
        <svg viewBox="0 0 400 220" style={{ width: '100%', display: 'block', marginTop: 4 }} aria-hidden="true">
          {['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#BDB2FF'].map((c, i) => (
            <path key={c} d={`M${30 + i * 12} 220 A${170 - i * 12} ${170 - i * 12} 0 0 1 ${370 - i * 12} 220`} stroke={c} strokeWidth="12" fill="none" opacity="0.8" />
          ))}
          <g fill="#fff" opacity="0.95">
            <ellipse cx="50" cy="210" rx="44" ry="18" />
            <ellipse cx="86" cy="200" rx="30" ry="18" />
            <ellipse cx="350" cy="210" rx="44" ry="18" />
            <ellipse cx="314" cy="200" rx="30" ry="18" />
          </g>
        </svg>
        <div className="pet-float" style={{ width: 170, margin: '-170px auto 0', position: 'relative' }}>
          <Pet species={pet.species} color={pet.color} mood="angel" equipped={pet.equipped} />
        </div>
      </div>
      <div className="pad" style={{ marginTop: 10 }}>
        <div className="card center">
          <div className="cute" style={{ fontSize: 24 }}>
            {pet.name}
            {particle(pet.name, '이/가')} 무지개다리를 건넜어요 🌈
          </div>
          <div className="tag lilac" style={{ margin: '10px 0 8px' }}>
            함께한 {pet.day}일 · {fmtDate(pet.adoptedAt)} ~ {fmtDate(pet.diedAt)}
          </div>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.65, margin: '6px 0 16px' }}>
            {settings.deathAfterDays}일 동안 돌봐 주지 못해서 {pet.name}
            {particle(pet.name, '이/가')} 별이 되었어요.
            <br />
            alio 제품을 구매하고 받은 <b>제품 코드</b>를 입력하면
            <br />
            새로운 친구를 입양할 수 있어요.
          </p>
          <button className="btn block" onClick={() => openCode('product')}>
            <Ticket size={18} /> 제품 코드 입력하고 새 친구 만나기
          </button>
          {settings.alioStoreUrl && (
            <a href={settings.alioStoreUrl} target="_blank" rel="noreferrer" className="btn ghost block" style={{ marginTop: 12, textDecoration: 'none' }}>
              <Store size={18} /> alio 제품 보러 가기
            </a>
          )}
        </div>
        <div className="center" style={{ marginTop: 14 }}>
          <button className="link-btn" onClick={signOut}>
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
