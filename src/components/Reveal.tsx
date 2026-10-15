import { useEffect, useRef, useState, type ReactNode } from "react";
import { drawPiece, makeFrame, makePainter } from "../iso/iso";
import { starsOf } from "../iso/park";
import { sfx } from "../lib/sound";
import { pieceDef, RARITY, type Rarity } from "../lib/catalog";
import type { PieceKey } from "../lib/types";

const REDUCE = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Apertura de la pieza: un cajón de madera que tiembla, se abre y aparece la máquina
 * con el color de su rareza. `count` = cuántas tiene ahora (contando esta).
 */
export function Reveal({ piece, count, children }: { piece: PieceKey; count: number; children: (shown: boolean) => ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ui = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(REDUCE);
  const p = pieceDef(piece);
  const rc = RARITY[p.r as Rarity].color;

  // Golpes del cajón y el brillo al abrirse (si los efectos están prendidos)
  useEffect(() => { const t = window.setTimeout(() => sfx("crate"), REDUCE ? 0 : 450); return () => window.clearTimeout(t); }, []);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const d = Math.min(2, devicePixelRatio || 1);
    let W = 0, H = 0;
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);
    const big = p.r === "epica" || p.r === "legendaria";
    const conf = Array.from({ length: big ? 90 : 34 }, () => ({
      a: Math.random() * Math.PI * 2, v: 120 + Math.random() * 260,
      c: ["#FFC21A", "#FF5A8A", "#4FC3F7", "#7CFFB2", rc][Math.floor(Math.random() * 5)], s: 3 + Math.random() * 4,
    }));
    const scrap = p.id === "chatarra";
    const t0 = performance.now();
    let raf = 0;
    let told = false;
    const draw = (now: number) => {
      const t = REDUCE ? 9 : (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      // La pieza va en el espacio libre de arriba del texto, así no se pisan (en compu la pantalla es baja y ancha)
      const reserve = Math.max(ui.current?.offsetHeight ?? 0, 230) + 36;
      const free = Math.max(160, H - reserve);
      const cx = W / 2, cy = free * 0.46;
      const tw = Math.min(W * 0.36, free * 0.34);
      if (t < 1.2) {
        const shake = Math.sin(t * 40) * (t * 5);
        const P = makePainter(ctx, { ox: cx + shake, oy: cy + tw * 0.2, tw });
        const F = makeFrame(P, 0, 0, 1, 1, 0); F.ctx = ctx; F.P = P;
        F.box(0.1, 0.1, 0, 0.8, 0.8, 0.7, "#C68B59");
        F.box(0.1, 0.45, 0, 0.8, 0.1, 0.72, "#9E6A40", { o: 0.1 }); F.box(0.45, 0.1, 0, 0.1, 0.8, 0.72, "#9E6A40", { o: 0.1 });
        F.text(0.42, 0.901, 0.38, "REMONTADA", { size: 0.07, color: "#5A3A22", face: "y", weight: 800, o: 0.2 });
        F.text(0.901, 0.6, 0.38, "FRÁGIL", { size: 0.07, color: "#5A3A22", face: "x", weight: 800, o: 0.2 });
        F.flush();
        ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = "500 12px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
        ctx.fillText("ABRIENDO EL CAJÓN…", cx, cy + tw * 1.15);
      } else {
        const k = Math.min(1, (t - 1.2) / 0.6);
        if (!scrap) {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.3);
          for (let i = 0; i < 14; i++) { ctx.rotate((Math.PI * 2) / 14); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, -40); ctx.lineTo(W, 40); ctx.closePath(); ctx.fillStyle = rc + (i % 2 ? "22" : "11"); ctx.fill(); }
          ctx.restore();
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, tw * 1.6); g.addColorStop(0, rc + "88"); g.addColorStop(1, rc + "00"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          for (const c of conf) {
            const r = c.v * Math.min(1.4, t - 1.2);
            const x = cx + Math.cos(c.a) * r, y = cy + Math.sin(c.a) * r + (t - 1.2) * (t - 1.2) * 60;
            ctx.fillStyle = c.c; ctx.globalAlpha = Math.max(0, 1 - (t - 1.2) / 2.2); ctx.fillRect(x, y, c.s, c.s);
          }
          ctx.globalAlpha = 1;
        }
        const kk = Math.floor(t / 1.1) % 4;
        const P = makePainter(ctx, { ox: cx, oy: cy + tw * 0.55 - (1 - k) * 40, tw: tw * (0.6 + 0.4 * k) });
        drawPiece(P, p, 0, 0, t, REDUCE ? 0 : kk, { star: starsOf(count) });
        if (t > 1.5 && !told) { told = true; setShown(true); }
      }
      if (!REDUCE) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [p, rc, count]);

  return (
    <div className="reveal" role="dialog" aria-modal="true" aria-label="Pieza nueva">
      <canvas ref={ref} aria-hidden onClick={() => setShown(true)} />
      <div className="reveal-ui" ref={ui}>{children(shown)}</div>
    </div>
  );
}
