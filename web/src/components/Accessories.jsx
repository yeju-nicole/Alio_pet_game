import { useId, useLayoutEffect, useRef, useState } from 'react';

/** Wearable items drawn in the pet's 200×200 coordinate space. */

function Garment({ fill, children }) {
  return (
    <g>
      <path d="M50 128 Q100 116 150 128 L152 200 L48 200 Z" fill={fill} />
      {children}
      <path d="M62 128 Q100 140 138 128" stroke="rgba(0,0,0,0.12)" strokeWidth="3" fill="none" />
    </g>
  );
}

const DRAW = {
  // ---------------- head
  ribbon: () => (
    <g transform="translate(132 40) rotate(18)">
      <path d="M0 0 C-22 -18 -30 6 -20 12 C-12 16 -4 8 0 0 Z" fill="#FF7FA6" />
      <path d="M0 0 C22 -18 30 6 20 12 C12 16 4 8 0 0 Z" fill="#FF7FA6" />
      <path d="M-2 2 L-10 22 L-4 20 L0 26 Z M2 2 L10 22 L4 20 L0 26 Z" fill="#F0628E" />
      <circle cx="0" cy="1" r="6" fill="#FF9DBB" stroke="#F0628E" strokeWidth="2" />
      <ellipse cx="-16" cy="2" rx="4" ry="2.5" fill="#fff" opacity="0.5" />
    </g>
  ),
  beanie: () => (
    <g>
      <path d="M40 70 C38 20 70 6 100 6 C130 6 162 20 160 70 Z" fill="#B8A4FF" />
      <g stroke="#A08AF5" strokeWidth="4" strokeLinecap="round" opacity="0.7">
        {[60, 76, 92, 108, 124, 140].map((x) => (
          <path key={x} d={`M${x} 22 Q${x + 2} 42 ${x} 58`} fill="none" />
        ))}
      </g>
      <rect x="34" y="56" width="132" height="20" rx="10" fill="#9C86F2" />
      <g stroke="#B8A4FF" strokeWidth="3" opacity="0.8">
        {[48, 60, 72, 84, 96, 108, 120, 132, 144, 156].map((x) => (
          <path key={x} d={`M${x} 59 v14`} />
        ))}
      </g>
      <circle cx="100" cy="4" r="14" fill="#fff" stroke="#DCD3F2" strokeWidth="2" />
      <circle cx="95" cy="0" r="5" fill="#F4F0FF" />
    </g>
  ),
  straw_hat: () => (
    <g>
      <ellipse cx="100" cy="46" rx="80" ry="17" fill="#F5D287" />
      <ellipse cx="100" cy="44" rx="80" ry="15" fill="#F9DE9C" />
      <path d="M62 44 C62 6 138 6 138 44 Z" fill="#F5D287" />
      <path d="M62 38 C80 44 120 44 138 38 L138 44 C120 50 80 50 62 44 Z" fill="#FF8FAB" />
      <g stroke="#E8BD62" strokeWidth="1.5" opacity="0.8">
        <path d="M72 24 q28 -8 56 0 M68 34 q32 -6 64 0" fill="none" />
      </g>
      <circle cx="128" cy="40" r="6" fill="#FFF" />
      <circle cx="128" cy="40" r="2.5" fill="#FFD166" />
    </g>
  ),
  flower_crown: () => {
    const spots = [
      [50, 62, '#FF9DBB'],
      [62, 46, '#FFD166'],
      [80, 36, '#fff'],
      [100, 33, '#FF9DBB'],
      [120, 36, '#B8A4FF'],
      [138, 46, '#FFD166'],
      [150, 62, '#fff'],
    ];
    return (
      <g>
        <path d="M46 66 C60 34 140 34 154 66" stroke="#7CC48A" strokeWidth="5" fill="none" strokeLinecap="round" />
        {spots.map(([x, y], i) => (
          <ellipse key={`l${i}`} cx={x + 8} cy={y + 4} rx="6" ry="3" fill="#8FD19B" transform={`rotate(30 ${x + 8} ${y + 4})`} />
        ))}
        {spots.map(([x, y, c], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="0" cy="-6" rx="4.5" ry="6" fill={c} stroke="rgba(0,0,0,0.06)" transform={`rotate(${a})`} />
            ))}
            <circle r="3.5" fill="#FFB938" />
          </g>
        ))}
      </g>
    );
  },
  frog_hat: () => (
    <g>
      <path d="M38 72 C34 22 68 8 100 8 C132 8 166 22 162 72 Z" fill="#8ED68E" />
      <path d="M38 72 C70 60 130 60 162 72 L162 78 C130 68 70 68 38 78 Z" fill="#73C373" />
      {[74, 126].map((x) => (
        <g key={x}>
          <circle cx={x} cy="16" r="16" fill="#8ED68E" />
          <circle cx={x} cy="15" r="10" fill="#fff" />
          <circle cx={x + 1} cy="16" r="5.5" fill="#2B2230" />
          <circle cx={x + 3} cy="13.5" r="2" fill="#fff" />
        </g>
      ))}
      <path d="M86 44 Q100 54 114 44" stroke="#4E9A4E" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="66" cy="48" rx="7" ry="4" fill="#FF9DB5" opacity="0.7" />
      <ellipse cx="134" cy="48" rx="7" ry="4" fill="#FF9DB5" opacity="0.7" />
    </g>
  ),
  crown: () => (
    <g transform="translate(0 -4)">
      <path d="M70 46 L66 14 L84 30 L100 8 L116 30 L134 14 L130 46 Z" fill="#FFD24D" stroke="#F0B429" strokeWidth="3" strokeLinejoin="round" />
      <rect x="68" y="40" width="64" height="10" rx="5" fill="#F0B429" />
      <circle cx="100" cy="30" r="5" fill="#FF6B9A" />
      <circle cx="82" cy="36" r="3.5" fill="#6FC3FF" />
      <circle cx="118" cy="36" r="3.5" fill="#6FC3FF" />
      <circle cx="66" cy="13" r="3.5" fill="#FFE68A" />
      <circle cx="100" cy="7" r="3.5" fill="#FFE68A" />
      <circle cx="134" cy="13" r="3.5" fill="#FFE68A" />
    </g>
  ),

  // ---------------- face
  round_glasses: () => (
    <g fill="rgba(200,230,255,0.25)" stroke="#5A4636" strokeWidth="3.2">
      <circle cx="76" cy="90" r="14" />
      <circle cx="124" cy="90" r="14" />
      <path d="M90 88 Q100 83 110 88" fill="none" />
      <path d="M62 86 L46 80 M138 86 L154 80" fill="none" />
    </g>
  ),
  heart_glasses: () => {
    const heart = (x) => `M${x} 104 C${x - 22} 90 ${x - 18} 72 ${x - 6} 76 C${x - 2} 77 ${x} 81 ${x} 83 C${x} 81 ${x + 2} 77 ${x + 6} 76 C${x + 18} 72 ${x + 22} 90 ${x} 104 Z`;
    return (
      <g>
        <path d={heart(76)} fill="#FF5C8A" stroke="#E0346A" strokeWidth="2.5" opacity="0.92" />
        <path d={heart(124)} fill="#FF5C8A" stroke="#E0346A" strokeWidth="2.5" opacity="0.92" />
        <path d="M90 84 Q100 79 110 84" stroke="#E0346A" strokeWidth="3" fill="none" />
        <path d="M58 84 L44 78 M142 84 L156 78" stroke="#E0346A" strokeWidth="3" />
        <ellipse cx="70" cy="84" rx="4" ry="2.5" fill="#fff" opacity="0.6" />
        <ellipse cx="118" cy="84" rx="4" ry="2.5" fill="#fff" opacity="0.6" />
      </g>
    );
  },

  // ---------------- neck
  bowtie: () => (
    <g transform="translate(100 136)">
      <path d="M0 0 L-22 -12 Q-27 0 -22 12 Z" fill="#FF6B8B" />
      <path d="M0 0 L22 -12 Q27 0 22 12 Z" fill="#FF6B8B" />
      <circle cx="-14" cy="-3" r="2" fill="#fff" />
      <circle cx="-12" cy="5" r="2" fill="#fff" />
      <circle cx="14" cy="-3" r="2" fill="#fff" />
      <circle cx="12" cy="5" r="2" fill="#fff" />
      <rect x="-6" y="-7" width="12" height="14" rx="5" fill="#F04C72" />
    </g>
  ),
  bandana: ({ uid }) => (
    <g>
      <defs>
        <pattern id={`check-${uid}`} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#7EC8FF" />
          <rect width="5" height="10" fill="#A5D9FF" />
          <rect width="10" height="5" fill="#A5D9FF" opacity="0.7" />
          <rect width="5" height="5" fill="#fff" opacity="0.6" />
        </pattern>
      </defs>
      <path d="M58 126 Q100 140 142 126 L104 172 Q100 176 96 172 Z" fill={`url(#check-${uid})`} stroke="#5BB4F2" strokeWidth="2" strokeLinejoin="round" />
      <path d="M58 126 Q100 142 142 126" stroke="#5BB4F2" strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  ),
  bell_collar: () => (
    <g>
      <path d="M56 126 Q100 144 144 126" stroke="#FF7A8A" strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="146" r="10" fill="#FFD24D" stroke="#F0B429" strokeWidth="2.5" />
      <path d="M92 146 h16" stroke="#E0A21F" strokeWidth="2" />
      <circle cx="100" cy="150" r="2.2" fill="#B07A10" />
      <circle cx="96" cy="142" r="2.2" fill="#fff" opacity="0.7" />
    </g>
  ),

  // ---------------- body (clipped to the body shape by Pet)
  stripe_tee: () => (
    <Garment fill="#fff">
      {[136, 152, 168, 184].map((y) => (
        <rect key={y} x="40" y={y} width="120" height="7" fill="#5B7FD6" />
      ))}
    </Garment>
  ),
  raincoat: () => (
    <Garment fill="#FFD34D">
      <path d="M100 124 V200" stroke="#F2B92C" strokeWidth="3" />
      {[146, 164, 182].map((y) => (
        <circle key={y} cx="108" cy={y} r="3.5" fill="#fff" stroke="#F2B92C" strokeWidth="1.5" />
      ))}
      <path d="M70 126 L90 142 L100 126 L110 142 L130 126" fill="#FFE07A" stroke="#F2B92C" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="72" cy="160" rx="7" ry="10" fill="#fff" opacity="0.25" />
    </Garment>
  ),
  eco_hoodie: () => (
    <Garment fill="#7FD8B6">
      <path d="M64 124 Q100 150 136 124" fill="#69C9A5" />
      <path d="M90 138 v18 M110 138 v18" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="90" cy="157" r="2.5" fill="#fff" />
      <circle cx="110" cy="157" r="2.5" fill="#fff" />
      <text x="100" y="182" textAnchor="middle" fontSize="18" fill="#fff" fontWeight="700">
        ♻
      </text>
      <rect x="70" y="186" width="60" height="10" rx="5" fill="#69C9A5" />
    </Garment>
  ),
};

export function Accessory({ id }) {
  const uid = useId().replace(/:/g, '');
  const draw = DRAW[id];
  return draw ? draw({ uid }) : null;
}

const BODY_BOX = '44 116 112 84';

/** The accessory on its own, auto-framed to its drawn size for shop and closet cards. */
export function AccessoryIcon({ id, slot, size = 64 }) {
  const uid = useId().replace(/:/g, '');
  const ref = useRef(null);
  const [box, setBox] = useState(slot === 'body' ? BODY_BOX : '0 0 200 200');

  useLayoutEffect(() => {
    if (slot === 'body' || !ref.current?.getBBox) return;
    try {
      const b = ref.current.getBBox();
      const side = Math.max(b.width, b.height) * 1.12;
      setBox(`${b.x + b.width / 2 - side / 2} ${b.y + b.height / 2 - side / 2} ${side} ${side}`);
    } catch {
      /* not rendered yet */
    }
  }, [id, slot]);

  return (
    <svg viewBox={box} width={size} height={size} aria-hidden="true">
      {slot === 'body' ? (
        <>
          <defs>
            <clipPath id={`ic-${uid}`}>
              <ellipse cx="100" cy="158" rx="46" ry="40" />
            </clipPath>
          </defs>
          <g clipPath={`url(#ic-${uid})`}>
            <Accessory id={id} />
          </g>
        </>
      ) : (
        <g ref={ref}>
          <Accessory id={id} />
        </g>
      )}
    </svg>
  );
}
