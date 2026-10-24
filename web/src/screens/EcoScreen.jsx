import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Sparkles, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { useGame, fmt } from '../store.jsx';
import { Sheet, Modal, Confetti } from '../components/UI.jsx';
import { photoToDataUrl } from '../lib/device.js';

function QuizCard({ quiz, onAnswered }) {
  const { run } = useGame();
  const [busy, setBusy] = useState(false);

  async function answer(i) {
    if (quiz.answered || busy) return;
    setBusy(true);
    try {
      const data = await run('/eco/quiz', { answer: i });
      onAnswered({ ...quiz, answered: true, picked: i, answer: data.answer, correct: data.correct, explain: data.explain });
    } catch {
      /* toast */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ background: 'linear-gradient(135deg, #FFF8E1, #FFFFFF 60%)' }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="tag butter">💡 오늘의 에코 퀴즈</span>
        <span className="spacer" />
        <span className="points" style={{ fontSize: 13 }}>정답 +{quiz.reward}P</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.45, marginBottom: 12 }}>{quiz.q}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {quiz.options.map((o, i) => {
          const isAnswer = quiz.answered && i === quiz.answer;
          const isWrongPick = quiz.answered && i === quiz.picked && !quiz.correct;
          return (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={quiz.answered || busy}
              style={{
                textAlign: 'left',
                border: `2px solid ${isAnswer ? 'var(--mint)' : isWrongPick ? 'var(--pink)' : 'var(--line)'}`,
                background: isAnswer ? 'var(--mint-soft)' : isWrongPick ? 'var(--pink-soft)' : 'white',
                borderRadius: 14,
                padding: '11px 12px',
                fontSize: 14,
                fontWeight: 600,
                cursor: quiz.answered ? 'default' : 'pointer',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                color: 'var(--ink)',
              }}
            >
              <span style={{ fontWeight: 900, color: 'var(--ink-3)' }}>{'①②③④'[i]}</span>
              <span style={{ flex: 1 }}>{o}</span>
              {isAnswer && <Check size={18} color="var(--mint-deep)" />}
            </button>
          );
        })}
      </div>
      {quiz.answered && (
        <div className={`notice ${quiz.correct ? 'mint' : 'pink'}`} style={{ marginTop: 12 }}>
          <span>
            <b>{quiz.correct ? `정답이에요! +${quiz.reward}P 🎉` : '아쉬워요! 내일 다시 도전해요'}</b>
            <br />
            {quiz.explain}
          </span>
        </div>
      )}
    </div>
  );
}

function MissionSheet({ mission, ai, onClose, onDone }) {
  const { run } = useGame();
  const fileRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState(null);

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setVerdict(null);
    try {
      setPhoto(await photoToDataUrl(f));
    } catch (err) {
      setVerdict({ pass: false, reason: err.message });
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const data = await run('/eco/mission', { missionId: mission.id, image: photo });
      setVerdict(data);
      if (data.pass) onDone(data);
    } catch {
      /* toast */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={`${mission.emoji} ${mission.title}`} onClose={onClose}>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55 }}>
        {mission.desc}
      </p>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <button
        onClick={() => fileRef.current?.click()}
        style={{
          width: '100%',
          aspectRatio: photo ? 'auto' : '4 / 3',
          border: photo ? 0 : '2.5px dashed #E8CFC4',
          borderRadius: 20,
          background: photo ? 'transparent' : '#FFF9F5',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {photo ? (
          <img src={photo} alt="인증 사진 미리보기" style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 20, display: 'block' }} />
        ) : (
          <div className="center muted">
            <Camera size={36} />
            <div style={{ fontWeight: 700, marginTop: 6 }}>사진 찍기</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>{mission.hint}</div>
          </div>
        )}
      </button>

      {verdict && !verdict.pass && (
        <div className="notice pink" style={{ marginTop: 12 }}>
          🤔 {verdict.reason}
        </div>
      )}

      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        {photo && (
          <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            <RefreshCw size={18} /> 다시 찍기
          </button>
        )}
        <button className="btn mint" style={{ flex: 1 }} disabled={!photo || busy} onClick={submit}>
          {busy ? (
            <>
              <span className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} /> {ai ? 'AI가 확인하는 중…' : '인증 중…'}
            </>
          ) : (
            <>
              <Sparkles size={18} /> 인증하고 +{mission.reward}P 받기
            </>
          )}
        </button>
      </div>
      <p className="muted center" style={{ fontSize: 11.5, margin: '12px 0 0', lineHeight: 1.5 }}>
        {ai ? 'AI가 사진을 확인해요. ' : ''}사진은 인증에만 쓰이고 저장되지 않아요. 같은 사진은 다시 쓸 수 없어요.
      </p>
    </Sheet>
  );
}

export default function EcoScreen() {
  const { state } = useGame();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [win, setWin] = useState(null);

  const load = useCallback(() => {
    api('/eco/today')
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(load, [load, state.today.dayKey]);

  if (!data) {
    return (
      <div className="splash" style={{ minHeight: 300 }}>
        <span className="spinner" />
      </div>
    );
  }

  const doneCount = data.missions.filter((m) => m.done).length + (data.quiz.answered ? 1 : 0);
  const total = data.missions.length + 1;

  return (
    <div>
      <h1 className="page-title">에코 미션 🌱</h1>
      <p className="page-sub">일상 속 친환경 행동을 인증하고 포인트를 받아요. 미션은 매일 자정에 새로 열려요.</p>

      <div className="pad" style={{ display: 'grid', gap: 12 }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #5FCFB4, #8FE0C9)', color: 'white' }}>
          <div className="row">
            <div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>오늘 완료한 미션</div>
              <div className="cute" style={{ fontSize: 30 }}>
                {doneCount} / {total}
              </div>
            </div>
            <span className="spacer" />
            <div style={{ fontSize: 46 }}>{doneCount === total ? '🏆' : '🌍'}</div>
          </div>
          <div className="bar" style={{ background: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
            <i style={{ width: `${(doneCount / total) * 100}%`, background: 'white' }} />
          </div>
        </div>

        <QuizCard quiz={data.quiz} onAnswered={(q) => setData((d) => ({ ...d, quiz: q }))} />

        <div style={{ fontWeight: 800, margin: '6px 4px -2px' }}>📸 사진 인증 미션</div>
        {data.missions.map((m) => (
          <button
            key={m.id}
            className="card"
            onClick={() => !m.done && setOpen(m)}
            style={{ border: 0, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: 14, cursor: m.done ? 'default' : 'pointer' }}
          >
            <span style={{ fontSize: 30, width: 50, height: 50, borderRadius: 16, background: m.done ? 'var(--mint-soft)' : '#FFF4EC', display: 'grid', placeItems: 'center', flex: 'none' }}>
              {m.emoji}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>
                {m.title} {m.reward > state.settings.missionReward && <span className="tag lilac" style={{ fontSize: 10.5, padding: '2px 7px', marginLeft: 2 }}>보너스</span>}
              </span>
              <span className="muted" style={{ display: 'block', fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>
                {m.desc}
              </span>
            </span>
            {m.done ? (
              <span className="tag mint" style={{ flex: 'none' }}>
                <Check size={13} /> 완료
              </span>
            ) : (
              <span className="points" style={{ flex: 'none', fontSize: 14 }}>
                +{m.reward}P
              </span>
            )}
          </button>
        ))}
        <div className="muted center" style={{ fontSize: 12, padding: '6px 10px' }}>
          걷기·재우기·목욕도 모두 에코 활동이에요! 홈에서 멍냥이를 돌봐 주세요.
        </div>
      </div>

      {open && (
        <MissionSheet
          mission={open}
          ai={data.aiVerification}
          onClose={() => setOpen(null)}
          onDone={(res) => {
            setOpen(null);
            setWin({ mission: open, ...res });
            load();
          }}
        />
      )}
      {win && (
        <>
          <Confetti />
          <Modal onClose={() => setWin(null)}>
            <div style={{ fontSize: 60 }}>{win.mission.emoji}</div>
            <h3>미션 성공!</h3>
            <div className="points" style={{ fontSize: 24 }}>+{fmt(win.reward)}P</div>
            <p>{win.reason}</p>
            <button className="btn block" onClick={() => setWin(null)}>
              좋아요
            </button>
          </Modal>
        </>
      )}
    </div>
  );
}
