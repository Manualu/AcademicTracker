import { useId } from "react";
import type { PieceKey } from "../lib/types";

const Y = "var(--yellow)";
const W = "var(--card)";
const L = "var(--line)";
const G = "var(--ink-3)";

function gearPath(cx: number, cy: number, teeth: number, rOut: number, rIn: number): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const corners = [
      [rIn, a - step * 0.5],
      [rIn, a - step * 0.3],
      [rOut, a - step * 0.17],
      [rOut, a + step * 0.17],
      [rIn, a + step * 0.3],
    ];
    for (const [r, t] of corners) pts.push(`${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

const GEAR = gearPath(32, 32, 10, 27, 20);

/** Dibujos de cada pieza, en una grilla de 64×64. `plan` = versión de plano (sin color). */
function Drawing({ piece, plan }: { piece: PieceKey; plan?: boolean }) {
  const y = plan ? "none" : Y;
  const w = plan ? "none" : W;
  const ink = plan ? "none" : L;
  switch (piece) {
    case "tornillo":
      return (
        <>
          <path d="M19 9h26l-3 11H22z" fill={y} />
          <path d="M27 20h10v31l-5 9-5-9z" fill={w} />
          <path d="M27 27l10-3M27 33l10-3M27 39l10-3M27 45l10-3" />
        </>
      );
    case "engranaje":
      return (
        <>
          <path d={GEAR} fill={y} />
          <circle cx="32" cy="32" r="12" fill={w} />
          <circle cx="32" cy="32" r="5" fill={ink} />
        </>
      );
    case "motor":
      return (
        <>
          <rect x="20" y="9" width="14" height="9" rx="1.5" fill={w} />
          <rect x="8" y="18" width="40" height="30" rx="5" fill={y} />
          <path d="M15 23v20M21 23v20M27 23v20M33 23v20M39 23v20" />
          <rect x="48" y="29" width="10" height="8" rx="1.5" fill={w} />
          <path d="M13 48l-2 7h34l-2-7" fill={w} />
        </>
      );
    case "torno":
      return (
        <>
          <rect x="5" y="40" width="54" height="7" rx="1.5" fill={w} />
          <path d="M10 47v9h7v-9M47 47v9h7v-9" fill={w} />
          <rect x="7" y="17" width="17" height="23" rx="2" fill={y} />
          <circle cx="15.5" cy="27" r="4" fill={w} />
          <rect x="24" y="23" width="5" height="12" fill={w} />
          <rect x="29" y="27" width="17" height="4" fill={w} />
          <path d="M46 40V23h10v17" fill={y} />
        </>
      );
    case "robot":
      return (
        <>
          <rect x="11" y="51" width="28" height="7" rx="1.5" fill={w} />
          <rect x="19" y="42" width="12" height="9" fill={y} />
          <path d="M25 43L19 21L43 13" stroke={L} strokeWidth="11" />
          <path d="M25 43L19 21L43 13" stroke={plan ? "none" : Y} strokeWidth="6" />
          <circle cx="25" cy="43" r="4.5" fill={w} />
          <circle cx="19" cy="21" r="4.5" fill={w} />
          <path d="M43 13l9-6M43 13l10 4" strokeWidth="3.5" />
        </>
      );
    case "horno":
      return (
        <>
          <rect x="44" y="12" width="9" height="46" fill={w} />
          <circle cx="50" cy="7" r="3.5" fill={w} />
          <path d="M17 58l4-36h18l4 36z" fill={y} />
          <rect x="19" y="15" width="22" height="7" rx="1.5" fill={w} />
          <path d="M19.6 34h20.8M18.3 46h23.4" />
          <path d="M26 58v-8a4 4 0 0 1 8 0v8" fill={ink} />
        </>
      );
    case "chatarra":
      return (
        <>
          <path d="M8 52l7-14 9 5 6-13 13 7 7-8 6 23z" fill={plan ? "none" : G} />
          <path d="M22 44l3 4M37 38l-2 6M47 41l-3 5" />
          <path d="M12 26l5-4 3 5 5-4 3 5" />
          <circle cx="47" cy="20" r="4" fill={w} />
        </>
      );
  }
}

type Props = {
  piece: PieceKey;
  size?: number;
  /** 0..1: cuánto de la pieza ya se fabricó (se rellena de abajo hacia arriba) */
  progress?: number;
  className?: string;
  title?: string;
};

export function Piece({ piece, size = 40, progress, className, title }: Props) {
  const id = useId().replace(/:/g, "");
  const common = { fill: "none", stroke: L, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {progress === undefined ? (
        <g {...common}><Drawing piece={piece} /></g>
      ) : (
        <>
          <defs>
            <clipPath id={`c${id}`}>
              <rect x="0" y={64 - 64 * Math.min(1, Math.max(0, progress))} width="64" height="64" />
            </clipPath>
          </defs>
          <g {...common} stroke="var(--ink-3)" strokeDasharray="3 3"><Drawing piece={piece} plan /></g>
          <g {...common} clipPath={`url(#c${id})`}><Drawing piece={piece} /></g>
        </>
      )}
    </svg>
  );
}

/** Medalla con forma de tuerca para los trofeos. */
export function Medal({ glyph, earned, size = 58 }: { glyph: string; earned: boolean; size?: number }) {
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(32 + 28 * Math.cos(a)).toFixed(1)},${(32 + 28 * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  const fs = glyph.length >= 4 ? 13 : glyph.length === 3 ? 16 : 20;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="medal" aria-hidden>
      <polygon points={hex} fill={earned ? Y : "none"} stroke={L} strokeWidth="2.5" strokeDasharray={earned ? undefined : "4 3"} strokeLinejoin="round" />
      <circle cx="32" cy="32" r="16" fill={earned ? W : "none"} stroke={L} strokeWidth="2.5" />
      <text x="32" y="32" dominantBaseline="central" textAnchor="middle" fontFamily="var(--display)" fontWeight="800" fontSize={fs} fill={L}>
        {glyph}
      </text>
    </svg>
  );
}
