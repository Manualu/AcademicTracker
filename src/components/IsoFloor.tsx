import { useEffect, useRef, useState } from "react";
import { drawPiece, makePainter } from "../iso/iso";
import { pieceDef } from "../lib/catalog";
import type { PieceKey } from "../lib/types";

/** Platea de hormigón con las piezas de la semana, en isométrico. */
export function IsoFloor({ pieces, slots }: { pieces: PieceKey[]; slots?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const [height, setH] = useState(180);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!w) return;
    const n = Math.max(pieces.length, slots ?? 0, 1);
    const cols = Math.max(3, Math.ceil(Math.sqrt(n * 1.5)));
    const rows = Math.max(2, Math.ceil(n / cols));
    const maxH = Math.max(0.6, ...pieces.map((p) => pieceDef(p).h ?? 0.9));
    const slab = 0.18;
    const tw = Math.min(110, (w - 20) / ((cols + rows) / 2));
    const height = Math.round(((cols + rows) / 4) * tw + (maxH * 0.62 + slab * 0.62) * tw + 22);
    setH(height);
    const c = ref.current!;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    c.width = Math.round(w * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);

    const ox = w / 2 + ((rows - cols) / 4) * tw;
    const oy = 10 + maxH * 0.62 * tw;
    const P = makePainter(ctx, { ox, oy, tw });

    P.box(0, 0, -slab, cols, rows, slab, "#AEB8C3");
    for (let x = 0; x < cols; x++)
      for (let y = 0; y < rows; y++) P.tile(x + 0.04, y + 0.04, 0.92, 0.92, (x + y) % 2 ? "#D3DAE2" : "#DCE2E8");
    // Línea de seguridad amarilla en el borde frontal
    ctx.strokeStyle = "#FFC21A";
    ctx.lineWidth = Math.max(1.5, tw * 0.035);
    ctx.setLineDash([tw * 0.12, tw * 0.08]);
    ctx.beginPath();
    ctx.moveTo(...P.S(0.08, rows - 0.08));
    ctx.lineTo(...P.S(cols - 0.08, rows - 0.08));
    ctx.lineTo(...P.S(cols - 0.08, 0.08));
    ctx.stroke();
    ctx.setLineDash([]);

    // Piezas en orden de profundidad
    const cells: [number, number][] = [];
    for (let s = 0; s < cols + rows; s++) for (let x = 0; x < cols; x++) { const y = s - x; if (y >= 0 && y < rows) cells.push([x, y]); }
    // Llenamos primero las del fondo para que la platea se lea de atrás hacia adelante
    pieces.slice(0, cols * rows).forEach((p, i) => {
      const [x, y] = cells[i];
      drawPiece(P, pieceDef(p), x, y, 1.2, (i * 3) % 4 === 1 ? 1 : 0, { mini: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, pieces.join(","), slots]);

  return (
    <div ref={wrap} className="iso-floor" style={{ height }}>
      <canvas ref={ref} style={{ width: "100%", height }} aria-hidden />
    </div>
  );
}
