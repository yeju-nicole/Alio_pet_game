import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useGame, fmt } from '../store.jsx';

export function Sheet({ onClose, title, children, className = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="grip" />
        {title && (
          <div className="row" style={{ marginBottom: 8 }}>
            <h3 style={{ flex: 1 }}>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="닫기" style={{ boxShadow: 'none', background: '#f4e9e3' }}>
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  );
}

export function Modal({ onClose, children }) {
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true">
        {children}
      </div>
    </>
  );
}

export function Toasts() {
  const { toasts, floats } = useGame();
  return (
    <>
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.text}
          </div>
        ))}
      </div>
      {floats.map((f) => (
        <div key={f.id} className="float-points" style={{ left: '50%', top: 'calc(var(--safe-top) + 150px)' }}>
          +{fmt(f.amount)}P
        </div>
      ))}
    </>
  );
}

const CONFETTI_COLORS = ['#FF8FAB', '#FFD166', '#5FCFB4', '#B8A4FF', '#8FD3FF', '#FFB38A'];

export function Confetti({ count = 60 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.2 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: (Math.random() - 0.5) * 120,
        spin: (Math.random() - 0.5) * 1080,
        round: Math.random() > 0.6,
      })),
    [count],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            borderRadius: p.round ? '50%' : 3,
            width: p.round ? 10 : 8,
            height: p.round ? 10 : 14,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            '--drift': `${p.drift}px`,
            '--spin': `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function Coin({ size = 26 }) {
  return (
    <span className="coin" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      P
    </span>
  );
}

export function Ring({ value, max, size = 92, stroke = 10, color = 'var(--mint)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max ? value / max : 0);
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#f1e6e0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

export function Empty({ emoji, title, children }) {
  return (
    <div className="center" style={{ padding: '30px 20px' }}>
      <div style={{ fontSize: 46 }}>{emoji}</div>
      <div className="cute" style={{ fontSize: 20, margin: '8px 0 4px' }}>
        {title}
      </div>
      <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
}

export function Logo({ size = 34 }) {
  return (
    <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
      <span style={{ fontWeight: 900, fontSize: size * 0.62, color: 'var(--mint-deep)', letterSpacing: -0.5 }}>alio</span>
      <span className="cute" style={{ fontSize: size, color: 'var(--pink-deep)', lineHeight: 1 }}>
        멍냥이
      </span>
    </div>
  );
}
