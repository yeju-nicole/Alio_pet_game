import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Ticket, Users, Settings, Plug, LogOut, Download, Copy, Eye, EyeOff, RefreshCw, Search } from 'lucide-react';
import { api, post } from '../api.js';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const date = (t) => (t ? new Date(t).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const MISSION_KO = {
  tumbler: '텀블러 사용',
  recycle: '분리수거',
  ecobag: '장바구니',
  cleanplate: '잔반 제로',
  transit: '대중교통·자전거',
  unplug: '플러그 뽑기',
  plogging: '플로깅',
};

function useToast() {
  const [msg, setMsg] = useState('');
  const show = useCallback((m) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2600);
  }, []);
  return [msg, show];
}

// ---------------------------------------------------------------- charts

/** Single-series column chart with a per-bar hover tooltip. */
function Columns({ data, valueKey, label, unit }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const [W, setW] = useState(480);
  useEffect(() => {
    if (!box.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const H = 190;
  const pad = { l: 36, r: 6, t: 12, b: 26 };
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const step = iw / data.length;
  const bw = Math.min(26, step - 2);
  const y = (v) => pad.t + ih - (v / nice) * ih;
  const ticks = [0, nice / 2, nice];

  return (
    <div style={{ position: 'relative' }} ref={box}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} role="img" aria-label={`${label} 최근 14일`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
              {fmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d[valueKey];
          const x = pad.l + i * step + (step - bw) / 2;
          const top = y(v);
          const h = pad.t + ih - top;
          const r = Math.min(4, h / 2, bw / 2);
          return (
            <g key={d.day}>
              {h > 0 && (
                <path
                  d={`M${x} ${pad.t + ih} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + bw - r} Q${x + bw} ${top} ${x + bw} ${top + r} V${pad.t + ih} Z`}
                  fill="var(--series-1)"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {(i % 2 === 1 || data.length <= 7) && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
                  {d.day.slice(5).replace('-', '/')}
                </text>
              )}
              <rect x={pad.l + i * step} y={pad.t} width={step} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="var(--line)" />
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${((pad.l + hover * step + step / 2) / W) * 100}%`, top: `${(y(data[hover][valueKey]) / H) * 100}%` }}>
          <b>{data[hover].day}</b> · {fmt(data[hover][valueKey])}
          {unit}
        </div>
      )}
    </div>
  );
}

function HBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <div style={{ color: 'var(--ink-3)' }}>아직 인증된 미션이 없습니다.</div>;
  return (
    <div className="grid" style={{ gap: 9 }}>
      {rows.map((r) => (
        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 54px', alignItems: 'center', gap: 10 }} title={`${MISSION_KO[r.id] ?? r.id}: ${fmt(r.n)}회`}>
          <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{MISSION_KO[r.id] ?? r.id}</span>
          <span style={{ height: 12, background: 'var(--grid)', borderRadius: 4 }}>
            <span style={{ display: 'block', height: '100%', width: `${(r.n / max) * 100}%`, background: 'var(--series-1)', borderRadius: '0 4px 4px 0', minWidth: 3 }} />
          </span>
          <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.n)}</span>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- pages

function Overview() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/admin/overview')
      .then(setD)
      .catch((e) => setErr(e.message));
  }, []);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div>불러오는 중…</div>;
  const signupRate = d.codes.signup.active + d.codes.signup.redeemed ? Math.round((d.codes.signup.redeemed / (d.codes.signup.active + d.codes.signup.redeemed + d.codes.signup.revoked)) * 100) : 0;
  return (
    <>
      <h1>대시보드</h1>
      <p className="adm-sub">멍냥이 회원과 친환경 활동 현황입니다.</p>
      {d.demoMode && <div className="note warn" style={{ marginBottom: 16 }}>⚠️ 시연 모드가 켜져 있습니다. 산책·재우기를 즉시 완료할 수 있으니 운영 중에는 [게임 설정]에서 꺼 주세요.</div>}

      <div className="section-title">회원 · 반려동물</div>
      <div className="kpis">
        <Kpi label="전체 회원" value={fmt(d.users.total)} hint={`오늘 가입 ${fmt(d.users.today)}명`} />
        <Kpi label="7일 활성 회원" value={fmt(d.users.active7d)} hint={d.users.total ? `전체의 ${Math.round((d.users.active7d / d.users.total) * 100)}%` : ''} />
        <Kpi label="마케팅 수신 동의" value={fmt(d.users.marketing)} />
        <Kpi label="함께하는 반려동물" value={fmt(d.pets.alive)} hint={`입원 ${fmt(d.pets.hospital)} · 무지개다리 ${fmt(d.pets.dead)}`} />
      </div>

      <div className="section-title">친환경 임팩트 (누적)</div>
      <div className="kpis">
        <Kpi label="함께 걸은 걸음" value={fmt(d.eco.steps)} hint={`약 ${fmt(d.eco.distanceKm)}km · 산책 ${fmt(d.eco.walks)}회`} />
        <Kpi label="CO₂ 절감 추정" value={`${fmt(d.eco.co2SavedKg)}kg`} hint="걸은 거리 × 승용차 210g/km" />
        <Kpi label="휴대폰 쉬는 시간" value={`${fmt(d.eco.phoneFreeMinutes)}분`} hint="재우기 성공 시간 합계" />
        <Kpi label="에코 미션 인증" value={fmt(d.eco.missions)} hint={`퀴즈 참여 ${fmt(d.eco.quizzes)}회`} />
      </div>

      <div className="section-title">alio 연동 · 포인트</div>
      <div className="kpis">
        <Kpi label="가입 코드 사용" value={fmt(d.codes.signup.redeemed)} hint={`미사용 ${fmt(d.codes.signup.active)} · 사용률 ${signupRate}%`} />
        <Kpi label="제품 코드 사용" value={fmt(d.codes.product.redeemed)} hint={`미사용 ${fmt(d.codes.product.active)}`} />
        <Kpi label="유통 중인 포인트" value={`${fmt(d.points.circulating)}P`} hint={`지급 ${fmt(d.points.earned)} · 사용 ${fmt(d.points.spent)}`} />
      </div>

      <div className="section-title">최근 14일</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <div className="panel">
          <Columns data={d.daily} valueKey="signups" label="일별 신규 가입" unit="명" />
        </div>
        <div className="panel">
          <Columns data={d.daily} valueKey="actions" label="일별 돌봄·에코 활동" unit="회" />
        </div>
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>에코 미션별 인증 수</div>
          <HBars rows={d.eco.missionBreakdown} />
        </div>
      </div>
      <p style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 14 }}>AI 사진 인증: {d.aiVerification ? '사용 중' : '꺼짐 (셀프 인증)'}</p>
    </>
  );
}

function downloadCsv(params) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  window.location.href = `/api/admin/codes.csv${q ? `?${q}` : ''}`;
}

function Codes({ toast }) {
  const [filters, setFilters] = useState({ type: '', status: '', q: '', batch: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [gen, setGen] = useState({ type: 'product', count: 100, validDays: '', label: '' });
  const [made, setMade] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page }).toString();
    api(`/admin/codes?${q}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [filters, page]);
  useEffect(load, [load]);

  async function generate() {
    setErr('');
    try {
      const res = await post('/admin/codes', gen);
      setMade(res);
      toast(`${fmt(res.codes.length)}개 코드를 만들었습니다`);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function revoke(code) {
    if (!window.confirm(`${code} 코드를 사용 중지할까요?`)) return;
    try {
      await post(`/admin/codes/${encodeURIComponent(code)}/revoke`);
      toast('사용 중지했습니다');
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  const statusBadge = (s) => <span className={`badge ${s === 'active' ? 'ok' : s === 'redeemed' ? 'accent' : 'bad'}`}>{{ active: '사용 가능', redeemed: '사용됨', revoked: '중지/만료' }[s]}</span>;

  return (
    <>
      <h1>코드 관리</h1>
      <p className="adm-sub">
        가입 코드(5자리)는 alio 웹사이트가 API로 자동 발급합니다. 제품 코드(8자리)는 주문 시 API로 자동 발급하거나, 여기서 한꺼번에 만들어 제품 카드에 인쇄할 수 있습니다.
      </p>

      <div className="panel" style={{ marginBottom: 14 }}>
        <h2>코드 한꺼번에 만들기</h2>
        <div className="row">
          <select className="select" value={gen.type} onChange={(e) => setGen({ ...gen, type: e.target.value })}>
            <option value="product">제품 코드 (입양권)</option>
            <option value="signup">가입 코드 (500P)</option>
          </select>
          <input className="input" type="number" min="1" max="5000" style={{ width: 110 }} value={gen.count} onChange={(e) => setGen({ ...gen, count: e.target.value })} aria-label="개수" />
          <span style={{ color: 'var(--ink-2)' }}>개</span>
          <input className="input" type="number" min="0" style={{ width: 150 }} placeholder="유효기간(일, 기본값)" value={gen.validDays} onChange={(e) => setGen({ ...gen, validDays: e.target.value })} />
          <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="메모 (예: 11월 선물 박스)" value={gen.label} onChange={(e) => setGen({ ...gen, label: e.target.value })} />
          <button className="btn accent" onClick={generate}>
            만들기
          </button>
        </div>
        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        {made && (
          <div className="note" style={{ marginTop: 12 }}>
            <div className="row">
              <span>
                <b>{fmt(made.codes.length)}개</b> 생성 완료 · 묶음 ID <span className="mono">{made.batch}</span>
              </span>
              <span className="spacer" />
              <button className="btn sm ghost" onClick={() => downloadCsv({ batch: made.batch })}>
                <Download size={14} /> CSV 다운로드
              </button>
            </div>
            <div className="mono" style={{ marginTop: 8, color: 'var(--ink)' }}>
              {made.codes.slice(0, 12).map((c) => c.code).join('  ')}
              {made.codes.length > 12 && ' …'}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <select className="select" value={filters.type} onChange={(e) => (setFilters({ ...filters, type: e.target.value }), setPage(1))}>
            <option value="">전체 종류</option>
            <option value="signup">가입 코드</option>
            <option value="product">제품 코드</option>
          </select>
          <select className="select" value={filters.status} onChange={(e) => (setFilters({ ...filters, status: e.target.value }), setPage(1))}>
            <option value="">전체 상태</option>
            <option value="active">사용 가능</option>
            <option value="redeemed">사용됨</option>
            <option value="revoked">중지/만료</option>
          </select>
          <div className="row" style={{ flex: 1, minWidth: 200, gap: 0, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--ink-3)' }} />
            <input className="input" style={{ flex: 1, paddingLeft: 32 }} placeholder="코드, 회원번호/주문번호, 이메일 검색" value={filters.q} onChange={(e) => (setFilters({ ...filters, q: e.target.value }), setPage(1))} />
          </div>
          {filters.batch && (
            <button className="btn sm ghost" onClick={() => setFilters({ ...filters, batch: '' })}>
              묶음 필터 해제 ✕
            </button>
          )}
          <button className="btn sm ghost" onClick={() => downloadCsv(filters)}>
            <Download size={14} /> 현재 목록 CSV
          </button>
        </div>
        {!data ? (
          <div>불러오는 중…</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>코드</th>
                    <th>종류</th>
                    <th>상태</th>
                    <th>회원번호/주문번호/메모</th>
                    <th>발급</th>
                    <th>만료</th>
                    <th>사용자</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={`${c.code}-${c.createdAt}`}>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        {c.code}
                      </td>
                      <td>{c.type === 'signup' ? '가입' : '제품'}</td>
                      <td>{statusBadge(c.status)}</td>
                      <td style={{ color: 'var(--ink-2)' }}>
                        {c.ref || '—'}
                        {c.email && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.email}</div>}
                      </td>
                      <td style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                        {date(c.createdAt)} <span className="badge">{c.source === 'api' ? 'API' : '관리자'}</span>
                      </td>
                      <td style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{c.expiresAt ? date(c.expiresAt) : '없음'}</td>
                      <td style={{ color: 'var(--ink-2)' }}>{c.redeemer ? `${c.redeemer} · ${date(c.redeemedAt)}` : '—'}</td>
                      <td>
                        {c.status === 'active' && (
                          <button className="btn sm danger" onClick={() => revoke(c.code)}>
                            중지
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!data.items.length && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 30 }}>
                        코드가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={data.total} size={data.size} setPage={setPage} />
            {data.batches.length > 0 && (
              <>
                <div className="section-title">최근 만든 묶음</div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>묶음 ID</th>
                      <th>종류</th>
                      <th>메모</th>
                      <th>사용 / 전체</th>
                      <th>만든 날</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.batches.map((b) => (
                      <tr key={b.batch}>
                        <td className="mono">{b.batch}</td>
                        <td>{b.type === 'signup' ? '가입' : '제품'}</td>
                        <td>{b.label || '—'}</td>
                        <td>
                          {fmt(b.used)} / {fmt(b.n)}
                        </td>
                        <td>{date(b.at)}</td>
                        <td className="row" style={{ gap: 6 }}>
                          <button className="btn sm ghost" onClick={() => (setFilters({ type: '', status: '', q: '', batch: b.batch }), setPage(1))}>
                            보기
                          </button>
                          <button className="btn sm ghost" onClick={() => downloadCsv({ batch: b.batch })}>
                            <Download size={13} /> CSV
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Pager({ page, total, size, setPage }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end', color: 'var(--ink-2)' }}>
      <span>
        총 {fmt(total)}건 · {page}/{pages} 페이지
      </span>
      <button className="btn sm ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        이전
      </button>
      <button className="btn sm ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
        다음
      </button>
    </div>
  );
}

function Members({ toast }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    api(`/admin/users?${new URLSearchParams({ q, page })}`)
      .then(setData)
      .catch(() => {});
  }, [q, page]);
  useEffect(load, [load]);

  const petBadge = (s) => (s ? <span className={`badge ${s === 'alive' ? 'ok' : s === 'hospital' ? 'warn' : 'bad'}`}>{{ alive: '건강', hospital: '입원', dead: '무지개다리' }[s]}</span> : <span className="badge">입양 전</span>);

  return (
    <>
      <h1>회원</h1>
      <p className="adm-sub">회원 정보 확인, 포인트 조정, 입양권 지급, 임시 비밀번호 발급을 할 수 있습니다.</p>
      <div className="panel">
        <div className="row" style={{ marginBottom: 12, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--ink-3)' }} />
          <input className="input" style={{ flex: 1, paddingLeft: 32 }} placeholder="이메일 또는 닉네임 검색" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
        {!data ? (
          <div>불러오는 중…</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>이메일</th>
                    <th>닉네임</th>
                    <th>반려동물</th>
                    <th>포인트</th>
                    <th>가입 보너스</th>
                    <th>가입일</th>
                    <th>최근 접속</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id} className="click" onClick={() => setOpen(u.id)}>
                      <td>{u.email}</td>
                      <td>{u.nickname}</td>
                      <td>
                        {u.pet_name ? `${u.species === 'cat' ? '🐱' : '🐶'} ${u.pet_name} ` : ''}
                        {petBadge(u.pet_status)}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(u.points)}P</td>
                      <td>{u.signup_bonus_claimed ? <span className="badge ok">받음</span> : '—'}</td>
                      <td style={{ color: 'var(--ink-2)' }}>{date(u.created_at)}</td>
                      <td style={{ color: 'var(--ink-2)' }}>{date(u.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={data.total} size={data.size} setPage={setPage} />
          </>
        )}
      </div>
      {open && <MemberDrawer id={open} onClose={() => setOpen(null)} toast={toast} onChange={load} />}
    </>
  );
}

function MemberDrawer({ id, onClose, toast, onChange }) {
  const [d, setD] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [temp, setTemp] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api(`/admin/users/${id}`)
      .then(setD)
      .catch((e) => setErr(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function act(fn, ok) {
    setErr('');
    try {
      const res = await fn();
      toast(ok(res));
      load();
      onChange();
      return res;
    } catch (e) {
      setErr(e.message);
      return null;
    }
  }

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="row">
          <h2 style={{ margin: 0, fontSize: 18 }}>회원 상세</h2>
          <span className="spacer" />
          <button className="btn sm ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        {!d ? (
          <div style={{ marginTop: 20 }}>불러오는 중…</div>
        ) : (
          <div className="grid" style={{ marginTop: 16 }}>
            <div className="note">
              <b>{d.user.nickname}</b> · {d.user.email}
              <br />
              포인트 <b>{fmt(d.user.points)}P</b> · 입양권 {d.user.adoption_tickets}장 · 가입 {date(d.user.created_at)} · 시간대 {d.user.timezone}
            </div>
            <div>
              <div className="section-title" style={{ marginTop: 4 }}>
                반려동물
              </div>
              {d.pets.length ? (
                d.pets.map((p) => (
                  <div key={p.id} style={{ padding: '4px 0' }}>
                    {p.species === 'cat' ? '🐱' : '🐶'} <b>{p.name}</b> · {{ alive: '건강', hospital: '입원', dead: '무지개다리' }[p.status]} · 입양 {date(p.adopted_at)} · 마지막 돌봄 {date(p.last_care_at)}
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--ink-3)' }}>아직 입양하지 않았습니다</div>
              )}
            </div>
            <div>
              <div className="section-title" style={{ marginTop: 4 }}>
                에코 활동
              </div>
              걸음 {fmt(d.impact.steps)} · CO₂ {fmt(d.impact.co2SavedG)}g · 물 {fmt(d.impact.waterSaved)}L · 폰 쉬기 {fmt(d.impact.phoneFreeMinutes)}분 · 미션 {fmt(d.impact.missions)}회
            </div>
            <div className="panel" style={{ padding: 14 }}>
              <b>포인트 조정</b>
              <div className="row" style={{ marginTop: 10 }}>
                <input className="input" type="number" style={{ width: 120 }} placeholder="+500 / -200" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <input className="input" style={{ flex: 1 }} placeholder="사유 (회원에게 보입니다)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <button
                  className="btn"
                  disabled={!Number(amount)}
                  onClick={() => act(() => post(`/admin/users/${id}/grant`, { amount: Number(amount), reason }), (r) => `잔액 ${fmt(r.points)}P`).then((r) => r && (setAmount(''), setReason('')))}
                >
                  적용
                </button>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn sm ghost" onClick={() => act(() => post(`/admin/users/${id}/ticket`), () => '입양권 1장을 지급했습니다')}>
                  입양권 1장 지급
                </button>
                <button
                  className="btn sm ghost"
                  onClick={() => window.confirm('임시 비밀번호를 발급할까요? 기존 로그인은 모두 해제됩니다.') && act(() => post(`/admin/users/${id}/reset-password`), (r) => (setTemp(r.tempPassword), '임시 비밀번호를 발급했습니다'))}
                >
                  임시 비밀번호 발급
                </button>
              </div>
              {temp && (
                <div className="note" style={{ marginTop: 10 }}>
                  임시 비밀번호: <b className="mono">{temp}</b> — 회원에게 전달 후 [내 정보 &gt; 비밀번호 바꾸기]로 변경하도록 안내하세요.
                </div>
              )}
              {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
            </div>
            <div>
              <div className="section-title" style={{ marginTop: 4 }}>
                최근 포인트 내역
              </div>
              <table className="tbl">
                <tbody>
                  {d.history.map((h) => (
                    <tr key={h.id}>
                      <td style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{date(h.at)}</td>
                      <td>{h.memo}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: h.amount > 0 ? 'var(--mint)' : 'var(--danger)' }}>
                        {h.amount > 0 ? '+' : ''}
                        {fmt(h.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

const SETTING_GROUPS = [
  {
    title: '산책',
    items: [
      ['walkSteps', '산책 목표 걸음 수', '보'],
      ['walkReward', '산책 보상', 'P'],
      ['walkDailyLimit', '하루 최대 산책', '회'],
    ],
  },
  {
    title: '돌봄',
    items: [
      ['feedReward', '밥 주기 보상', 'P'],
      ['feedDailyLimit', '하루 최대 밥 주기', '회'],
      ['feedCooldownMinutes', '밥 주기 간격', '분'],
      ['washReward', '목욕 보상', 'P'],
      ['washDailyLimit', '하루 최대 목욕', '회'],
      ['playReward', '놀아주기 보상', 'P'],
      ['playDailyLimit', '하루 최대 놀아주기', '회'],
      ['sleepMinutes', '재우기: 휴대폰 내려놓는 시간', '분'],
      ['sleepReward', '재우기 보상', 'P'],
      ['sleepDailyLimit', '하루 최대 재우기', '회'],
    ],
  },
  {
    title: '에코 미션 · 퀴즈',
    items: [
      ['missionReward', '사진 미션 보상', 'P'],
      ['ploggingReward', '플로깅 보상', 'P'],
      ['quizReward', '퀴즈 정답 보상', 'P'],
    ],
  },
  {
    title: '돌봄 규칙',
    items: [
      ['hospitalAfterDays', '돌보지 않으면 입원', '일 후'],
      ['deathAfterDays', '돌보지 않으면 무지개다리', '일 후'],
      ['healCost', '병원 치료비', 'P'],
    ],
  },
  {
    title: 'alio 연동',
    items: [
      ['signupCodeReward', '가입 코드 보상', 'P'],
      ['signupCodeValidDays', '가입 코드 유효기간', '일'],
      ['productCodeValidDays', '제품 코드 유효기간 (0 = 무기한)', '일'],
      ['alioSignupUrl', 'alio 회원가입 페이지 주소', 'url'],
      ['alioStoreUrl', 'alio 스토어 주소', 'url'],
      ['supportEmail', '고객센터 이메일', 'text'],
    ],
  },
];

function GameSettings({ toast }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/admin/settings')
      .then((d) => setS(d.settings))
      .catch((e) => setErr(e.message));
  }, []);

  async function save() {
    setErr('');
    try {
      const d = await api('/admin/settings', { method: 'PUT', body: s });
      setS(d.settings);
      toast('저장했습니다. 회원 화면에 바로 반영됩니다');
    } catch (e) {
      setErr(e.message);
    }
  }

  if (!s) return err ? <div className="err">{err}</div> : <div>불러오는 중…</div>;
  return (
    <>
      <h1>게임 설정</h1>
      <p className="adm-sub">보상과 규칙을 바꾸면 서버를 다시 배포하지 않아도 바로 적용됩니다.</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {SETTING_GROUPS.map((g) => (
          <div key={g.title} className="panel">
            <h2>{g.title}</h2>
            <div className="grid" style={{ gap: 10 }}>
              {g.items.map(([key, label, unit]) => (
                <label key={key} className="row" style={{ flexWrap: 'nowrap' }}>
                  <span style={{ flex: 1, color: 'var(--ink-2)' }}>{label}</span>
                  {unit === 'url' || unit === 'text' ? (
                    <input className="input" style={{ width: 220 }} placeholder={unit === 'url' ? 'https://' : ''} value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
                  ) : (
                    <>
                      <input className="input" type="number" min="0" style={{ width: 100, textAlign: 'right' }} value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
                      <span style={{ width: 34, color: 'var(--ink-3)', fontSize: 13 }}>{unit}</span>
                    </>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="panel">
          <h2>시연 모드</h2>
          <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <input type="checkbox" checked={s.demoMode} onChange={(e) => setS({ ...s, demoMode: e.target.checked })} style={{ marginTop: 3 }} />
            <span style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
              발표·시연용으로 산책과 재우기에 &lsquo;바로 완료&rsquo; 버튼을 보여 줍니다. <b style={{ color: 'var(--danger)' }}>실제 운영 중에는 반드시 꺼 두세요.</b>
            </span>
          </label>
        </div>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        {err && <div className="err">{err}</div>}
        <span className="spacer" />
        <button className="btn accent" onClick={save}>
          저장하기
        </button>
      </div>
    </>
  );
}

function Integration({ toast }) {
  const [d, setD] = useState(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    api('/admin/integration')
      .then(setD)
      .catch(() => {});
  }, []);
  if (!d) return <div>불러오는 중…</div>;

  const key = show ? d.apiKey : d.apiKey.slice(0, 9) + '•'.repeat(20);
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast('복사했습니다'));
  const curlSignup = `curl -X POST ${d.baseUrl}/api/partner/v1/signup-codes \\
  -H "X-API-Key: ${show ? d.apiKey : 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"memberId": "alio-12345", "email": "member@example.com"}'

# 응답
{ "code": "48213", "expiresAt": 1767225600000,
  "redeemUrl": "${d.baseUrl}/?code=48213", ... }`;
  const nodeSignup = `// alio 웹사이트 서버: 회원가입이 끝난 직후 실행
const res = await fetch('${d.baseUrl}/api/partner/v1/signup-codes', {
  method: 'POST',
  headers: { 'X-API-Key': process.env.MUNGNYANG_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ memberId: member.id, email: member.email }),
});
const { code, redeemUrl } = await res.json();
// → 가입 완료 화면과 환영 메일에 code(5자리)와 redeemUrl 링크를 보여 주세요`;
  const productCurl = `curl -X POST ${d.baseUrl}/api/partner/v1/product-codes \\
  -H "X-API-Key: ${show ? d.apiKey : 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"orderId": "ORDER-20261024-001"}'`;

  return (
    <>
      <h1>alio 연동 가이드</h1>
      <p className="adm-sub">alio 웹사이트에 아래 내용을 전달하면 가입 코드와 제품 코드가 자동으로 발급됩니다.</p>

      <div className="panel" style={{ marginBottom: 14 }}>
        <h2>이렇게 자동으로 동작해요</h2>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, color: 'var(--ink-2)' }}>
          <li>회원이 alio 웹사이트에서 회원가입을 마칩니다.</li>
          <li>alio 웹사이트 서버가 멍냥이 API를 한 번 호출해 <b>5자리 코드</b>를 받습니다. (같은 회원번호로 다시 호출하면 같은 코드를 돌려줘서 중복 발급이 없어요)</li>
          <li>가입 완료 화면·환영 메일에 코드와 <b>바로가기 링크</b>(<span className="mono">/?code=48213</span>)를 보여 줍니다.</li>
          <li>회원이 멍냥이에서 코드를 입력하면(링크로 오면 자동 입력) <b>500P</b>가 지급되고 코드는 사용 처리됩니다.</li>
          <li>제품 코드도 같은 방식: 주문 결제 완료 시 API를 호출하거나, [코드 관리]에서 대량으로 만들어 제품 카드에 인쇄하세요.</li>
        </ol>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <h2>API 키</h2>
        <div className="row">
          <span className="mono" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', padding: '9px 12px', borderRadius: 10, flex: 1, minWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {key}
          </span>
          <button className="btn sm ghost" onClick={() => setShow(!show)}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? '숨기기' : '보기'}
          </button>
          <button className="btn sm ghost" onClick={() => copy(d.apiKey)}>
            <Copy size={14} /> 복사
          </button>
          {!d.keyFromEnv && (
            <button
              className="btn sm danger"
              onClick={async () => {
                if (!window.confirm('새 키를 만들면 기존 키는 즉시 사용할 수 없게 됩니다. 계속할까요?')) return;
                const r = await post('/admin/integration/rotate');
                setD({ ...d, apiKey: r.apiKey });
                setShow(true);
                toast('새 API 키를 만들었습니다');
              }}
            >
              <RefreshCw size={14} /> 새 키 만들기
            </button>
          )}
        </div>
        <p style={{ color: 'var(--ink-3)', fontSize: 12.5, marginBottom: 0 }}>
          API 키는 비밀번호처럼 다뤄 주세요. alio 웹사이트의 <b>서버</b>에만 저장하고, 브라우저 코드(자바스크립트)에 넣으면 안 됩니다. 서버 주소: <span className="mono">{d.baseUrl}</span>
        </p>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <h2>① 회원가입 코드 발급 (가입 직후 1회 호출)</h2>
        <div className="row" style={{ marginBottom: 8 }}>
          <span style={{ color: 'var(--ink-2)' }}>
            <b>memberId</b>(alio 회원번호)를 보내면 중복 발급을 막아 줘요. <b>email</b>을 함께 보내면 같은 이메일로 가입한 멍냥이 계정에서만 쓸 수 있어 코드 도용을 막을 수 있어요(선택).
          </span>
        </div>
        <div className="code">{curlSignup}</div>
        <div style={{ height: 10 }} />
        <div className="code">{nodeSignup}</div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <h2>② 제품 코드 발급 (주문 결제 완료 시)</h2>
        <div className="code">{productCurl}</div>
        <p style={{ color: 'var(--ink-2)', marginBottom: 0 }}>
          환불 시 사용 전 코드는 <span className="mono">DELETE /api/partner/v1/codes/코드</span>로 중지할 수 있고, <span className="mono">GET /api/partner/v1/codes/코드</span>로 사용 여부를 조회할 수 있습니다.
        </p>
      </div>

      <div className="panel">
        <h2>개발자가 없다면?</h2>
        <p style={{ color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>
          Zapier·Make 같은 자동화 도구에서 &lsquo;새 회원 가입 → 웹훅(HTTP POST) 호출 → 환영 메일 발송&rsquo; 순서로 연결하면 코드 없이도 자동화할 수 있습니다. 또는 [코드 관리]에서 가입 코드를 미리
          만들어 CSV로 내려받은 뒤, 메일 발송 도구의 &lsquo;개인별 쿠폰 코드&rsquo; 기능으로 한 명에게 하나씩 보낼 수도 있습니다.
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- shell

const PAGES = [
  { id: 'overview', label: '대시보드', icon: LayoutDashboard, Comp: Overview },
  { id: 'codes', label: '코드 관리', icon: Ticket, Comp: Codes },
  { id: 'members', label: '회원', icon: Users, Comp: Members },
  { id: 'settings', label: '게임 설정', icon: Settings, Comp: GameSettings },
  { id: 'integration', label: 'alio 연동 가이드', icon: Plug, Comp: Integration },
];

function Login({ onDone }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      await post('/admin/login', { password: pw });
      onDone();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  return (
    <div className="login">
      <form className="panel" style={{ width: 'min(380px, 100%)' }} onSubmit={submit}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>🐾 멍냥이 관리자</div>
        <p style={{ color: 'var(--ink-2)', marginTop: 4 }}>alio 운영팀 전용 페이지입니다.</p>
        <input className="input" type="password" placeholder="관리자 비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: '100%' }} autoFocus />
        {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
        <button className="btn accent" style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}>
          로그인
        </button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(null);
  const [defaultPw, setDefaultPw] = useState(false);
  const [page, setPage] = useState(() => window.location.hash.slice(1) || 'overview');
  const [msg, toast] = useToast();

  const check = useCallback(() => {
    api('/admin/session')
      .then((d) => {
        setAuthed(true);
        setDefaultPw(d.defaultPassword);
      })
      .catch(() => setAuthed(false));
  }, []);
  useEffect(check, [check]);
  useEffect(() => {
    window.location.hash = page;
  }, [page]);

  if (authed === null) return null;
  if (!authed) return <Login onDone={check} />;
  const Current = (PAGES.find((p) => p.id === page) ?? PAGES[0]).Comp;

  return (
    <div className="adm">
      <nav className="adm-side">
        <div className="adm-brand">
          🐾 alio 멍냥이
          <small>운영 관리자</small>
        </div>
        {PAGES.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`adm-nav ${page === id ? 'on' : ''}`} onClick={() => setPage(id)}>
            <Icon size={17} /> {label}
          </button>
        ))}
        <span className="spacer" />
        <button className="adm-nav" onClick={() => post('/admin/logout').finally(() => setAuthed(false))}>
          <LogOut size={17} /> 로그아웃
        </button>
      </nav>
      <main className="adm-main">
        {defaultPw && (
          <div className="note warn" style={{ marginBottom: 16 }}>
            ⚠️ 개발용 기본 비밀번호(admin1234)를 사용 중입니다. 실제 운영 전에 서버의 ADMIN_PASSWORD 환경 변수를 설정하세요.
          </div>
        )}
        <Current toast={toast} />
      </main>
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
