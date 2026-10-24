import { forwardRef, useId } from 'react';

/** Blends a daytime colour towards deep night blue by `shade` (0–0.55). */
export function tint(color, shade, night = '#1c2152') {
  const t = Math.min(1, shade / 0.55) * 0.62;
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(color);
  const b = p(night);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function Stars({ opacity, w = 400, h = 200, seed = 7 }) {
  if (opacity <= 0.02) return null;
  const pts = [];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 38; i++) pts.push([rnd() * w, rnd() * h, rnd() * 1.4 + 0.6, rnd() * 3]);
  return (
    <g opacity={opacity}>
      {pts.map(([x, y, r, d], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" style={{ animation: `twinkle ${2.5 + d}s ${d}s infinite` }} />
      ))}
    </g>
  );
}

function SunMoon({ sky, w, h }) {
  if (sky.sun) {
    return (
      <g transform={`translate(${sky.sun.x * w} ${sky.sun.y * h})`}>
        <circle r="30" fill="#FFE9A8" opacity="0.45" />
        <circle r="19" fill="#FFD45E" />
        <circle r="19" fill="url(#sunshine)" />
      </g>
    );
  }
  if (sky.moon) {
    return (
      <g transform={`translate(${sky.moon.x * w} ${sky.moon.y * h})`}>
        <circle r="26" fill="#FFF6C8" opacity="0.18" />
        <circle r="15" fill="#FFF3B8" />
        <circle cx="7" cy="-5" r="13" fill={sky.top} opacity="0.9" />
      </g>
    );
  }
  return null;
}

function Cloud({ x, y, s = 1, opacity = 0.9, dur = 60 }) {
  return (
    <g style={{ animation: `drift ${dur}s linear infinite` }} opacity={opacity}>
      <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff">
        <ellipse cx="0" cy="0" rx="26" ry="14" />
        <ellipse cx="20" cy="-8" rx="18" ry="14" />
        <ellipse cx="38" cy="2" rx="20" ry="11" />
      </g>
    </g>
  );
}

export function SkyDefs({ sky, id }) {
  return (
    <defs>
      <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={sky.top} />
        <stop offset="1" stopColor={sky.bottom} />
      </linearGradient>
      <radialGradient id="sunshine" cx="0.35" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`lamp-${id}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FFE7A3" stopOpacity="0.85" />
        <stop offset="1" stopColor="#FFE7A3" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function Clock({ x, y, date }) {
  const h = date.getHours() % 12;
  const m = date.getMinutes();
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="21" fill="#fff" stroke="#FFB5C5" strokeWidth="4" />
      {[0, 90, 180, 270].map((a) => (
        <circle key={a} cx={Math.sin((a * Math.PI) / 180) * 15} cy={-Math.cos((a * Math.PI) / 180) * 15} r="1.8" fill="#E8C7D0" />
      ))}
      <path d="M0 0 V-10" stroke="#5a4a63" strokeWidth="3" strokeLinecap="round" transform={`rotate(${(h + m / 60) * 30})`} />
      <path d="M0 0 V-15" stroke="#FF8FAB" strokeWidth="2" strokeLinecap="round" transform={`rotate(${m * 6})`} />
      <circle r="2.5" fill="#5a4a63" />
    </g>
  );
}

/** The pet's room. The window shows the real sky; a lamp switches on after dark. */
export function HouseScene({ sky, date = new Date(), children, height = '78%' }) {
  const id = useId().replace(/:/g, '');
  const lampOn = sky.shade > 0.22;
  return (
    <div className="scene" style={{ paddingTop: height }}>
      <svg className="bg" viewBox="0 0 400 312" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <SkyDefs sky={sky} id={id} />
        <defs>
          <pattern id={`wall-${id}`} width="36" height="36" patternUnits="userSpaceOnUse">
            <rect width="36" height="36" fill="#FFEDE4" />
            <path d="M18 14 c-3 -4 -9 -1 -6 4 l6 5 l6 -5 c3 -5 -3 -8 -6 -4 Z" fill="#FFDCE4" opacity="0.8" />
            <circle cx="0" cy="0" r="2" fill="#FFE0D2" />
            <circle cx="36" cy="36" r="2" fill="#FFE0D2" />
          </pattern>
          <clipPath id={`win-${id}`}>
            <rect x="40" y="36" width="116" height="104" rx="14" />
          </clipPath>
        </defs>

        {/* wall */}
        <rect width="400" height="210" fill={`url(#wall-${id})`} />
        <rect y="186" width="400" height="26" fill="#FFD7CA" />
        <rect y="184" width="400" height="5" fill="#fff" opacity="0.8" />

        {/* window with live sky */}
        <g clipPath={`url(#win-${id})`}>
          <rect x="40" y="36" width="116" height="104" fill={`url(#sky-${id})`} />
          <Stars opacity={sky.stars} w={156} h={140} />
          <g transform="translate(40 36)">
            <SunMoon sky={sky} w={116} h={104} />
          </g>
          {!sky.night && <Cloud x={60} y={64} s={0.7} opacity={0.85} dur={40} />}
          <path d="M40 140 Q70 112 100 126 Q130 110 156 128 V140 Z" fill={tint('#9ED9A3', sky.shade)} />
        </g>
        <rect x="40" y="36" width="116" height="104" rx="14" fill="none" stroke="#fff" strokeWidth="8" />
        <path d="M98 36 V140 M40 88 H156" stroke="#fff" strokeWidth="6" />
        <rect x="34" y="138" width="128" height="9" rx="4.5" fill="#fff" />
        {/* curtains */}
        <path d="M26 26 Q40 80 30 150 Q22 150 18 146 Q24 80 14 26 Z" fill="#FF9FB6" />
        <path d="M170 26 Q156 80 166 150 Q174 150 178 146 Q172 80 182 26 Z" fill="#FF9FB6" />
        <rect x="10" y="20" width="176" height="8" rx="4" fill="#E9B98F" />

        {/* framed paw picture + clock */}
        <rect x="246" y="52" width="58" height="50" rx="8" fill="#fff" stroke="#F7C8A8" strokeWidth="5" />
        <g transform="translate(275 79)" fill="#FFB0C2">
          <ellipse cx="0" cy="4" rx="9" ry="7.5" />
          <circle cx="-10" cy="-6" r="4" />
          <circle cx="-3.5" cy="-11" r="4" />
          <circle cx="3.5" cy="-11" r="4" />
          <circle cx="10" cy="-6" r="4" />
        </g>
        <Clock x={344} y={70} date={date} />

        {/* plant */}
        <g transform="translate(36 150)">
          <path d="M24 30 C0 20 -6 -6 10 -14 C16 4 22 14 24 30 Z" fill="#7FCB8F" />
          <path d="M26 30 C46 16 52 -10 36 -18 C30 2 28 14 26 30 Z" fill="#94D7A1" />
          <path d="M25 30 C22 6 26 -12 26 -26 C30 -8 30 8 25 30 Z" fill="#6CBC7E" />
          <path d="M8 30 H44 L40 62 H12 Z" fill="#F5B78F" />
          <rect x="4" y="26" width="44" height="9" rx="4.5" fill="#F09F72" />
        </g>

        {/* floor lamp */}
        {lampOn && <circle cx="356" cy="132" r="80" fill={`url(#lamp-${id})`} />}
        <g>
          <rect x="353" y="140" width="6" height="96" rx="3" fill="#C9A88A" />
          <ellipse cx="356" cy="238" rx="18" ry="5" fill="#C9A88A" />
          <path d="M334 140 L342 108 H370 L378 140 Z" fill={lampOn ? '#FFE9A6' : '#FFF4DC'} stroke="#F2CF8C" strokeWidth="3" strokeLinejoin="round" />
        </g>

        {/* floor */}
        <rect y="212" width="400" height="100" fill="#F5D6B8" />
        {[234, 260, 290].map((y) => (
          <path key={y} d={`M0 ${y} H400`} stroke="#EBC39F" strokeWidth="2" />
        ))}
        {[[60, 212, 234], [190, 212, 234], [320, 212, 234], [120, 234, 260], [260, 234, 260], [40, 260, 290], [200, 260, 290], [350, 260, 290], [130, 290, 312], [290, 290, 312]].map(([x, a, b], i) => (
          <path key={i} d={`M${x} ${a} V${b}`} stroke="#EBC39F" strokeWidth="2" />
        ))}
        {/* rug + bed */}
        <ellipse cx="200" cy="282" rx="150" ry="26" fill="#C9B8FF" opacity="0.55" />
        <ellipse cx="200" cy="282" rx="132" ry="20" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" opacity="0.8" />
        <ellipse cx="200" cy="270" rx="86" ry="22" fill="#FF9FB6" />
        <ellipse cx="200" cy="266" rx="70" ry="15" fill="#FFC4D2" />

        {/* bowl + ball */}
        <g transform="translate(330 262)">
          <ellipse cx="0" cy="10" rx="26" ry="6" fill="#000" opacity="0.07" />
          <path d="M-24 -2 H24 L18 12 H-18 Z" fill="#7FD3F5" />
          <ellipse cx="0" cy="-2" rx="24" ry="6" fill="#B8E8FB" />
          <ellipse cx="0" cy="-2" rx="17" ry="3.5" fill="#E9B57B" />
          <text x="0" y="9" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="800">
            ♥
          </text>
        </g>
        <g transform="translate(66 284)">
          <circle r="11" fill="#FFD166" />
          <path d="M-10 -3 Q0 3 10 -3 M-9 5 Q0 -1 9 5" stroke="#fff" strokeWidth="2" fill="none" />
        </g>

        {/* night shading */}
        <rect width="400" height="312" fill="#1c2152" opacity={sky.shade * 0.75} style={{ mixBlendMode: 'multiply' }} />
        {lampOn && <circle cx="356" cy="150" r="120" fill={`url(#lamp-${id})`} opacity="0.55" />}
      </svg>
      {children}
    </div>
  );
}

/**
 * The park used on walks. Layers are exposed through refs so WalkMode can
 * scroll them at different speeds (parallax) without re-rendering.
 */
export const OutdoorScene = forwardRef(function OutdoorScene({ sky }, ref) {
  const id = useId().replace(/:/g, '');
  const s = sky.shade;
  const lit = sky.shade > 0.2;
  const setRef = (key) => (el) => {
    if (ref) ref.current = { ...(ref.current || {}), [key]: el };
  };

  const skyline = (
    <g>
      <path d="M0 330 Q60 300 120 318 Q170 290 230 314 Q300 286 400 318 V400 H0 Z" fill={tint('#BFD7F0', s)} />
      {/* N Seoul Tower on its hill */}
      <path d="M250 330 Q300 268 350 330 Z" fill={tint('#A9C9E8', s)} />
      <rect x="297" y="232" width="6" height="56" fill={tint('#E7EEF8', s)} />
      <ellipse cx="300" cy="246" rx="11" ry="6" fill={tint('#F7FAFF', s)} />
      <rect x="299" y="214" width="2" height="20" fill={tint('#E7EEF8', s)} />
      {lit && <circle cx="300" cy="246" r="3" fill="#FFE07A" />}
      {[
        [20, 296, 34, 60],
        [60, 280, 28, 76],
        [96, 302, 40, 54],
        [150, 288, 30, 70],
        [190, 306, 36, 50],
        [356, 292, 34, 64],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx="5" fill={tint(['#D6CCF5', '#C7DDF7', '#F5D0DC', '#CDE9E0', '#E3D7F7', '#F5DFC9'][i], s)} />
          {[0, 1, 2].map((r) =>
            [0, 1].map((c) => (
              <rect key={`${r}${c}`} x={x + 6 + c * (w / 2 - 2)} y={y + 8 + r * 14} width="6" height="7" rx="1.5" fill={lit && (r + c + i) % 3 !== 0 ? '#FFE69A' : tint('#FFFFFF', s)} opacity={lit ? 0.95 : 0.6} />
            )),
          )}
        </g>
      ))}
    </g>
  );

  const tree = (x, scale, color) => (
    <g key={x} transform={`translate(${x} 0) scale(${scale})`}>
      <rect x="-5" y="-30" width="10" height="40" rx="4" fill={tint('#C9A27E', s)} />
      <circle cx="0" cy="-52" r="30" fill={tint(color, s)} />
      <circle cx="-18" cy="-36" r="20" fill={tint(color, s)} />
      <circle cx="18" cy="-38" r="22" fill={tint(color, s)} />
      <circle cx="-8" cy="-62" r="9" fill="#fff" opacity="0.2" />
    </g>
  );

  const midTile = (
    <g transform="translate(0 404)">
      {tree(40, 1, '#8ED39C')}
      {tree(150, 0.8, '#A6DDA0')}
      {tree(250, 1.1, '#7CC891')}
      {tree(350, 0.85, '#B4E3A7')}
    </g>
  );

  const nearTile = (
    <g>
      {/* street lamp */}
      <g transform="translate(90 0)">
        {lit && <circle cx="0" cy="372" r="60" fill={`url(#lamp-${id})`} />}
        <rect x="-3" y="372" width="6" height="100" rx="3" fill={tint('#8D86A8', s)} />
        <rect x="-12" y="360" width="24" height="16" rx="6" fill={lit ? '#FFE7A3' : tint('#EDE9F7', s)} stroke={tint('#8D86A8', s)} strokeWidth="3" />
      </g>
      {/* flowers */}
      {[
        [30, 470, '#FF9FB6'],
        [180, 462, '#FFD166'],
        [230, 474, '#fff'],
        [320, 466, '#B8A4FF'],
        [380, 476, '#FF9FB6'],
      ].map(([x, y, c], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0 0 V12" stroke={tint('#6CBC7E', s)} strokeWidth="2" />
          {[0, 90, 180, 270].map((a) => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 4} cy={Math.sin((a * Math.PI) / 180) * 4} r="3.5" fill={tint(c, s)} />
          ))}
          <circle r="2.5" fill="#FFB938" />
        </g>
      ))}
      {/* bench */}
      <g transform="translate(270 440)" fill={tint('#E8A87C', s)}>
        <rect x="0" y="0" width="64" height="8" rx="3" />
        <rect x="0" y="12" width="64" height="7" rx="3" />
        <rect x="6" y="18" width="5" height="18" rx="2" />
        <rect x="53" y="18" width="5" height="18" rx="2" />
      </g>
    </g>
  );

  const pathTile = (
    <g>
      {[0, 80, 160, 240, 320].map((x) => (
        <path key={x} d={`M${x} 500 L${x - 18} 560`} stroke={tint('#E8D2B0', s)} strokeWidth="3" />
      ))}
    </g>
  );

  return (
    <svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMax slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <SkyDefs sky={sky} id={id} />
      <rect width="400" height="640" fill={`url(#sky-${id})`} />
      <Stars opacity={sky.stars} w={400} h={300} seed={3} />
      <SunMoon sky={sky} w={400} h={330} />
      {!sky.night && (
        <>
          <Cloud x={40} y={110} s={1.1} dur={90} />
          <Cloud x={250} y={70} s={0.8} opacity={0.75} dur={120} />
          <Cloud x={320} y={170} s={0.6} opacity={0.7} dur={75} />
        </>
      )}
      <g ref={setRef('far')}>
        {skyline}
        <g transform="translate(400 0)">{skyline}</g>
      </g>
      <g ref={setRef('mid')}>
        {midTile}
        <g transform="translate(400 0)">{midTile}</g>
      </g>
      <rect y="400" width="400" height="240" fill={tint('#BEE7AE', s)} />
      <path d="M0 496 H400 V566 H0 Z" fill={tint('#F7E6CB', s)} />
      <path d="M0 496 H400" stroke={tint('#E8D2B0', s)} strokeWidth="4" />
      <path d="M0 566 H400" stroke={tint('#E8D2B0', s)} strokeWidth="4" />
      <g ref={setRef('near')}>
        {nearTile}
        {pathTile}
        <g transform="translate(400 0)">
          {nearTile}
          {pathTile}
        </g>
      </g>
      <rect width="400" height="640" fill="#1c2152" opacity={s * 0.35} style={{ mixBlendMode: 'multiply' }} />
    </svg>
  );
});
