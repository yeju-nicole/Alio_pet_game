import { useEffect, useRef, useState } from 'react';
import { useGame, particle, fmt } from './store.jsx';
import { TopBar, BottomNav } from './components/Chrome.jsx';
import { Toasts, Modal, Confetti, Logo } from './components/UI.jsx';
import CodeSheet from './components/CodeSheet.jsx';
import Pet from './components/Pet.jsx';
import AuthScreen from './screens/AuthScreen.jsx';
import AdoptScreen from './screens/AdoptScreen.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import EcoScreen from './screens/EcoScreen.jsx';
import ShopScreen from './screens/ShopScreen.jsx';
import ClosetScreen from './screens/ClosetScreen.jsx';
import MeScreen from './screens/MeScreen.jsx';
import { HospitalScreen, MemorialScreen } from './screens/CareScreens.jsx';
import WalkMode from './modes/WalkMode.jsx';
import SleepMode from './modes/SleepMode.jsx';
import WashMode from './modes/WashMode.jsx';
import { FeedMode, PlayMode } from './modes/FeedPlay.jsx';

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

/** Codes handed over from alio's website: /?code=12345 or /?product=ABCD-1234 */
let deepLinkOnce;
function readDeepLink() {
  if (deepLinkOnce !== undefined) return deepLinkOnce;
  const p = new URLSearchParams(window.location.search);
  const code = p.get('code');
  const product = p.get('product');
  if (code || product) window.history.replaceState(null, '', window.location.pathname);
  deepLinkOnce = code ? { type: 'signup', initial: code } : product ? { type: 'product', initial: product } : null;
  return deepLinkOnce;
}

function Welcome({ pet, settings, onClose }) {
  return (
    <>
      <Confetti />
      <Modal onClose={onClose}>
        <div style={{ width: 140, margin: '-10px auto 0' }}>
          <Pet species={pet.species} color={pet.color} mood="happy" excited />
        </div>
        <h3>
          {pet.name}
          {particle(pet.name, '과/와')} 가족이 되었어요!
        </h3>
        <div className="tag" style={{ marginBottom: 12 }}>
          오늘부터 D+1 💕
        </div>
        <div style={{ textAlign: 'left', fontSize: 13.5, lineHeight: 1.6, display: 'grid', gap: 8, margin: '4px 0 18px' }}>
          <div>🦮 진짜로 <b>{fmt(settings.walkSteps)}보</b> 걸으면 산책 완료</div>
          <div>🌙 휴대폰을 <b>{settings.sleepMinutes}분</b> 내려놓으면 꿀잠</div>
          <div>🌱 텀블러·분리수거 같은 <b>에코 미션</b>으로 포인트 받기</div>
          <div style={{ color: 'var(--pink-deep)' }}>
            ⚠️ {settings.hospitalAfterDays}일 동안 돌보지 않으면 병원에, {settings.deathAfterDays}일이면 무지개다리를 건너요
          </div>
        </div>
        <button className="btn block" onClick={onClose}>
          시작하기
        </button>
      </Modal>
    </>
  );
}

function Celebration({ c, onClose }) {
  return (
    <>
      <Confetti count={90} />
      <Modal onClose={onClose}>
        <div style={{ fontSize: 64 }}>🎉</div>
        <h3>
          {c.petName}
          {particle(c.petName, '과/와')} {c.title}!
        </h3>
        <p>
          D+{c.day} 기념 선물을 받았어요
          <br />
          <span className="points" style={{ fontSize: 22 }}>
            +{fmt(c.reward)}P
          </span>
        </p>
        <button className="btn block" onClick={onClose}>
          고마워요 💕
        </button>
      </Modal>
    </>
  );
}

function MainShell({ deepLink, clearDeepLink }) {
  const { state, celebrations, dismissCelebration } = useGame();
  const { pet, settings, user } = state;
  const [tab, setTab] = useState('home');
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState(null);
  const [welcome, setWelcome] = useState(() => !store.get(`mn_welcome_${pet.id}`));
  const scroller = useRef(null);

  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [tab]);

  useEffect(() => {
    if (deepLink && !welcome) {
      if (!(deepLink.type === 'signup' && user.signupBonusClaimed)) setCode(deepLink);
      clearDeepLink();
    }
  }, [deepLink, welcome, user.signupBonusClaimed, clearDeepLink]);

  const openCode = (type) => setCode({ type, initial: '' });
  const goShop = () => {
    setMode(null);
    setTab('shop');
  };
  const closeMode = () => setMode(null);
  const ecoBadge = !state.today.quizDone;

  let screen;
  if (tab === 'home') {
    screen = pet.status === 'hospital' ? <HospitalScreen goEco={() => setTab('eco')} openCode={openCode} /> : <HomeScreen openMode={setMode} />;
  } else if (tab === 'eco') screen = <EcoScreen />;
  else if (tab === 'shop') screen = <ShopScreen />;
  else if (tab === 'closet') screen = <ClosetScreen goShop={() => setTab('shop')} />;
  else screen = <MeScreen openCode={openCode} />;

  return (
    <>
      <TopBar onWallet={() => setTab('me')} />
      <main className="screen" ref={scroller}>
        {screen}
      </main>
      <BottomNav tab={tab} setTab={setTab} ecoBadge={ecoBadge} />

      {mode === 'walk' && <WalkMode onClose={closeMode} />}
      {mode === 'sleep' && <SleepMode onClose={closeMode} />}
      {mode === 'wash' && <WashMode onClose={closeMode} />}
      {mode === 'feed' && <FeedMode onClose={closeMode} goShop={goShop} />}
      {mode === 'play' && <PlayMode onClose={closeMode} />}

      {code && <CodeSheet type={code.type} initial={code.initial} onClose={() => setCode(null)} />}
      {welcome && (
        <Welcome
          pet={pet}
          settings={settings}
          onClose={() => {
            store.set(`mn_welcome_${pet.id}`, '1');
            setWelcome(false);
          }}
        />
      )}
      {!welcome && !mode && celebrations[0] && <Celebration c={celebrations[0]} onClose={dismissCelebration} />}
    </>
  );
}

export default function App() {
  const { state } = useGame();
  const [deepLink, setDeepLink] = useState(readDeepLink);
  const [memorialCode, setMemorialCode] = useState(null);
  const clearDeepLink = useRef(() => setDeepLink(null)).current;

  let body;
  if (state === undefined) {
    body = (
      <div className="splash">
        <Logo size={40} />
        <span className="spinner" />
      </div>
    );
  } else if (state === null) {
    body = <AuthScreen pendingCode={deepLink?.type === 'signup' ? deepLink.initial : null} />;
  } else if (!state.pet || (state.pet.status === 'dead' && state.user.adoptionTickets > 0)) {
    body = <AdoptScreen again={Boolean(state.pet)} />;
  } else if (state.pet.status === 'dead') {
    body = (
      <>
        <MemorialScreen openCode={() => setMemorialCode({ type: 'product', initial: deepLink?.type === 'product' ? deepLink.initial : '' })} />
        {memorialCode && <CodeSheet type="product" initial={memorialCode.initial} onClose={() => setMemorialCode(null)} />}
      </>
    );
  } else {
    body = <MainShell key={state.pet.id} deepLink={deepLink} clearDeepLink={clearDeepLink} />;
  }

  return (
    <div className="app">
      {body}
      <Toasts />
    </div>
  );
}
