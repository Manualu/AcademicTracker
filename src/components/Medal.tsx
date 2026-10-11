import { useId } from "react";

/** Medalla con forma de tuerca para los trofeos. */
export function Medal({ glyph, earned, size = 58 }: { glyph: string; earned: boolean; size?: number }) {
  const id = useId().replace(/:/g, "");
  const hexAt = (cy: number, r: number) => Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(32 + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  const fs = glyph.length >= 4 ? 12 : glyph.length === 3 ? 15 : 19;
  if (!earned) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" className="medal" aria-hidden>
        <polygon points={hexAt(32, 27)} fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
        <circle cx="32" cy="32" r="15" fill="none" stroke="var(--ink-3)" strokeWidth="2" />
        <text x="32" y="32" dominantBaseline="central" textAnchor="middle" fontFamily="var(--display)" fontWeight="800" fontSize={fs} fill="var(--ink-3)">{glyph}</text>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="medal" aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE07A" />
          <stop offset="0.55" stopColor="#FFC21A" />
          <stop offset="1" stopColor="#E9A400" />
        </linearGradient>
      </defs>
      <polygon points={hexAt(35.5, 27)} fill="#B67F00" stroke="#101B33" strokeWidth="2" strokeLinejoin="round" />
      <polygon points={hexAt(31, 27)} fill={`url(#g${id})`} stroke="#101B33" strokeWidth="2" strokeLinejoin="round" />
      <polygon points={hexAt(31, 21)} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="32" cy="31" r="14.5" fill="#101B33" />
      <circle cx="32" cy="31" r="14.5" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
      <text x="32" y="31.5" dominantBaseline="central" textAnchor="middle" fontFamily="var(--display)" fontWeight="800" fontSize={fs} fill="#FFC21A">{glyph}</text>
    </svg>
  );
}
