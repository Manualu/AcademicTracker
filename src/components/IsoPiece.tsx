import { useEffect, useRef } from "react";
import { drawPiece, makePainter, PIECE_BY_ID, type IsoPieceDef } from "../iso/iso";
import type { PieceKey } from "../lib/types";

/** Pieza de la app → modelo 3D del catálogo isométrico. */
export const ISO_ID: Record<PieceKey, string> = {
  tornillo: "bulones",
  engranaje: "engranaje",
  motor: "motor",
  torno: "torno",
  robot: "robot",
  horno: "horno",
  chatarra: "chatarra",
};

const REDUCE = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const cache = new Map<string, string>();

type Geo = { w: number; h: number; tw: number; ox: number; oy: number };

function geometry(def: IsoPieceDef, w: number, h: number, pad = 0.06): Geo {
  const ph = def.h ?? 0.9;
  const tw = Math.min(w * (1 - pad * 2) * 0.92, (h * (1 - pad * 2)) / (0.5 + ph * 0.62));
  const total = tw * (0.5 + ph * 0.62);
  const top = (h - total) / 2;
  return { w, h, tw, ox: w / 2, oy: top + ph * 0.62 * tw };
}

function shadow(ctx: CanvasRenderingContext2D, g: Geo) {
  const cx = g.ox, cy = g.oy + g.tw * 0.25;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.tw * 0.62);
  grad.addColorStop(0, "rgba(10,20,40,.28)");
  grad.addColorStop(1, "rgba(10,20,40,0)");
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.5);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, g.tw * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paint(ctx: CanvasRenderingContext2D, def: IsoPieceDef, g: Geo, t: number, opts: { plate?: boolean; style?: "normal" | "plano" | "sil"; silColor?: string }) {
  const P = makePainter(ctx, { ox: g.ox, oy: g.oy, tw: g.tw, style: opts.style ?? "normal", silColor: opts.silColor });
  if (opts.style !== "plano" && opts.style !== "sil") shadow(ctx, g);
  if (opts.plate) P.tile(0, 0, 1, 1, "#DCE2E8");
  drawPiece(P, def, 0, 0, t, 0, { mini: true });
}

/** Imagen estática (data URL) de una pieza; queda cacheada. */
export function isoImage(piece: PieceKey | string, w: number, h = w, opts: { plate?: boolean; sil?: string } = {}): string {
  const id = (ISO_ID as Record<string, string>)[piece] ?? piece;
  const key = `${id}:${w}x${h}:${opts.plate ? 1 : 0}:${opts.sil ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = PIECE_BY_ID[id];
  const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  const c = document.createElement("canvas");
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const ctx = c.getContext("2d")!;
  ctx.scale(dpr, dpr);
  paint(ctx, def, geometry(def, w, h), 1.2, { plate: opts.plate, style: opts.sil ? "sil" : "normal", silColor: opts.sil });
  const url = c.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

type Props = {
  piece: PieceKey;
  size?: number;
  /** Alto, si no es cuadrada */
  height?: number;
  className?: string;
  title?: string;
  /** Silueta en lugar de la pieza a color (pieza todavía no conseguida) */
  locked?: boolean;
};

/** Pieza isométrica como <img>, liviana para listas. */
export function IsoPiece({ piece, size = 48, height, className, title, locked }: Props) {
  const h = height ?? size;
  const src = isoImage(piece, size, h, locked ? { sil: "#9AA6B6" } : {});
  return <img src={src} width={size} height={h} alt={title ?? ""} title={title} className={`iso ${locked ? "iso-locked" : ""} ${className ?? ""}`} draggable={false} />;
}

/**
 * Pieza animada en canvas. Con `progress` se dibuja el plano (líneas) y la parte
 * ya fabricada a color, de abajo hacia arriba.
 */
export function IsoPieceLive({ piece, size = 160, height, progress, planoColor = "rgba(232,241,255,.9)" }: {
  piece: PieceKey; size?: number; height?: number; progress?: number; planoColor?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const prog = useRef(progress);
  prog.current = progress;
  const h = height ?? size;

  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    c.width = Math.round(size * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d")!;
    const def = PIECE_BY_ID[ISO_ID[piece]];
    const g = geometry(def, size, h, 0.0);
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30 fps alcanza y ahorra batería
      last = now;
      const t = REDUCE ? 1.2 : (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, h);
      const p = prog.current;
      if (p === undefined || p >= 1) {
        paint(ctx, def, g, t, {});
        return;
      }
      // Plano (lo que falta)
      ctx.save();
      ctx.globalAlpha = 0.9;
      paint(ctx, def, g, t, { style: "plano" });
      ctx.restore();
      // Lo fabricado, recortado desde abajo
      const ph = def.h ?? 0.9;
      const bottom = g.oy + g.tw * 0.5;
      const top = g.oy - ph * 0.62 * g.tw - g.tw * 0.08;
      const y = bottom - (bottom - top) * Math.max(0, Math.min(1, p));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y, size, h - y);
      ctx.clip();
      paint(ctx, def, g, t, {});
      ctx.restore();
      // Línea de corte, como un escáner
      ctx.strokeStyle = planoColor;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(g.ox - g.tw * 0.62, y);
      ctx.lineTo(g.ox + g.tw * 0.62, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(frame); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); };
  }, [piece, size, h, planoColor]);

  return <canvas ref={ref} style={{ width: size, height: h, display: "block" }} aria-hidden />;
}
