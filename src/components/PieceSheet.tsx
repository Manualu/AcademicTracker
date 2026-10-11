import { useEffect, useRef, useState } from "react";
import { drawPiece, makePainter } from "../iso/iso";
import { starsOf } from "../iso/park";
import { AREAS, CATALOG, pieceDef, RARITY, TIERS, type Rarity } from "../lib/catalog";
import type { PieceKey } from "../lib/types";
import { Icon, Sheet } from "./ui";

const REDUCE = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Visor 3D: la pieza gira de a 90°, se puede arrastrar y ver como plano con cotas. */
function Viewer({ piece, stars }: { piece: PieceKey; stars: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"pieza" | "plano">("pieza");
  const st = useRef({ k: 0, prevK: 0, fade: 1, auto: true });
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const p = pieceDef(piece);
    const idx = CATALOG.indexOf(p) + 1;
    let raf = 0;
    const t0 = performance.now();
    let R = cv.getBoundingClientRect();
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); R = cv.getBoundingClientRect(); cv.width = R.width * d; cv.height = R.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);
    const draw = (now: number) => {
      const s = st.current;
      const t = (now - t0) / 1000;
      if (s.auto && !REDUCE && Math.floor(t / 2.2) % 4 !== s.k) { s.prevK = s.k; s.k = Math.floor(t / 2.2) % 4; s.fade = 0; }
      s.fade = Math.min(1, s.fade + 0.12);
      const w = R.width, h = R.height;
      const plano = modeRef.current === "plano";
      ctx.clearRect(0, 0, w, h);
      if (plano) {
        ctx.fillStyle = "#1D4E89"; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      } else {
        const g = ctx.createRadialGradient(w / 2, h * 0.6, 10, w / 2, h * 0.6, w * 0.6); g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#DCE3EA"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
      const tw = Math.min(w * 0.5, (h - 44) / (0.55 + (p.h || 1) * 0.62)) * (plano ? 0.8 : 1);
      const ox = plano ? w * 0.4 : w / 2, oy = h - (plano ? 40 : 26) - tw / 2;
      const one = (k: number, alpha: number) => {
        ctx.globalAlpha = alpha;
        const P = makePainter(ctx, { ox, oy, tw, style: plano ? "plano" : "normal" });
        if (!plano) P.tile(0, 0, 1, 1, "#DCE2E8");
        drawPiece(P, p, 0, 0, REDUCE ? 1.2 : t, k, { star: stars });
        ctx.globalAlpha = 1;
        return P;
      };
      if (s.fade < 1) one(s.prevK, 1 - s.fade);
      const P = one(s.k, s.fade);
      if (plano) {
        const a = P.S(0, 1, 0), b = P.S(1, 1, 0);
        const off = 14, ax = a[0] - off * 0.6, ay = a[1] + off * 0.7, bx = b[0] - off * 0.6, by = b[1] + off * 0.7;
        ctx.strokeStyle = "rgba(232,241,255,.9)"; ctx.fillStyle = "rgba(232,241,255,.95)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(ax, ay); ctx.moveTo(b[0], b[1]); ctx.lineTo(bx, by); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        for (const [x, y, d] of [[ax, ay, 1], [bx, by, -1]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d * 8, y - d * 4 + 3); ctx.lineTo(x + d * 8, y - d * 4 - 3); ctx.closePath(); ctx.fill(); }
        ctx.save(); ctx.translate((ax + bx) / 2 - 8, (ay + by) / 2 - 7); ctx.transform(1, 0.5, 0, 1, 0, 0); ctx.font = "500 12px 'IBM Plex Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(p.cota ?? "", 0, 0); ctx.restore();
        const top = P.S(1, 1, p.h || 1), base = P.S(1, 1, 0);
        ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(base[0] + 14, base[1]); ctx.lineTo(top[0] + 14, top[1]); ctx.stroke(); ctx.setLineDash([]);
        const bw = Math.min(210, w * 0.5), bh = 58, rx = w - bw - 10, ry = h - bh - 10;
        ctx.fillStyle = "#1D4E89"; ctx.fillRect(rx, ry, bw, bh); ctx.strokeRect(rx, ry, bw, bh);
        ctx.beginPath(); ctx.moveTo(rx, ry + 22); ctx.lineTo(rx + bw, ry + 22); ctx.moveTo(rx + bw * 0.55, ry + 22); ctx.lineTo(rx + bw * 0.55, ry + bh); ctx.stroke();
        ctx.fillStyle = "rgba(232,241,255,.95)"; ctx.textAlign = "left"; ctx.font = "600 11px 'IBM Plex Sans', sans-serif";
        ctx.fillText(p.n.length > 28 ? p.n.slice(0, 27) + "…" : p.n, rx + 6, ry + 15);
        ctx.font = "500 10px 'IBM Plex Mono', monospace";
        ctx.fillText("ESC 1:50", rx + 6, ry + 37); ctx.fillText(`LÁM. ${String(idx).padStart(2, "0")}/${CATALOG.length}`, rx + 6, ry + 51);
        ctx.fillText("REMONTADA", rx + bw * 0.55 + 6, ry + 37); ctx.fillText("FIUBA", rx + bw * 0.55 + 6, ry + 51);
      }
      if (!REDUCE) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [piece, stars, mode]);

  const rot = (dir: number) => { const s = st.current; s.prevK = s.k; s.k = (s.k + dir + 4) % 4; s.fade = 0; s.auto = false; };
  const drag = useRef<number | null>(null);
  return (
    <div className="viewer">
      <canvas ref={ref} role="img" aria-label="Vista 3D de la pieza. Arrastrá para girarla."
        onPointerDown={(e) => { drag.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current == null) return; if (Math.abs(e.clientX - drag.current) > 45) { rot(e.clientX > drag.current ? 1 : -1); drag.current = e.clientX; } }}
        onPointerUp={() => { drag.current = null; }} />
      <div className="seg vmode" role="group" aria-label="Vista">
        <button aria-pressed={mode === "pieza"} onClick={() => setMode("pieza")}>Pieza</button>
        <button aria-pressed={mode === "plano"} onClick={() => setMode("plano")}>Plano</button>
      </div>
      <div className="vtools">
        <button className="icon-btn boxed" onClick={() => rot(-1)} aria-label="Girar a la izquierda"><Icon name="rotl" size={18} /></button>
        <button className="icon-btn boxed" onClick={() => rot(1)} aria-label="Girar a la derecha"><Icon name="rotr" size={18} /></button>
      </div>
    </div>
  );
}

/** Ficha técnica de una pieza. `count` = cuántas tiene la persona que se está mirando. */
export function PieceSheet({ piece, count, owner, onClose }: { piece: PieceKey | null; count: number; owner: string; onClose: () => void }) {
  if (!piece) return null;
  const p = pieceDef(piece);
  const tier = TIERS.find((t) => t.t === p.tier);
  const rar = RARITY[p.r as Rarity];
  return (
    <Sheet open onClose={onClose} label={p.n} title={p.n} eyebrow={tier ? `Categoría ${tier.t} · ${tier.name}` : "Fuera de categoría"}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="rar" style={{ ["--rc" as string]: rar.color }}>{rar.n}</span>
          {count > 0 && <span className="small strong">{"★".repeat(starsOf(count))} <span className="muted">· {owner} tiene {count}</span></span>}
          {count === 0 && <span className="small muted">{owner} todavía no la tiene</span>}
        </div>
        <Viewer piece={p.id} stars={count ? starsOf(count) : 1} />
        <p style={{ margin: 0 }}>{p.uso}</p>
        <table className="specs"><tbody>
          {p.specs.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
          <tr><td>Sale con</td><td>{tier ? `Sesiones: ${tier.label.toLowerCase()}` : "Cortar una sesión antes de tiempo"}</td></tr>
          <tr><td>Materias afines</td><td>{AREAS[p.a as keyof typeof AREAS] ?? AREAS.general}</td></tr>
        </tbody></table>
      </div>
    </Sheet>
  );
}
