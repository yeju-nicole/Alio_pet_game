import { useId } from 'react';
import { Accessory } from './Accessories.jsx';

/**
 * Hand-drawn chibi dog / cat. Everything lives in a 200×200 box with shared
 * anchor points (head centre 100,84 · eyes y=90 · neck y≈130 · body 100,150)
 * so clothes from the shop fit both species.
 */
export const PALETTES = {
  cream: { species: 'dog', label: '말티즈', line: '#E2C29C', fur: '#FFF7EA', shade: '#F1DDC0', ear: '#EFCFA6', muzzle: '#FFFFFF', belly: '#FFFFFF', nose: '#4B3A3F', ears: 'floppy' },
  choco: { species: 'dog', label: '초코 푸들', line: '#86502F', fur: '#BE865D', shade: '#9E6843', ear: '#8A5434', muzzle: '#E8BE96', belly: '#DDB088', nose: '#3A2622', ears: 'floppy', curly: true },
  shiba: { species: 'dog', label: '시바', line: '#D9843A', fur: '#F5A85E', shade: '#DD8B41', ear: '#F5A85E', inner: '#FFE3C6', muzzle: '#FFF8EE', belly: '#FFF8EE', nose: '#3A2622', ears: 'round', mask: 'shiba' },
  cheese: { species: 'cat', label: '치즈냥', line: '#E69A48', fur: '#FFC574', shade: '#F1A74F', inner: '#FFB3C1', muzzle: '#FFF5E2', belly: '#FFF5E2', nose: '#FF8FA3', ears: 'pointy', stripes: '#EC913F' },
  tuxedo: { species: 'cat', label: '턱시도냥', line: '#2A2631', fur: '#4A4554', shade: '#36323F', inner: '#FFB3C1', muzzle: '#FFFFFF', belly: '#FFFFFF', nose: '#FF8FA3', ears: 'pointy', mask: 'tuxedo' },
  gray: { species: 'cat', label: '러블냥', line: '#8C98AF', fur: '#B3BDD0', shade: '#97A3BA', inner: '#FFC2CD', muzzle: '#E9EDF5', belly: '#E9EDF5', nose: '#FF8FA3', ears: 'pointy' },
};

const EYE = '#2B2230';
const BLUSH = '#FF9DB5';

function Eyes({ mood, p }) {
  const both = (render) => (
    <>
      {render(76)}
      {render(124)}
    </>
  );
  switch (mood) {
    case 'happy':
    case 'eating':
      return both((x) => <path key={x} d={`M${x - 9} 93 Q${x} 81 ${x + 9} 93`} stroke={EYE} strokeWidth="4" fill="none" strokeLinecap="round" />);
    case 'sleeping':
    case 'angel':
      return both((x) => <path key={x} d={`M${x - 9} 88 Q${x} 97 ${x + 9} 88`} stroke={EYE} strokeWidth="3.5" fill="none" strokeLinecap="round" />);
    case 'sleepy':
    case 'sick':
      return both((x) => (
        <g key={x}>
          <path d={`M${x - 8} 89 a8 7 0 0 0 16 0 Z`} fill={EYE} />
          <path d={`M${x - 10} 89 h20`} stroke={p.shade} strokeWidth="3" strokeLinecap="round" />
          <circle cx={x + 3} cy={92} r="1.6" fill="#fff" />
        </g>
      ));
    default:
      return (
        <g className="blink">
          {both((x) => (
            <g key={x}>
              <ellipse cx={x} cy={90} rx="8" ry="9.5" fill={EYE} />
              <circle cx={x + 2.8} cy={86.3} r="3.2" fill="#fff" />
              <circle cx={x - 2.6} cy={93.5} r="1.4" fill="#fff" opacity="0.9" />
            </g>
          ))}
        </g>
      );
  }
}

function Mouth({ mood, p, isCat }) {
  const stroke = isCat ? '#7A4E58' : p.nose;
  const common = { stroke, strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (mood === 'happy') {
    return (
      <g>
        <path d="M89 108 Q100 128 111 108 Z" fill="#8E3B4F" />
        <ellipse cx="100" cy="118" rx="6.5" ry="5" fill="#FF8FA8" />
      </g>
    );
  }
  if (mood === 'eating') {
    return <ellipse className="munch" cx="100" cy="112" rx="6" ry="5" fill="#8E3B4F" />;
  }
  if (mood === 'hungry') {
    return (
      <g>
        <ellipse cx="100" cy="113" rx="4.5" ry="5.5" fill="#8E3B4F" />
        <path d="M108 113 q2 6 0 9 q-2 -3 0 -9 Z" fill="#9AD8FF" />
      </g>
    );
  }
  if (mood === 'sad' || mood === 'sick' || mood === 'dirty') {
    return <path d="M91 114 Q100 107 109 114" {...common} />;
  }
  if (isCat) return <path d="M100 103 v3.5 M100 106.5 q-5 6 -10 1 M100 106.5 q5 6 10 1" {...common} />;
  return <path d="M100 104 v4.5 M100 108.5 q-6 6 -12 1 M100 108.5 q6 6 12 1" {...common} />;
}

function Ear({ p, side }) {
  const flip = side === 'right' ? 'translate(200 0) scale(-1 1)' : undefined;
  if (p.ears === 'floppy') {
    return (
      <path
        transform={flip}
        d="M52 50 C30 52 20 92 30 116 C38 132 58 128 62 106 C66 84 66 60 52 50 Z"
        fill={p.ear}
        stroke={p.line}
        strokeWidth="2.4"
      />
    );
  }
  const round = p.ears === 'round';
  return (
    <g transform={flip}>
      <path
        d={round ? 'M44 70 C42 44 48 22 58 18 C66 16 82 30 96 44 Z' : 'M44 70 L50 18 Q52 10 60 14 L98 44 Z'}
        fill={p.fur}
        stroke={p.line}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d={round ? 'M54 54 C54 40 58 30 62 28 C68 30 76 38 82 44 Z' : 'M56 54 L58 28 L84 44 Z'} fill={p.inner} strokeLinejoin="round" />
    </g>
  );
}

function Tail({ p, isCat }) {
  let d = 'M136 166 C160 160 170 138 162 116';
  let w = 14;
  if (isCat) {
    d = 'M136 176 C176 178 186 140 166 112';
    w = 12;
  } else if (p.mask === 'shiba') {
    d = 'M134 158 C170 160 176 120 152 118 C138 118 140 138 152 136';
    w = 13;
  }
  return (
    <g className="wag">
      <path d={d} stroke={p.line} strokeWidth={w + 4.8} fill="none" strokeLinecap="round" />
      <path d={d} stroke={p.curly ? p.shade : p.fur} strokeWidth={w} fill="none" strokeLinecap="round" />
    </g>
  );
}

export default function Pet({ species, color, mood = 'normal', equipped = {}, className = '', excited = false, style }) {
  const uid = useId().replace(/:/g, '');
  const p = PALETTES[color] ?? (species === 'cat' ? PALETTES.cheese : PALETTES.cream);
  const isCat = (p.species ?? species) === 'cat';
  const bodyClip = `body-${uid}`;
  const dirty = mood === 'dirty';
  const outline = { stroke: p.line, strokeWidth: 2.4 };

  return (
    <svg viewBox="-10 -10 220 215" className={`pet-svg ${excited ? 'excited' : ''} ${className}`} style={style} aria-hidden="true">
      <defs>
        <clipPath id={bodyClip}>
          <ellipse cx="100" cy="152" rx="46" ry="40" />
        </clipPath>
        <radialGradient id={`shine-${uid}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {mood === 'angel' && (
        <g fill="#fff" stroke="#DCD3F2" strokeWidth="2.5" strokeLinejoin="round">
          <path d="M66 132 C40 104 6 112 4 128 C12 128 16 132 12 138 C20 138 24 142 20 148 C30 148 34 152 32 158 C46 160 60 152 68 146 Z" />
          <path d="M134 132 C160 104 194 112 196 128 C188 128 184 132 188 138 C180 138 176 142 180 148 C170 148 166 152 168 158 C154 160 140 152 132 146 Z" />
        </g>
      )}

      <ellipse cx="100" cy="194" rx="58" ry="7" fill="#000" opacity="0.08" />

      <g className="breathe">
        <Tail p={p} isCat={isCat} />

        {/* haunches */}
        <ellipse cx="62" cy="180" rx="19" ry="13" fill={p.shade} {...outline} />
        <ellipse cx="138" cy="180" rx="19" ry="13" fill={p.shade} {...outline} />

        {/* body */}
        <ellipse cx="100" cy="152" rx="46" ry="40" fill={p.fur} {...outline} />
        <g clipPath={`url(#${bodyClip})`}>
          {(p.mask || p.stripes || p.species === 'cat') && <ellipse cx="100" cy="164" rx="28" ry="30" fill={p.belly} />}
          {dirty && (
            <>
              <ellipse cx="80" cy="160" rx="9" ry="6" fill="#8B6A4E" opacity="0.4" />
              <ellipse cx="120" cy="172" rx="7" ry="5" fill="#8B6A4E" opacity="0.35" />
            </>
          )}
          {equipped.body && <Accessory id={equipped.body} />}
        </g>

        {/* front paws */}
        <g>
          <ellipse cx="80" cy="186" rx="13.5" ry="9.5" fill={p.mask === 'tuxedo' ? '#fff' : p.fur} {...outline} />
          <ellipse cx="120" cy="186" rx="13.5" ry="9.5" fill={p.mask === 'tuxedo' ? '#fff' : p.fur} {...outline} />
          <path d="M76 187 v4 M84 187 v4 M116 187 v4 M124 187 v4" stroke={p.shade} strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {equipped.neck && <Accessory id={equipped.neck} />}

        {/* head */}
        <g>
          {p.ears !== 'floppy' && (
            <>
              <Ear p={p} side="left" />
              <Ear p={p} side="right" />
            </>
          )}
          {isCat && (
            <path d="M42 96 l-10 6 l11 4 M158 96 l10 6 l-11 4" fill={p.fur} stroke={p.line} strokeWidth="2.4" strokeLinejoin="round" />
          )}
          <ellipse cx="100" cy="84" rx="62" ry="52" fill={p.fur} {...outline} />
          <ellipse cx="100" cy="84" rx="62" ry="52" fill={`url(#shine-${uid})`} />

          {p.mask === 'tuxedo' && (
            <path d="M100 66 C90 66 86 84 74 94 C60 106 70 134 100 135 C130 134 140 106 126 94 C114 84 110 66 100 66 Z" fill={p.muzzle} />
          )}
          {p.mask === 'shiba' && (
            <>
              <ellipse cx="72" cy="108" rx="24" ry="19" fill={p.muzzle} />
              <ellipse cx="128" cy="108" rx="24" ry="19" fill={p.muzzle} />
              <ellipse cx="100" cy="112" rx="22" ry="18" fill={p.muzzle} />
              <ellipse cx="79" cy="76" rx="6" ry="3.5" fill={p.muzzle} />
              <ellipse cx="121" cy="76" rx="6" ry="3.5" fill={p.muzzle} />
            </>
          )}
          {!isCat && !p.mask && <ellipse cx="100" cy="107" rx="24" ry="17" fill={p.muzzle} />}
          {isCat && !p.mask && <ellipse cx="100" cy="108" rx="20" ry="13" fill={p.muzzle} opacity="0.8" />}
          {p.stripes && (
            <g stroke={p.stripes} strokeWidth="5" strokeLinecap="round" fill="none">
              <path d="M100 36 v12" />
              <path d="M86 39 q2 6 4 10" />
              <path d="M114 39 q-2 6 -4 10" />
              <path d="M40 80 h10 M41 90 h9 M160 80 h-10 M159 90 h-9" strokeWidth="4" />
            </g>
          )}
          {p.curly && [84, 116, 100].map((x) => <circle key={x} cx={x} cy={x === 100 ? 30 : 35} r="12" fill={p.fur} {...outline} />)}
          {p.curly && [84, 100, 116].map((x) => <circle key={`s${x}`} cx={x - 3} cy={x === 100 ? 27 : 32} r="4" fill="#fff" opacity="0.18" />)}

          {p.ears === 'floppy' && (
            <>
              <Ear p={p} side="left" />
              <Ear p={p} side="right" />
            </>
          )}

          {dirty && (
            <>
              <ellipse cx="128" cy="62" rx="8" ry="5" fill="#8B6A4E" opacity="0.4" />
              <ellipse cx="66" cy="74" rx="5" ry="3.5" fill="#8B6A4E" opacity="0.35" />
            </>
          )}

          {mood === 'sad' && (
            <>
              <path d="M64 79 L84 73 M136 79 L116 73" stroke={EYE} strokeWidth="2.6" strokeLinecap="round" />
              <path d="M70 100 q-3 7 0 10 q3 -3 0 -10 Z" fill="#9AD8FF" />
            </>
          )}
          {mood === 'sick' && (
            <g stroke="#8FA6D9" strokeWidth="2.5" strokeLinecap="round" opacity="0.8">
              <path d="M72 50 v10 M80 48 v12 M88 50 v9" />
            </g>
          )}

          <Eyes mood={mood} p={p} />

          <ellipse cx="62" cy="108" rx="10" ry="6" fill={BLUSH} opacity={mood === 'happy' ? 0.75 : 0.5} />
          <ellipse cx="138" cy="108" rx="10" ry="6" fill={BLUSH} opacity={mood === 'happy' ? 0.75 : 0.5} />

          {isCat ? (
            <path d="M95 99 L105 99 L100 104.5 Z" fill={p.nose} stroke={p.nose} strokeWidth="2.5" strokeLinejoin="round" />
          ) : (
            <g>
              <path d="M91 97 Q100 91 109 97 Q105 105 100 105.5 Q95 105 91 97 Z" fill={p.nose} />
              <ellipse cx="97" cy="96" rx="3" ry="1.6" fill="#fff" opacity="0.55" />
            </g>
          )}
          <Mouth mood={mood} p={p} isCat={isCat} />

          {isCat && (
            <g stroke={p.mask === 'tuxedo' ? '#D9D4E2' : '#8C7466'} strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
              <path d="M58 103 L36 99 M58 109 L36 112 M142 103 L164 99 M142 109 L164 112" />
            </g>
          )}

          {mood === 'sick' && (
            <g transform="rotate(-25 132 52)">
              <rect x="116" y="46" width="34" height="12" rx="6" fill="#FFE0B8" stroke="#F2C18A" strokeWidth="1.5" />
              <rect x="127" y="46" width="12" height="12" fill="#FFD29A" />
              <circle cx="131" cy="50" r="0.9" fill="#E3A866" />
              <circle cx="135" cy="54" r="0.9" fill="#E3A866" />
            </g>
          )}

          {equipped.face && <Accessory id={equipped.face} />}
          {equipped.head && <Accessory id={equipped.head} cat={isCat} />}
        </g>
      </g>

      {mood === 'angel' && <ellipse cx="100" cy="14" rx="30" ry="8" fill="none" stroke="#FFD24D" strokeWidth="6" opacity="0.95" />}
    </svg>
  );
}
