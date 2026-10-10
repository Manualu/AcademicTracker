// Motor isométrico y catálogo de piezas, portado del prototipo del Parque Remontada.
/* eslint-disable */
// ============================================================================
// Motor isométrico: pintor con primitivas 3D, rotación, estilos y cámara
// Coordenadas de grilla: x hacia abajo-derecha, y hacia abajo-izquierda, z hacia arriba.
// ============================================================================
const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function shade(hex, f) {
  let [r, g, b] = hexToRgb(hex);
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return rgbToHex(r, g, b);
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function hash2(x, y, k = 0) {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) / 4294967296;
}

const NIGHT_TINT = "#0F1D38";
// Cache de colores ya calculados (la mezcla de colores por cuadro era lo más caro del render)
const COLOR_CACHE = new Map();

/**
 * Crea un pintor.
 * opts: { ox, oy, tw, night (0..1), dusk (0..1), style: "normal"|"plano"|"sil", silColor, line }
 */
function makePainter(ctx0, opts) {
  let ctx = ctx0;
  const tw = opts.tw, th = tw / 2, zh = tw * 0.62;
  const ox = opts.ox, oy = opts.oy;
  const night = opts.night || 0, dusk = opts.dusk || 0;
  const style = opts.style || "normal";
  const lw = Math.max(0.5, Math.min(1.6, tw / 64));
  const S = (x, y, z = 0) => [ox + (x - y) * tw / 2, oy + (x + y) * th / 2 - z * zh];
  const strokeCol = style === "plano" ? "rgba(232,241,255,.95)" : night > 0.5 ? "rgba(4,10,24,.62)" : "rgba(20,33,61,.58)";

  // Color final de una cara según luz del día/noche
  const nq = Math.round(night * 20) / 20, dq = Math.round(dusk * 20) / 20;
  function col(c, f = 0, em = false) {
    if (style === "plano") return "rgba(232,241,255,.07)";
    if (style === "sil") return opts.silColor || "#C5CDD6";
    if (c[0] !== "#") return c;
    const key = c + f + (em ? "e" : "") + nq + "|" + dq;
    let x = COLOR_CACHE.get(key);
    if (x) return x;
    x = f ? shade(c, f) : c;
    if (em) x = nq > 0.3 ? shade(x, 0.15) : x;
    else {
      if (dq) x = mix(x, "#F2A65A", dq * 0.14);
      if (nq) x = mix(x, NIGHT_TINT, nq * 0.58);
    }
    if (COLOR_CACHE.size > 20000) COLOR_CACHE.clear();
    COLOR_CACHE.set(key, x);
    return x;
  }
  function poly(pts, fill, stroke = true, alpha = 1) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (alpha < 1) ctx.globalAlpha = alpha;
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = strokeCol; ctx.lineWidth = style === "plano" ? 1.1 : lw; ctx.lineJoin = "round"; ctx.stroke(); }
    if (alpha < 1) ctx.globalAlpha = 1;
  }
  function ellipsePts(cx, cy, z, r, n = 18) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push(S(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); }
    return out;
  }

  const P = {
    S, tw, th, zh, ctx, night, dusk, style, lw, col, poly,
    setCtx(c) { ctx = c; P.ctx = c; },
    // ---- primitivas (en coordenadas de mundo) ----
    box(x, y, z, w, d, h, c, o = {}) {
      const a = o.alpha ?? 1;
      if (o.top !== false) {
        poly([S(x + w, y, z), S(x + w, y + d, z), S(x + w, y + d, z + h), S(x + w, y, z + h)], col(c, -0.22, o.em), true, a);
        poly([S(x, y + d, z), S(x + w, y + d, z), S(x + w, y + d, z + h), S(x, y + d, z + h)], col(c, -0.06, o.em), true, a);
        poly([S(x, y, z + h), S(x + w, y, z + h), S(x + w, y + d, z + h), S(x, y + d, z + h)], col(c, 0.16, o.em), true, a);
      }
    },
    cyl(cx, cy, z, r, h, c, o = {}) {
      const [bx, by] = S(cx, cy, z), [tx, ty] = S(cx, cy, z + h);
      const rx = r * tw * 0.7071, ry = r * th * 0.7071;
      if (o.alpha) ctx.globalAlpha = o.alpha;
      ctx.beginPath();
      ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI);
      ctx.lineTo(tx - rx, ty);
      ctx.ellipse(tx, ty, rx, ry, 0, Math.PI, 0, true);
      ctx.closePath();
      if (style === "normal") {
        const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0);
        g.addColorStop(0, col(c, 0.1, o.em)); g.addColorStop(0.45, col(c, -0.02, o.em)); g.addColorStop(1, col(c, -0.3, o.em));
        ctx.fillStyle = g;
      } else ctx.fillStyle = col(c);
      ctx.fill();
      ctx.strokeStyle = strokeCol; ctx.lineWidth = lw; ctx.stroke();
      if (o.capless) { ctx.globalAlpha = 1; return; }
      ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = col(o.cap || c, o.cap ? 0 : 0.18, o.em); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
    },
    cone(cx, cy, z, r, h, c, o = {}) {
      const [bx, by] = S(cx, cy, z), [tx, ty] = S(cx, cy, z + h);
      const rx = r * tw * 0.7071, ry = r * th * 0.7071;
      ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI); ctx.lineTo(tx, ty); ctx.closePath();
      if (style === "normal") {
        const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0);
        g.addColorStop(0, col(c, 0.12, o.em)); g.addColorStop(1, col(c, -0.3, o.em));
        ctx.fillStyle = g;
      } else ctx.fillStyle = col(c);
      ctx.fill(); ctx.strokeStyle = strokeCol; ctx.lineWidth = lw; ctx.stroke();
    },
    dome(cx, cy, z, r, c, o = {}) {
      const [bx, by] = S(cx, cy, z);
      const rx = r * tw * 0.7071, ry = r * th * 0.7071, hh = r * zh * (o.k ?? 1);
      if (o.alpha) ctx.globalAlpha = o.alpha;
      ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI); ctx.ellipse(bx, by, rx, hh, 0, 0, Math.PI, true); ctx.closePath();
      if (style === "normal") {
        const g = ctx.createRadialGradient(bx - rx * 0.35, by - hh * 0.6, rx * 0.1, bx, by, rx * 1.1);
        g.addColorStop(0, col(c, 0.3, o.em)); g.addColorStop(1, col(c, -0.25, o.em)); ctx.fillStyle = g;
      } else ctx.fillStyle = col(c);
      ctx.fill(); ctx.strokeStyle = strokeCol; ctx.lineWidth = lw; ctx.stroke();
      ctx.globalAlpha = 1;
    },
    // cilindro horizontal: eje "x" o "y", desde (x,y,z) [centro de la tapa inicial], largo len, radio r
    hcyl(ax, x, y, z, len, r, c, o = {}) {
      const n = 20, A = [], B = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, u = Math.cos(a) * r, v = Math.sin(a) * r;
        if (ax === "x") { A.push(S(x, y + u, z + v)); B.push(S(x + len, y + u, z + v)); }
        else { A.push(S(x + u, y, z + v)); B.push(S(x + u, y + len, z + v)); }
      }
      const body = hull(A.concat(B));
      if (style === "normal") {
        const [sx, sy] = S(x, y, z + r), [ex, ey] = S(x, y, z - r);
        const g = ctx.createLinearGradient(sx, sy, ex, ey);
        g.addColorStop(0, col(c, 0.22, o.em)); g.addColorStop(0.5, col(c, 0, o.em)); g.addColorStop(1, col(c, -0.3, o.em));
        poly(body, g, true, o.alpha ?? 1);
      } else poly(body, col(c), true);
      poly(B, col(o.cap || c, o.cap ? 0 : -0.12, o.em), true, o.alpha ?? 1);
    },
    flat(pts, z, c, o = {}) { poly(pts.map(([px, py]) => S(px, py, z)), col(c, 0, o.em), o.stroke !== false, o.alpha ?? 1); },
    q3(pts, c, o = {}) { poly(pts.map(([px, py, pz]) => S(px, py, pz)), col(c, o.f || 0, o.em), o.stroke !== false, o.alpha ?? 1); },
    l3(pts, c, w = 1, o = {}) {
      ctx.beginPath();
      pts.forEach(([px, py, pz], i) => { const [sx, sy] = S(px, py, pz); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.strokeStyle = style === "plano" ? "rgba(232,241,255,.9)" : col(c, 0, o.em);
      ctx.lineWidth = Math.max(0.6, w * tw / 64); ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.stroke(); ctx.setLineDash([]);
    },
    // anillo vertical (rueda, volante) en el plano perpendicular a "ax", centrado en (x,y,z)
    ring(ax, x, y, z, r, c, w = 2, spokes = 0, rot = 0, o = {}) {
      const pt = (a, rr) => (ax === "x" ? S(x, y + Math.cos(a) * rr, z + Math.sin(a) * rr) : S(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr));
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) { const [sx, sy] = pt((i / 28) * Math.PI * 2, r); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }
      ctx.strokeStyle = style === "plano" ? "rgba(232,241,255,.9)" : col(c, 0, o.em); ctx.lineWidth = Math.max(1, w * tw / 64); ctx.stroke();
      for (let i = 0; i < spokes; i++) {
        const a = rot + (i / spokes) * Math.PI * 2; const [ax0, ay0] = pt(a, 0.0001); const [ax1, ay1] = pt(a, r);
        ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.lineWidth = Math.max(0.8, (w * 0.6) * tw / 64); ctx.stroke();
      }
      if (o.hub) { const [hx, hy] = pt(0, 0.0001); ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.5, r * tw * 0.12), 0, Math.PI * 2); ctx.fillStyle = col(o.hub); ctx.fill(); }
    },
    // polígono plano en el suelo sin borde (para texturas)
    tile(x, y, w, d, c, z = 0) { poly([S(x, y, z), S(x + w, y, z), S(x + w, y + d, z), S(x, y + d, z)], col(c), false); },
    glow(x, y, z, r, color, a = 0.5) {
      if (style !== "normal") return;
      const [sx, sy] = S(x, y, z); const R = r * tw;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
      g.addColorStop(0, color.replace("ALPHA", a)); g.addColorStop(1, color.replace("ALPHA", 0));
      ctx.fillStyle = g; ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
    },
    dot(x, y, z, r, c, o = {}) { const [sx, sy] = S(x, y, z); ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.8, r * tw), 0, Math.PI * 2); ctx.fillStyle = o.raw ? c : col(c, 0, o.em); ctx.fill(); },
    text(x, y, z, s, o = {}) {
      const [sx, sy] = S(x, y, z);
      ctx.save();
      ctx.translate(sx, sy);
      if (o.face === "y") ctx.transform(1, 0.5, 0, 1, 0, 0); else if (o.face === "x") ctx.transform(1, -0.5, 0, 1, 0, 0);
      ctx.font = `${o.weight || 700} ${Math.max(6, (o.size || 0.16) * tw)}px ${o.font || '"IBM Plex Sans", system-ui, sans-serif'}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = o.color || "#14213D";
      if (o.glow && night > 0.35) { ctx.shadowColor = o.color; ctx.shadowBlur = 8; }
      ctx.fillText(s, 0, 0);
      ctx.restore();
    },
    ellipsePts,
  };
  return P;
}

/**
 * Marco local para dibujar un modelo dentro de una huella (gx, gy) de tamaño (fw × fd),
 * con rotación k ∈ {0,1,2,3} (pasos de 90°). Las primitivas se graban y se ordenan por profundidad.
 */
function makeFrame(P, gx, gy, fw = 1, fd = 1, k = 0) {
  const prims = [];
  const W = k % 2 ? fd : fw, D = k % 2 ? fw : fd; // tamaño local antes de rotar
  // transforma un punto local (u,v) a mundo
  const T = (u, v) => {
    switch (k & 3) {
      case 1: return [gx + (fw - v), gy + u];
      case 2: return [gx + (fw - u), gy + (fd - v)];
      case 3: return [gx + v, gy + (fd - u)];
      default: return [gx + u, gy + v];
    }
  };
  const TB = (x, y, w, d) => { // caja local -> caja mundo
    const a = T(x, y), b = T(x + w, y + d);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
  };
  const axis = (ax) => (k % 2 ? (ax === "x" ? "y" : "x") : ax);
  const push = (key, z, fn, o) => prims.push({ key: key + z * 1.0 + (o?.o || 0), fn });
  const F = {
    W, D, k,
    box(x, y, z, w, d, h, c, o) { const [X, Y, Wd, Dd] = TB(x, y, w, d); push(X + Wd / 2 + Y + Dd / 2, z, () => P.box(X, Y, z, Wd, Dd, h, c, o), o); },
    cyl(x, y, z, r, h, c, o) { const [X, Y] = T(x, y); push(X + Y, z, () => P.cyl(X, Y, z, r, h, c, o), o); },
    cone(x, y, z, r, h, c, o) { const [X, Y] = T(x, y); push(X + Y, z + 0.01, () => P.cone(X, Y, z, r, h, c, o), o); },
    dome(x, y, z, r, c, o) { const [X, Y] = T(x, y); push(X + Y, z + 0.01, () => P.dome(X, Y, z, r, c, o), o); },
    hcyl(ax, x, y, z, len, r, c, o) {
      const a2 = axis(ax);
      const s = T(x, y), e = ax === "x" ? T(x + len, y) : T(x, y + len);
      const sx = Math.min(s[0], e[0]), sy = Math.min(s[1], e[1]);
      push((s[0] + e[0]) / 2 + (s[1] + e[1]) / 2, z - r, () => P.hcyl(a2, sx, sy, z, len, r, c, o), o);
    },
    flat(pts, z, c, o) { const W2 = pts.map(([u, v]) => T(u, v)); const cx = W2.reduce((a, p) => a + p[0], 0) / W2.length, cy = W2.reduce((a, p) => a + p[1], 0) / W2.length; push(cx + cy, z, () => P.flat(W2, z, c, o), o); },
    q3(pts, c, o) { const W3 = pts.map(([u, v, w]) => [...T(u, v), w]); const cx = W3.reduce((a, p) => a + p[0], 0) / W3.length, cy = W3.reduce((a, p) => a + p[1], 0) / W3.length, cz = Math.min(...W3.map((p) => p[2])); push(cx + cy, cz, () => P.q3(W3, c, o), o); },
    l3(pts, c, w, o) { const W3 = pts.map(([u, v, z]) => [...T(u, v), z]); const cx = W3.reduce((a, p) => a + p[0], 0) / W3.length, cy = W3.reduce((a, p) => a + p[1], 0) / W3.length, cz = Math.min(...W3.map((p) => p[2])); push(cx + cy, cz, () => P.l3(W3, c, w, o), o); },
    ring(ax, x, y, z, r, c, w, spokes, rot, o) { const [X, Y] = T(x, y); push(X + Y, z - r, () => P.ring(axis(ax), X, Y, z, r, c, w, spokes, rot, o), o); },
    dot(x, y, z, r, c, o) { const [X, Y] = T(x, y); push(X + Y, z, () => P.dot(X, Y, z, r, c, o), o); },
    glow(x, y, z, r, color, a, o) { const [X, Y] = T(x, y); push(X + Y + 50, z, () => P.glow(X, Y, z, r, color, a), o); },
    text(x, y, z, s, o) { const [X, Y] = T(x, y); push(X + Y + 60, z, () => P.text(X, Y, z, s, o), o); },
    // dibujo libre: recibe un proyector local (u,v,z) -> pantalla
    fn(x, y, z, draw, o) { const [X, Y] = T(x, y); push(X + Y, z, () => draw((u, v, w) => { const [a, b] = T(u, v); return P.S(a, b, w); }), o); },
    flush() { prims.sort((a, b) => a.key - b.key); for (const p of prims) p.fn(); prims.length = 0; },
  };
  return F;
}

// ============================================================================
// Catálogo de piezas y sus modelos 3D (cada uno en una baldosa local 0..1)
// ============================================================================
const K = {
  Y: "#FFC21A", Y2: "#E9A400", NAVY: "#26385E", RED: "#D94448", BLUE: "#2F6FDB", BLUE2: "#1F4FA8", TEAL: "#2E8C9A",
  GREEN: "#1F9D6B", WOOD: "#C68B59", WOOD2: "#9E6A40", STEEL: "#9AA7B4", STEEL2: "#768595", ALU: "#CBD3DB",
  DARK: "#3A4558", BLACK: "#252C38", WHITE: "#EEF2F5", COPPER: "#C77B3B", BRASS: "#C9A227", BRONZE: "#8C7A4B",
  VERDIGRIS: "#5E9C86", BRICK: "#A5523F", CONC: "#C3C9CF", GLASS: "#9EC8E8", GOLD: "#E8B923", RUST: "#8C5A3C",
  ORANGE: "#F08A24", PURPLE: "#8B5CF6", PINK: "#F472B6", CREAM: "#E9E2CF",
};
const gearPts = (cx, cy, teeth, ro, ri, rot = 0) => {
  const pts = [], s = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * s + rot;
    for (const [r, q] of [[ri, a - s * 0.5], [ri, a - s * 0.3], [ro, a - s * 0.17], [ro, a + s * 0.17], [ri, a + s * 0.3]]) pts.push([cx + r * Math.cos(q), cy + r * Math.sin(q)]);
  }
  return pts;
};
const circ = (cx, cy, r, n = 16, a0 = 0) => Array.from({ length: n }, (_, i) => [cx + Math.cos(a0 + (i / n) * Math.PI * 2) * r, cy + Math.sin(a0 + (i / n) * Math.PI * 2) * r]);

const TIERS = [
  null,
  { t: 1, label: "Menos de 15 min", min: 0, name: "Insumos" },
  { t: 2, label: "De 15 a 29 min", min: 15, name: "Componentes" },
  { t: 3, label: "De 30 a 59 min", min: 30, name: "Equipos" },
  { t: 4, label: "De 1 h a 1 h 29", min: 60, name: "Máquinas" },
  { t: 5, label: "De 1 h 30 a 1 h 59", min: 90, name: "Sistemas" },
  { t: 6, label: "2 horas o más", min: 120, name: "Instalaciones" },
];
const RARITY = {
  comun: { n: "Común", w: 62 },
  rara: { n: "Rara", w: 26 },
  epica: { n: "Épica", w: 10 },
  legendaria: { n: "Legendaria", w: 2 },
};
const AREAS = {
  general: "Cualquier materia",
  energia: "Transformación de la Energía, Termodinámica",
  electro: "Electrotecnia, Electricidad y Magnetismo",
  proba: "Probabilidad, Estadística Aplicada",
  materiales: "Materiales, Transformación de Materiales",
  gestion: "Economía, Gestión de la Cadena de Valor",
  quimica: "Química Básica, Industrias Químicas",
  digital: "Industrias Digitales, Pensamiento Computacional",
  historia: "Cualquier materia (reliquia)",
};

// Cada pieza: id, n (nombre), tier, r (rareza), a (área), specs, uso, cota (texto del plano), h (alto aprox.), m (modelo)
const PIECES = [
  // ------------------------------------------------------------ Categoría 1
  {
    id: "bulones", still: true, n: "Cajón de bulones M8", tier: 1, r: "comun", a: "general", h: 0.5, cota: "400 × 300 mm",
    specs: [["Rosca", "M8 × 1,25"], ["Clase", "8.8, cincado"], ["Contenido", "200 unidades"], ["Masa", "3,4 kg"]],
    uso: "Uniones desmontables de estructuras y máquinas. Sin bulones no hay planta.",
    m(F) {
      F.box(0.18, 0.24, 0, 0.64, 0.5, 0.3, K.WOOD);
      for (let i = 0; i < 3; i++) F.box(0.18, 0.74, 0.04 + i * 0.09, 0.64, 0.012, 0.05, K.WOOD2, { o: 0.02 });
      for (let i = 0; i < 3; i++) F.box(0.82, 0.24, 0.04 + i * 0.09, 0.012, 0.5, 0.05, K.WOOD2, { o: 0.02 });
      F.flat([[0.22, 0.28], [0.78, 0.28], [0.78, 0.7], [0.22, 0.7]], 0.27, K.STEEL2);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) F.cyl(0.29 + i * 0.11, 0.35 + j * 0.13, 0.27, 0.035, 0.045, i % 2 ? K.ALU : K.STEEL);
      F.hcyl("x", 0.3, 0.92, 0.04, 0.42, 0.035, K.ALU); F.box(0.22, 0.88, 0, 0.08, 0.09, 0.08, K.STEEL2);
    },
  },
  {
    id: "pallet", still: true, n: "Pallet consolidado", tier: 1, r: "comun", a: "gestion", h: 0.6, cota: "1200 × 1000 mm",
    specs: [["Medidas", "1200 × 1000 mm"], ["Carga máx.", "1500 kg"], ["Madera", "Pino tratado HT"], ["Norma", "NIMF 15"]],
    uso: "La unidad de carga de cualquier depósito: se almacena, se apila y se despacha entera.",
    m(F) {
      for (const y of [0.16, 0.46, 0.76]) F.box(0.1, y, 0, 0.8, 0.08, 0.07, K.WOOD2);
      F.box(0.1, 0.14, 0.07, 0.8, 0.72, 0.03, K.WOOD);
      F.box(0.14, 0.18, 0.1, 0.34, 0.31, 0.22, K.WOOD2); F.box(0.52, 0.18, 0.1, 0.34, 0.31, 0.22, "#B9865C");
      F.box(0.14, 0.51, 0.1, 0.34, 0.31, 0.22, "#B9865C"); F.box(0.52, 0.51, 0.1, 0.34, 0.31, 0.22, K.WOOD2);
      F.box(0.2, 0.25, 0.32, 0.6, 0.5, 0.2, "#D6C3A1");
      F.box(0.12, 0.16, 0.1, 0.76, 0.68, 0.43, K.GLASS, { alpha: 0.28, o: 0.3 });
      F.l3([[0.5, 0.16, 0.1], [0.5, 0.16, 0.53], [0.5, 0.84, 0.53], [0.5, 0.84, 0.1]], K.BLUE, 2.4, { o: 0.4 });
    },
  },
  {
    id: "carretilla", still: true, n: "Carretilla de obra", tier: 1, r: "comun", a: "general", h: 0.5, cota: "Cap. 90 L",
    specs: [["Capacidad", "90 L"], ["Carga máx.", "150 kg"], ["Rueda", "Neumática 16 pulgadas"], ["Batea", "Chapa de 1 mm"]],
    uso: "El primer equipo de transporte interno de toda obra.",
    m(F) {
      F.l3([[0.08, 0.32, 0.36], [0.62, 0.32, 0.28], [0.72, 0.36, 0.12]], K.DARK, 3);
      F.l3([[0.08, 0.68, 0.36], [0.62, 0.68, 0.28], [0.72, 0.64, 0.12]], K.DARK, 3);
      F.l3([[0.3, 0.32, 0.27], [0.3, 0.32, 0.02]], K.DARK, 2.5); F.l3([[0.3, 0.68, 0.27], [0.3, 0.68, 0.02]], K.DARK, 2.5);
      F.box(0.24, 0.3, 0.24, 0.42, 0.4, 0.18, K.GREEN);
      F.flat([[0.27, 0.33], [0.63, 0.33], [0.63, 0.67], [0.27, 0.67]], 0.42, "#17694A", { o: 0.01 });
      F.dome(0.45, 0.5, 0.4, 0.16, "#C9A86A", { k: 0.45, o: 0.02 });
      F.box(0.18, 0.28, 0.4, 0.06, 0.44, 0.03, K.GREEN, { o: 0.03 });
      F.hcyl("y", 0.76, 0.43, 0.12, 0.14, 0.12, K.BLACK, { cap: K.STEEL });
    },
  },
  {
    id: "matafuego", still: true, n: "Puesto contra incendio", tier: 1, r: "rara", a: "general", h: 0.9, cota: "Ø 160 mm",
    specs: [["Agente", "Polvo químico ABC"], ["Carga", "5 kg"], ["Presión", "14 bar"], ["Potencial", "6A 40BC"]],
    uso: "Primera respuesta ante fuegos de sólidos, líquidos y equipos eléctricos.",
    m(F, t) {
      F.box(0.22, 0.2, 0, 0.56, 0.05, 1.0, K.WHITE);
      F.box(0.24, 0.205, 0.62, 0.52, 0.05, 0.3, K.RED, { o: 0.02 });
      F.box(0.3, 0.205, 0.66, 0.4, 0.052, 0.04, K.WHITE, { o: 0.03 });
      F.box(0.44, 0.205, 0.68, 0.12, 0.052, 0.2, K.WHITE, { o: 0.03 });
      F.cyl(0.5, 0.45, 0.04, 0.15, 0.48, K.RED);
      F.dome(0.5, 0.45, 0.52, 0.15, K.RED);
      F.cyl(0.5, 0.45, 0.62, 0.035, 0.08, K.BLACK);
      F.box(0.5, 0.42, 0.68, 0.16, 0.05, 0.025, K.BLACK);
      F.cyl(0.61, 0.52, 0.42, 0.04, 0.02, K.WHITE, { cap: "#F2F4F6" });
      F.l3([[0.52, 0.47, 0.66], [0.66, 0.52, 0.6], [0.7, 0.58, 0.35], [0.64, 0.58, 0.18]], K.BLACK, 2.6);
      F.box(0.28, 0.6, 0, 0.44, 0.3, 0.02, "#E9C33F", { o: -0.5 });
    },
  },
  {
    id: "banco", still: true, n: "Banco de trabajo", tier: 1, r: "epica", a: "materiales", h: 0.95, cota: "1800 × 750 mm",
    specs: [["Tapa", "Multilaminado de 40 mm"], ["Morsa", "150 mm, fundición"], ["Tablero", "Perforado, 40 herramientas"], ["Carga", "500 kg"]],
    uso: "Donde se ajusta, se lima y se arregla lo que la máquina no resuelve.",
    m(F) {
      F.box(0.06, 0.18, 0.42, 0.88, 0.04, 0.6, "#D9CBB0");
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) F.dot(0.14 + i * 0.22, 0.225, 0.52 + j * 0.13, 0.008, K.DARK, { o: 0.05 });
      F.box(0.12, 0.225, 0.62, 0.05, 0.01, 0.22, K.RED, { o: 0.06 }); F.box(0.22, 0.225, 0.7, 0.16, 0.01, 0.05, K.BLUE, { o: 0.06 });
      F.box(0.45, 0.225, 0.58, 0.04, 0.01, 0.3, K.Y, { o: 0.06 }); F.box(0.58, 0.225, 0.64, 0.2, 0.01, 0.04, K.DARK, { o: 0.06 });
      F.dot(0.84, 0.226, 0.8, 0.04, K.DARK, { o: 0.07 });
      for (const [x, y] of [[0.1, 0.24], [0.86, 0.24], [0.1, 0.78], [0.86, 0.78]]) F.box(x, y, 0, 0.05, 0.05, 0.4, K.STEEL2);
      F.box(0.1, 0.24, 0.1, 0.81, 0.59, 0.03, K.STEEL2);
      F.box(0.06, 0.22, 0.4, 0.88, 0.62, 0.06, K.WOOD);
      F.box(0.7, 0.62, 0.46, 0.18, 0.16, 0.06, K.BLUE2); F.box(0.72, 0.64, 0.52, 0.06, 0.12, 0.1, K.BLUE2); F.box(0.82, 0.64, 0.52, 0.04, 0.12, 0.1, K.BLUE2);
      F.hcyl("y", 0.8, 0.78, 0.55, 0.12, 0.012, K.STEEL);
      F.box(0.24, 0.5, 0.46, 0.22, 0.04, 0.02, K.DARK); F.box(0.42, 0.48, 0.46, 0.06, 0.08, 0.04, K.STEEL);
      F.box(0.2, 0.32, 0.46, 0.1, 0.08, 0.03, K.ORANGE);
    },
  },
  {
    id: "regla", glowPad: 0.7, n: "Regla de cálculo Faber 2/83N", tier: 1, r: "legendaria", a: "historia", h: 0.8, cota: "L = 300 mm",
    specs: [["Fabricada", "1970, Alemania"], ["Escalas", "30, incluidas log-log"], ["Precisión", "3 cifras significativas"], ["Reemplazada por", "La calculadora HP-35 (1972)"]],
    uso: "Con reglas así se calcularon puentes, aviones y el programa Apolo. Reliquia de museo.",
    m(F, t, x) {
      F.box(0.2, 0.2, 0, 0.6, 0.6, 0.42, K.BLACK);
      F.box(0.17, 0.17, 0.42, 0.66, 0.66, 0.05, K.WOOD2);
      F.box(0.24, 0.24, 0.47, 0.52, 0.52, 0.02, "#7A1F2B");
      F.box(0.3, 0.44, 0.49, 0.42, 0.13, 0.025, "#F5F1E6");
      F.box(0.3, 0.485, 0.515, 0.42, 0.04, 0.004, "#E8DFC6", { o: 0.01 });
      const s = REDUCE ? 0 : Math.sin(t * 0.8) * 0.05;
      F.box(0.44 + s, 0.43, 0.49, 0.05, 0.15, 0.035, K.GLASS, { alpha: 0.7, o: 0.02 });
      F.box(0.17, 0.17, 0.47, 0.66, 0.66, 0.36, "#CFE6F7", { alpha: 0.22, o: 0.4 });
      F.box(0.2, 0.795, 0.12, 0.6, 0.01, 0.12, K.GOLD, { o: 0.05 });
      if (!x?.mini && !x?.park) F.glow(0.5, 0.5, 0.6, 0.6, "rgba(232,185,35,ALPHA)", 0.25);
    },
  },
  // ------------------------------------------------------------ Categoría 2
  {
    id: "engranaje", n: "Tren de engranajes", tier: 2, r: "comun", a: "materiales", h: 0.5, cota: "m = 3, z = 40/20",
    specs: [["Módulo", "3"], ["Dientes", "40 y 20 (relación 2:1)"], ["Material", "Acero SAE 4140 templado"], ["Diámetro primitivo", "120 y 60 mm"]],
    uso: "Transmite potencia entre ejes paralelos y cambia la velocidad.",
    m(F, t) {
      const a = REDUCE ? 0.2 : t * 0.7;
      F.box(0.08, 0.12, 0, 0.84, 0.76, 0.12, K.STEEL2);
      F.cyl(0.38, 0.45, 0.12, 0.06, 0.16, K.DARK); F.cyl(0.8, 0.645, 0.12, 0.04, 0.16, K.DARK);
      F.flat(gearPts(0.38, 0.45, 18, 0.34, 0.27, a), 0.26, K.Y2);
      F.flat(gearPts(0.38, 0.45, 18, 0.34, 0.27, a), 0.3, K.Y);
      for (let i = 0; i < 5; i++) { const q = a + (i / 5) * Math.PI * 2; F.flat(circ(0.38 + Math.cos(q) * 0.16, 0.45 + Math.sin(q) * 0.16, 0.05, 10), 0.301, K.Y2, { o: 0.01 }); }
      F.cyl(0.38, 0.45, 0.3, 0.07, 0.03, K.STEEL);
      const b = -a * 2 + 0.16;
      F.flat(gearPts(0.8, 0.645, 9, 0.18, 0.13, b), 0.26, "#5D6B7C", { o: 0.2 });
      F.flat(gearPts(0.8, 0.645, 9, 0.18, 0.13, b), 0.3, K.STEEL, { o: 0.2 });
      F.cyl(0.8, 0.645, 0.3, 0.045, 0.03, K.DARK, { o: 0.2 });
    },
  },
  {
    id: "valvula", n: "Válvula esférica bridada", tier: 2, r: "comun", a: "quimica", h: 0.6, cota: "DN 50, PN 40",
    specs: [["Diámetro", "2 pulgadas (DN 50)"], ["Presión nominal", "PN 40"], ["Cuerpo", "Acero inoxidable 316"], ["Accionamiento", "Palanca, un cuarto de vuelta"]],
    uso: "Corte rápido de fluidos en cañerías de proceso.",
    m(F, t) {
      F.box(0.12, 0.38, 0, 0.08, 0.24, 0.12, K.DARK); F.box(0.8, 0.38, 0, 0.08, 0.24, 0.12, K.DARK);
      F.hcyl("x", 0.0, 0.5, 0.24, 0.3, 0.09, K.STEEL);
      F.hcyl("x", 0.27, 0.5, 0.24, 0.04, 0.15, K.STEEL2);
      F.hcyl("x", 0.69, 0.5, 0.24, 0.04, 0.15, K.STEEL2);
      F.hcyl("x", 0.7, 0.5, 0.24, 0.3, 0.09, K.STEEL);
      F.dome(0.5, 0.5, 0.12, 0.2, K.ALU, { k: 1.05 });
      F.cyl(0.5, 0.5, 0.32, 0.04, 0.12, K.DARK);
      const open = REDUCE ? 0 : (Math.sin(t * 0.6) > 0 ? 0 : 1);
      if (open) F.box(0.47, 0.47, 0.44, 0.06, 0.4, 0.04, K.RED); else F.box(0.47, 0.47, 0.44, 0.4, 0.06, 0.04, K.RED);
      F.dot(0.5, 0.5, 0.49, 0.02, K.BLACK, { o: 0.5 });
    },
  },
  {
    id: "rodamiento", n: "Rodamiento de rodillos", tier: 2, r: "rara", a: "materiales", h: 0.4, cota: "d = 100 mm",
    specs: [["Tipo", "Rodillos esféricos, dos hileras"], ["Diámetro interior", "100 mm"], ["Carga dinámica", "425 kN"], ["Velocidad límite", "3000 rpm"]],
    uso: "Soporta cargas radiales grandes aunque el eje esté algo desalineado.",
    m(F, t) {
      const a = REDUCE ? 0 : t * 0.9;
      F.cyl(0.5, 0.5, 0, 0.42, 0.18, K.STEEL);
      F.flat(circ(0.5, 0.5, 0.35, 28), 0.181, "#4A5566");
      for (let i = 0; i < 12; i++) { const q = a + (i / 12) * Math.PI * 2; F.cyl(0.5 + Math.cos(q) * 0.285, 0.5 + Math.sin(q) * 0.285, 0.1, 0.04, 0.09, "#D7DEE6", { o: 0.02 }); }
      F.cyl(0.5, 0.5, 0.08, 0.22, 0.12, K.ALU, { o: 0.03 });
      F.flat(circ(0.5, 0.5, 0.15, 24), 0.201, "#2C3442", { o: 0.04 });
    },
  },
  {
    id: "compresor", n: "Compresor de aire", tier: 2, r: "rara", a: "energia", h: 0.75, cota: "200 L, 10 bar",
    specs: [["Tanque", "200 L"], ["Presión", "10 bar"], ["Caudal", "480 L/min"], ["Motor", "3 HP, a pistón"]],
    uso: "El aire comprimido mueve cilindros, pistolas y herramientas de toda la planta.",
    m(F, t) {
      F.box(0.14, 0.32, 0, 0.06, 0.06, 0.1, K.DARK); F.box(0.14, 0.62, 0, 0.06, 0.06, 0.1, K.DARK);
      F.hcyl("y", 0.82, 0.34, 0.07, 0.06, 0.07, K.BLACK, { cap: K.STEEL }); F.hcyl("y", 0.82, 0.6, 0.07, 0.06, 0.07, K.BLACK, { cap: K.STEEL });
      F.hcyl("x", 0.08, 0.5, 0.27, 0.84, 0.2, K.RED);
      F.box(0.24, 0.36, 0.45, 0.24, 0.28, 0.16, K.DARK);
      F.box(0.52, 0.36, 0.45, 0.26, 0.26, 0.04, K.STEEL2);
      F.box(0.56, 0.4, 0.49, 0.16, 0.18, 0.14, K.BLACK);
      for (let i = 0; i < 4; i++) F.box(0.55, 0.39, 0.52 + i * 0.03, 0.18, 0.2, 0.012, K.STEEL2, { o: 0.01 });
      F.box(0.46, 0.33, 0.47, 0.06, 0.34, 0.16, K.Y, { o: 0.02 });
      F.cyl(0.84, 0.36, 0.44, 0.045, 0.02, K.WHITE, { cap: "#FFFFFF", o: 0.3 });
      const p = REDUCE ? 0 : (t * 2) % 1;
      F.cyl(0.64, 0.49, 0.63 + Math.abs(Math.sin(p * Math.PI)) * 0.04, 0.05, 0.03, K.ALU, { o: 0.2 });
    },
  },
  {
    id: "soldadora", glowPad: 0.45, n: "Estación de soldadura MIG", tier: 2, r: "epica", a: "materiales", h: 0.8, cota: "250 A",
    specs: [["Proceso", "MIG/MAG"], ["Corriente", "40 a 250 A"], ["Alambre", "0,8 a 1,0 mm"], ["Gas", "Argón + CO₂"]],
    uso: "Une estructuras y piezas metálicas con arco eléctrico protegido por gas.",
    m(F, t, x) {
      F.box(0.06, 0.2, 0, 0.36, 0.5, 0.06, K.DARK);
      F.box(0.08, 0.22, 0.06, 0.32, 0.46, 0.34, K.BLUE);
      F.box(0.4, 0.3, 0.2, 0.004, 0.2, 0.12, K.BLACK, { o: 0.02 });
      F.dot(0.402, 0.36, 0.33, 0.025, "#7CFFB2", { em: true, o: 0.03 });
      F.hcyl("y", 0.24, 0.3, 0.48, 0.2, 0.08, K.COPPER, { cap: K.DARK });
      F.cyl(0.14, 0.62, 0.06, 0.05, 0.5, K.GREEN); F.dome(0.14, 0.62, 0.56, 0.05, K.GREEN); F.cyl(0.14, 0.62, 0.6, 0.02, 0.05, K.STEEL);
      F.box(0.56, 0.36, 0, 0.04, 0.04, 0.3, K.STEEL2); F.box(0.86, 0.36, 0, 0.04, 0.04, 0.3, K.STEEL2);
      F.box(0.56, 0.72, 0, 0.04, 0.04, 0.3, K.STEEL2); F.box(0.86, 0.72, 0, 0.04, 0.04, 0.3, K.STEEL2);
      F.box(0.54, 0.34, 0.3, 0.38, 0.44, 0.04, K.STEEL);
      F.box(0.62, 0.48, 0.34, 0.24, 0.06, 0.1, K.STEEL2); F.box(0.7, 0.42, 0.34, 0.06, 0.2, 0.08, K.STEEL2);
      F.l3([[0.4, 0.5, 0.3], [0.5, 0.62, 0.5], [0.64, 0.58, 0.52], [0.7, 0.52, 0.46]], K.BLACK, 2.6, { o: 0.4 });
      const on = REDUCE || Math.sin(t * 7) > -0.3;
      if (on) {
        F.dot(0.7, 0.51, 0.44, 0.03, "#E8F4FF", { em: true, o: 0.5, raw: true });
        if (!x?.mini) F.glow(0.7, 0.51, 0.44, 0.32, "rgba(140,200,255,ALPHA)", 0.5);
        const r = rng(Math.floor(t * 12));
        for (let i = 0; i < 6; i++) F.dot(0.7 + (r() - 0.5) * 0.2, 0.51 + (r() - 0.5) * 0.2, 0.44 + r() * 0.12, 0.008, "#FFD27A", { raw: true, o: 0.6 });
      }
    },
  },
  {
    id: "anticitera", glowPad: 0.7, n: "Mecanismo de Anticitera", tier: 2, r: "legendaria", a: "historia", h: 0.85, cota: "~ 150 a.C.",
    specs: [["Origen", "Grecia, siglo II a.C."], ["Engranajes", "Al menos 30, de bronce"], ["Función", "Predecía eclipses y posiciones astronómicas"], ["Hallado", "1901, en un naufragio"]],
    uso: "La primera computadora analógica conocida. Reliquia de museo.",
    m(F, t, x) {
      F.box(0.2, 0.2, 0, 0.6, 0.6, 0.42, K.BLACK);
      F.box(0.17, 0.17, 0.42, 0.66, 0.66, 0.05, K.WOOD2);
      F.box(0.28, 0.3, 0.47, 0.44, 0.38, 0.06, "#6E5A3A");
      const a = REDUCE ? 0 : t * 0.25;
      F.flat(gearPts(0.44, 0.48, 22, 0.17, 0.145, a), 0.53, K.VERDIGRIS);
      F.flat(circ(0.44, 0.48, 0.11, 20), 0.531, "#4C8571", { o: 0.01 });
      F.flat(gearPts(0.62, 0.38, 12, 0.09, 0.07, -a * 1.8), 0.56, K.BRONZE, { o: 0.02 });
      F.flat(gearPts(0.6, 0.6, 10, 0.07, 0.055, -a * 2.2), 0.58, "#7A9C76", { o: 0.03 });
      F.cyl(0.44, 0.48, 0.53, 0.02, 0.05, K.BRONZE, { o: 0.04 });
      F.box(0.17, 0.17, 0.47, 0.66, 0.66, 0.38, "#CFE6F7", { alpha: 0.2, o: 0.4 });
      F.box(0.2, 0.795, 0.12, 0.6, 0.01, 0.12, K.GOLD, { o: 0.05 });
      if (!x?.mini && !x?.park) F.glow(0.5, 0.5, 0.62, 0.6, "rgba(232,185,35,ALPHA)", 0.25);
    },
  },
  // ------------------------------------------------------------ Categoría 3
  {
    id: "motor", n: "Motor trifásico IE3", tier: 3, r: "comun", a: "electro", h: 0.65, cota: "5,5 kW",
    specs: [["Potencia", "5,5 kW"], ["Velocidad", "1450 rpm"], ["Tensión", "380 V, 50 Hz"], ["Eficiencia", "IE3 premium"]],
    uso: "El caballo de batalla de la industria: mueve bombas, cintas y ventiladores.",
    m(F, t) {
      F.box(0.14, 0.26, 0, 0.66, 0.48, 0.06, K.DARK);
      F.box(0.22, 0.3, 0.06, 0.08, 0.4, 0.08, K.BLUE2); F.box(0.62, 0.3, 0.06, 0.08, 0.4, 0.08, K.BLUE2);
      F.hcyl("x", 0.12, 0.5, 0.33, 0.12, 0.2, K.BLACK);
      F.hcyl("x", 0.22, 0.5, 0.33, 0.52, 0.21, K.BLUE);
      for (let i = 0; i < 6; i++) F.hcyl("x", 0.27 + i * 0.075, 0.5, 0.33, 0.02, 0.225, K.BLUE2, { o: 0.01 });
      F.hcyl("x", 0.74, 0.5, 0.33, 0.04, 0.17, K.BLUE2);
      F.hcyl("x", 0.78, 0.5, 0.33, 0.16, 0.035, K.ALU);
      F.box(0.4, 0.4, 0.52, 0.16, 0.2, 0.1, K.BLUE2);
      F.box(0.42, 0.42, 0.62, 0.12, 0.16, 0.02, K.STEEL, { o: 0.02 });
      const a = REDUCE ? 0 : t * 6;
      F.l3([[0.94, 0.5, 0.33], [0.94, 0.5 + Math.cos(a) * 0.03, 0.33 + Math.sin(a) * 0.03]], K.Y, 2.5, { o: 0.4 });
    },
  },
  {
    id: "bomba", still: true, n: "Bomba centrífuga", tier: 3, r: "comun", a: "energia", h: 0.7, cota: "50 m³/h · 32 m",
    specs: [["Caudal", "50 m³/h"], ["Altura", "32 m"], ["Potencia", "7,5 kW"], ["Rodete", "Cerrado, bronce"]],
    uso: "Mueve líquidos en circuitos de agua y de proceso.",
    m(F) {
      F.box(0.04, 0.24, 0, 0.92, 0.52, 0.08, K.Y2);
      F.hcyl("x", 0.08, 0.5, 0.3, 0.38, 0.18, K.GREEN);
      for (let i = 0; i < 4; i++) F.hcyl("x", 0.13 + i * 0.08, 0.5, 0.3, 0.02, 0.19, "#17805A", { o: 0.01 });
      F.box(0.46, 0.4, 0.18, 0.12, 0.2, 0.22, K.Y);
      F.hcyl("y", 0.72, 0.36, 0.3, 0.28, 0.2, K.BLUE);
      F.cyl(0.72, 0.5, 0.08, 0.06, 0.04, K.DARK);
      F.cyl(0.8, 0.42, 0.42, 0.06, 0.28, K.STEEL); F.cyl(0.8, 0.42, 0.7, 0.09, 0.03, K.STEEL2);
      F.hcyl("x", 0.92, 0.5, 0.3, 0.08, 0.08, K.STEEL); F.hcyl("x", 0.98, 0.5, 0.3, 0.02, 0.11, K.STEEL2);
    },
  },
  {
    id: "transformador", still: true, n: "Transformador de distribución", tier: 3, r: "rara", a: "electro", h: 1.1, cota: "315 kVA",
    specs: [["Potencia", "315 kVA"], ["Relación", "13,2 / 0,4 kV"], ["Refrigeración", "Aceite, ONAN"], ["Grupo de conexión", "Dyn11"]],
    uso: "Baja la media tensión de la red a la tensión de trabajo de la planta.",
    m(F) {
      F.box(0.14, 0.16, 0, 0.72, 0.66, 0.05, K.DARK);
      F.box(0.24, 0.26, 0.05, 0.52, 0.46, 0.55, "#7E9C8A");
      for (let i = 0; i < 6; i++) F.box(0.26 + i * 0.085, 0.72, 0.1, 0.045, 0.1, 0.44, "#6A8A77", { o: 0.01 });
      for (let i = 0; i < 5; i++) F.box(0.76, 0.28 + i * 0.09, 0.1, 0.1, 0.045, 0.44, "#6A8A77", { o: 0.01 });
      F.hcyl("x", 0.28, 0.32, 0.72, 0.44, 0.08, "#7E9C8A");
      for (let i = 0; i < 3; i++) {
        const x = 0.34 + i * 0.16;
        for (let j = 0; j < 5; j++) F.cyl(x, 0.5, 0.6 + j * 0.06, 0.05 - (j % 2) * 0.012, 0.05, "#B9744A", { o: j * 0.001 });
        F.cyl(x, 0.5, 0.9, 0.018, 0.08, K.ALU);
      }
      for (let i = 0; i < 4; i++) F.cyl(0.32 + i * 0.12, 0.66, 0.6, 0.028, 0.1, "#8F5A3A");
      F.box(0.4, 0.719, 0.25, 0.16, 0.01, 0.14, K.Y, { o: 0.05 });
      F.q3([[0.5, 0.721, 0.37], [0.45, 0.721, 0.31], [0.49, 0.721, 0.31], [0.46, 0.721, 0.26], [0.52, 0.721, 0.33], [0.48, 0.721, 0.33]], K.BLACK, { stroke: false, o: 0.06 });
    },
  },
  {
    id: "generador", smoke: [[0.2, 0.5, 0.92, "humo"]], n: "Grupo electrógeno", tier: 3, r: "rara", a: "energia", h: 0.75, cota: "250 kVA",
    specs: [["Potencia", "250 kVA prime"], ["Motor", "Diésel, 6 cilindros"], ["Autonomía", "12 h a plena carga"], ["Arranque", "Automático por falta de red"]],
    uso: "Cuando se corta la luz, arranca solo y la producción no se detiene.",
    m(F, t, x) {
      F.box(0.04, 0.2, 0, 0.92, 0.6, 0.1, K.DARK);
      F.box(0.06, 0.22, 0.1, 0.88, 0.56, 0.5, K.Y);
      for (let i = 0; i < 8; i++) F.box(0.12 + i * 0.09, 0.779, 0.22, 0.05, 0.004, 0.26, K.Y2, { o: 0.01 });
      for (let i = 0; i < 4; i++) F.box(0.939, 0.28 + i * 0.12, 0.2, 0.004, 0.08, 0.3, K.BLACK, { o: 0.01 });
      F.box(0.1, 0.4, 0.6, 0.2, 0.2, 0.04, K.DARK);
      F.cyl(0.2, 0.5, 0.6, 0.05, 0.28, K.STEEL2); F.cyl(0.2, 0.5, 0.88, 0.065, 0.02, K.DARK);
      F.box(0.66, 0.78, 0.3, 0.12, 0.01, 0.12, K.DARK, { o: 0.02 });
      F.dot(0.69, 0.785, 0.4, 0.015, REDUCE || Math.sin(t * 3) > 0 ? "#57F28F" : "#2E6B47", { em: true, o: 0.03 });
    },
  },
  {
    id: "tablero", n: "Centro de control de motores", tier: 3, r: "epica", a: "electro", h: 1.2, cota: "400 A · IP54",
    specs: [["Corriente", "400 A"], ["Protección", "IP54"], ["PLC", "64 entradas y salidas"], ["Norma", "IEC 61439"]],
    uso: "El cerebro de la línea: arranques, enclavamientos, alarmas y comunicación con la sala de control.",
    m(F, t) {
      F.box(0.06, 0.3, 0, 0.88, 0.4, 0.08, K.DARK);
      for (let i = 0; i < 3; i++) {
        const x = 0.08 + i * 0.29;
        F.box(x, 0.32, 0.08, 0.27, 0.36, 0.95, "#C7CED6");
        F.box(x + 0.02, 0.68, 0.12, 0.23, 0.004, 0.86, "#B4BCC6", { o: 0.01 });
        F.box(x + 0.2, 0.684, 0.45, 0.02, 0.006, 0.12, K.DARK, { o: 0.02 });
        F.box(x + 0.05, 0.684, 0.72, 0.12, 0.006, 0.1, i === 1 ? "#0E2A1A" : K.BLACK, { o: 0.02 });
        if (i === 1) F.box(x + 0.06, 0.686, 0.735, 0.1, 0.004, 0.07, "#46E08B", { em: true, o: 0.03 });
        for (let j = 0; j < 3; j++) {
          const on = REDUCE ? j !== 2 : Math.sin(t * (2 + i) + j * 1.7) > -0.2;
          F.dot(x + 0.06 + j * 0.06, 0.687, 0.6, 0.018, on ? ["#46E08B", "#FFC21A", "#FF5A5F"][j] : "#3B4250", { em: on, o: 0.04 });
        }
        F.q3([[x + 0.08, 0.685, 0.22], [x + 0.15, 0.685, 0.34], [x + 0.22, 0.685, 0.22]], K.Y, { o: 0.05 });
      }
      F.box(0.06, 0.34, 1.03, 0.88, 0.28, 0.06, K.STEEL2);
      F.l3([[0.1, 0.4, 1.1], [0.5, 0.42, 1.2], [0.9, 0.44, 1.1]], K.BLACK, 2, { o: 0.1 });
      F.l3([[0.1, 0.5, 1.1], [0.5, 0.52, 1.18], [0.9, 0.54, 1.1]], K.RED, 2, { o: 0.1 });
    },
  },
  {
    id: "dinamo", glowPad: 0.7, n: "Dínamo de Gramme", tier: 3, r: "legendaria", a: "historia", h: 0.95, cota: "1871",
    specs: [["Inventor", "Zénobe Gramme, 1871"], ["Inducido", "Anillo de hierro bobinado"], ["Novedad", "Primera dínamo de corriente continua práctica"], ["Uso", "Iluminación de fábricas y talleres"]],
    uso: "Hizo posible la electricidad industrial. Reliquia de museo.",
    m(F, t, x) {
      F.box(0.1, 0.18, 0, 0.8, 0.64, 0.12, K.WOOD2);
      F.box(0.14, 0.22, 0.12, 0.72, 0.56, 0.03, K.WOOD);
      F.box(0.2, 0.3, 0.15, 0.1, 0.1, 0.62, K.BLACK); F.box(0.7, 0.3, 0.15, 0.1, 0.1, 0.62, K.BLACK);
      F.box(0.2, 0.3, 0.68, 0.6, 0.1, 0.1, K.BLACK);
      F.box(0.27, 0.32, 0.3, 0.1, 0.08, 0.26, "#3B4250"); F.box(0.63, 0.32, 0.3, 0.1, 0.08, 0.26, "#3B4250");
      const a = REDUCE ? 0.3 : t * 2.2;
      F.ring("y", 0.5, 0.5, 0.42, 0.19, K.COPPER, 8, 12, a, { o: 0.2 });
      F.ring("y", 0.5, 0.52, 0.42, 0.12, "#9C5A28", 5, 0, 0, { o: 0.21 });
      F.hcyl("y", 0.5, 0.3, 0.42, 0.52, 0.025, K.BRASS, { o: 0.1 });
      F.ring("y", 0.5, 0.82, 0.42, 0.14, K.BRASS, 3, 4, a, { hub: K.BRASS, o: 0.3 });
      F.l3([[0.5, 0.86, 0.42], [0.5 + Math.cos(a) * 0.14, 0.88, 0.42 + Math.sin(a) * 0.14]], K.WOOD2, 3, { o: 0.4 });
      F.box(0.34, 0.799, 0.04, 0.32, 0.01, 0.06, K.GOLD, { o: 0.05 });
      if (!x?.mini && !x?.park) F.glow(0.5, 0.5, 0.5, 0.65, "rgba(232,185,35,ALPHA)", 0.22);
    },
  },
  // ------------------------------------------------------------ Categoría 4
  {
    id: "torno", n: "Torno paralelo", tier: 4, r: "comun", a: "materiales", h: 0.8, cota: "Volteo 400 mm",
    specs: [["Volteo", "400 mm"], ["Entre puntas", "1000 mm"], ["Motor", "5,5 kW"], ["Velocidades", "25 a 2000 rpm"]],
    uso: "Mecaniza piezas de revolución: ejes, bujes y roscas.",
    m(F, t) {
      F.box(0.04, 0.28, 0, 0.16, 0.44, 0.32, K.GREEN); F.box(0.8, 0.28, 0, 0.16, 0.44, 0.32, K.GREEN);
      F.box(0.2, 0.34, 0.06, 0.6, 0.32, 0.04, K.STEEL2);
      F.box(0.02, 0.26, 0.32, 0.96, 0.48, 0.1, K.GREEN);
      F.box(0.04, 0.32, 0.42, 0.92, 0.12, 0.03, K.ALU);
      F.box(0.04, 0.24, 0.42, 0.26, 0.5, 0.36, "#2E8F6A");
      F.box(0.04, 0.739, 0.5, 0.24, 0.004, 0.2, "#1F6B4F", { o: 0.01 });
      for (let i = 0; i < 3; i++) F.cyl(0.08 + i * 0.07, 0.745, 0.62, 0.02, 0.0, K.DARK, { o: 0.02 });
      const a = REDUCE ? 0 : t * 8;
      F.hcyl("x", 0.3, 0.47, 0.62, 0.06, 0.1, K.STEEL);
      for (let i = 0; i < 3; i++) { const q = a + (i / 3) * Math.PI * 2; F.box(0.33, 0.46 + Math.cos(q) * 0.08, 0.61 + Math.sin(q) * 0.08, 0.04, 0.02, 0.02, K.DARK, { o: 0.01 }); }
      F.hcyl("x", 0.36, 0.47, 0.62, 0.38, 0.035, "#DDE3E8");
      const s = REDUCE ? 0.5 : (Math.sin(t * 0.6) + 1) / 2;
      const cx = 0.42 + s * 0.24;
      F.box(cx, 0.3, 0.45, 0.16, 0.42, 0.06, "#2E8F6A");
      F.box(cx + 0.03, 0.54, 0.51, 0.1, 0.1, 0.07, K.DARK); F.box(cx + 0.06, 0.5, 0.56, 0.03, 0.06, 0.02, K.Y, { o: 0.02 });
      F.box(0.76, 0.38, 0.45, 0.16, 0.2, 0.22, "#2E8F6A"); F.hcyl("x", 0.7, 0.47, 0.62, 0.06, 0.025, K.STEEL);
      F.l3([[cx + 0.08, 0.5, 0.58], [cx + 0.1, 0.52, 0.55]], "#B9C3CC", 1.5, { o: 0.4 });
    },
  },
  {
    id: "autoelevador", n: "Autoelevador eléctrico", tier: 4, r: "comun", a: "gestion", h: 1.2, cota: "Cap. 2,5 t",
    specs: [["Capacidad", "2,5 t"], ["Elevación", "4,5 m"], ["Tracción", "Eléctrica, 48 V"], ["Autonomía", "Un turno completo"]],
    uso: "Mueve pallets entre depósito, línea de producción y despacho.",
    m(F, t) {
      F.hcyl("y", 0.24, 0.26, 0.1, 0.07, 0.1, K.BLACK, { cap: K.STEEL }); F.hcyl("y", 0.24, 0.67, 0.1, 0.07, 0.1, K.BLACK, { cap: K.STEEL });
      F.hcyl("y", 0.66, 0.24, 0.12, 0.08, 0.12, K.BLACK, { cap: K.STEEL }); F.hcyl("y", 0.66, 0.68, 0.12, 0.08, 0.12, K.BLACK, { cap: K.STEEL });
      F.box(0.14, 0.3, 0.08, 0.66, 0.4, 0.26, K.Y);
      F.box(0.1, 0.3, 0.08, 0.12, 0.4, 0.36, K.DARK);
      F.box(0.4, 0.36, 0.34, 0.2, 0.28, 0.1, K.BLACK);
      F.box(0.4, 0.38, 0.44, 0.06, 0.24, 0.12, K.BLACK);
      for (const [x, y] of [[0.26, 0.31], [0.26, 0.65], [0.66, 0.31], [0.66, 0.65]]) F.box(x, y, 0.34, 0.04, 0.04, 0.48, K.DARK);
      F.box(0.26, 0.31, 0.82, 0.44, 0.38, 0.04, K.DARK);
      F.dot(0.48, 0.5, 0.88, 0.02, REDUCE || Math.sin(t * 6) > 0 ? "#FFB020" : "#7A5A1A", { em: true, o: 0.1 });
      F.box(0.8, 0.32, 0.04, 0.04, 0.04, 1.06, K.DARK); F.box(0.8, 0.64, 0.04, 0.04, 0.04, 1.06, K.DARK);
      const lift = REDUCE ? 0.2 : (Math.sin(t * 0.7) + 1) * 0.22;
      F.box(0.84, 0.32, 0.06 + lift, 0.03, 0.36, 0.14, K.DARK, { o: 0.01 });
      F.box(0.87, 0.36, 0.06 + lift, 0.13, 0.05, 0.02, K.STEEL, { o: 0.02 }); F.box(0.87, 0.59, 0.06 + lift, 0.13, 0.05, 0.02, K.STEEL, { o: 0.02 });
      F.box(0.87, 0.34, 0.08 + lift, 0.13, 0.32, 0.05, K.WOOD, { o: 0.03 }); F.box(0.88, 0.36, 0.13 + lift, 0.11, 0.28, 0.12, "#D6C3A1", { o: 0.04 });
    },
  },
  {
    id: "prensa", n: "Prensa hidráulica", tier: 4, r: "rara", a: "materiales", h: 1.4, cota: "100 t",
    specs: [["Fuerza", "100 t"], ["Carrera", "300 mm"], ["Mesa", "800 × 600 mm"], ["Presión", "250 bar"]],
    uso: "Estampado, embutido y conformado de chapa.",
    m(F, t) {
      F.box(0.08, 0.16, 0, 0.84, 0.68, 0.26, K.DARK);
      for (const [x, y] of [[0.14, 0.22], [0.76, 0.22], [0.14, 0.68], [0.76, 0.68]]) F.cyl(x + 0.05, y + 0.05, 0.26, 0.05, 0.86, K.ALU);
      F.box(0.24, 0.3, 0.26, 0.52, 0.4, 0.06, K.STEEL);
      F.box(0.32, 0.36, 0.32, 0.36, 0.28, 0.04, "#C3CCD6");
      const d = REDUCE ? 0.1 : Math.max(0, Math.sin(t * 1.3)) * 0.22;
      F.cyl(0.5, 0.5, 0.86 - d, 0.07, 0.3 + d, K.ALU, { o: 0.01 });
      F.box(0.26, 0.32, 0.62 - d, 0.48, 0.36, 0.24, K.RED, { o: 0.02 });
      F.box(0.08, 0.16, 1.12, 0.84, 0.68, 0.26, K.Y);
      F.cyl(0.5, 0.5, 1.38, 0.16, 0.18, K.DARK);
      F.box(0.02, 0.86, 0, 0.04, 0.04, 0.8, K.Y); F.box(0.94, 0.86, 0, 0.04, 0.04, 0.8, K.Y);
      for (let i = 0; i < 6; i++) F.box(0.02, 0.86, i * 0.13 + 0.06, 0.04, 0.042, 0.05, K.BLACK, { o: 0.01 });
      for (let i = 0; i < 6; i++) F.box(0.94, 0.86, i * 0.13 + 0.06, 0.04, 0.042, 0.05, K.BLACK, { o: 0.01 });
    },
  },
  {
    id: "fresadora", n: "Centro de mecanizado CNC", tier: 4, r: "rara", a: "digital", h: 1.15, cota: "3 ejes · 12 000 rpm",
    specs: [["Recorridos", "X 800, Y 500, Z 500 mm"], ["Husillo", "12 000 rpm, 15 kW"], ["Cambiador", "24 herramientas"], ["Control", "CNC ISO, código G"]],
    uso: "Fresa, taladra y rosca piezas complejas a partir de un programa.",
    m(F, t) {
      F.box(0.04, 0.12, 0, 0.84, 0.76, 0.12, K.DARK);
      F.box(0.06, 0.14, 0.12, 0.8, 0.72, 0.92, "#E3E8EC");
      F.box(0.22, 0.859, 0.32, 0.46, 0.004, 0.52, K.GLASS, { alpha: 0.75, o: 0.01 });
      const x = REDUCE ? 0.4 : 0.32 + (Math.sin(t * 0.9) + 1) * 0.13;
      F.box(x, 0.86, 0.66, 0.06, 0.004, 0.16, K.STEEL2, { o: 0.02 });
      F.box(x + 0.02, 0.862, 0.52, 0.02, 0.004, 0.14, K.ALU, { o: 0.03 });
      F.box(0.24, 0.862, 0.36, 0.42, 0.004, 0.06, K.STEEL2, { o: 0.02 });
      F.box(0.06, 0.14, 1.04, 0.8, 0.72, 0.04, K.BLUE);
      F.box(0.86, 0.62, 0.42, 0.12, 0.2, 0.34, K.DARK);
      F.box(0.98, 0.64, 0.5, 0.004, 0.16, 0.12, "#0B2440", { o: 0.01 });
      F.box(0.981, 0.65, 0.52, 0.004, 0.14, 0.08, "#4FC3F7", { em: true, o: 0.02 });
      F.dot(0.98, 0.7, 0.45, 0.015, "#FF5A5F", { em: true, o: 0.03 });
      F.cyl(0.78, 0.26, 1.08, 0.025, 0.16, K.STEEL2);
      F.dot(0.78, 0.26, 1.27, 0.03, REDUCE || Math.sin(t * 2) > 0 ? "#46E08B" : "#1E5B3A", { em: true });
    },
  },
  {
    id: "calidad", n: "Estación de control de calidad", tier: 4, r: "epica", a: "proba", h: 1.05, cota: "X̄-R · 3σ",
    specs: [["Equipo", "Máquina de medición por coordenadas"], ["Exactitud", "2,5 µm"], ["Muestreo", "n = 5 cada 30 min"], ["Gráficos", "X̄-R con límites a 3σ"]],
    uso: "Detecta cuándo un proceso sale de control antes de producir piezas falladas. Probabilidad aplicada.",
    m(F, t) {
      F.box(0.06, 0.14, 0, 0.6, 0.72, 0.3, "#4B5566");
      F.box(0.08, 0.16, 0.3, 0.56, 0.68, 0.06, "#2F3640");
      const y = REDUCE ? 0.4 : 0.26 + (Math.sin(t * 0.7) + 1) * 0.2;
      F.box(0.1, y, 0.36, 0.06, 0.08, 0.5, K.BLUE, { o: 0.01 }); F.box(0.56, y, 0.36, 0.06, 0.08, 0.5, K.BLUE, { o: 0.01 });
      F.box(0.1, y, 0.86, 0.52, 0.08, 0.08, K.BLUE, { o: 0.02 });
      const zx = REDUCE ? 0.3 : 0.2 + (Math.sin(t * 1.3) + 1) * 0.15;
      F.box(zx, y + 0.01, 0.5, 0.05, 0.06, 0.36, K.ALU, { o: 0.03 });
      F.dot(zx + 0.025, y + 0.04, 0.48, 0.02, K.RED, { o: 0.04 });
      F.box(0.3, 0.6, 0.36, 0.14, 0.14, 0.06, K.Y, { o: 0.005 });
      F.box(0.72, 0.4, 0, 0.04, 0.04, 0.56, K.DARK);
      F.box(0.68, 0.3, 0.56, 0.14, 0.24, 0.02, K.DARK);
      F.box(0.72, 0.28, 0.58, 0.04, 0.42, 0.3, K.BLACK);
      F.fn(0.76, 0.3, 0.6, (S) => {
        const c = F.ctx; if (!c) return;
        const pts = Array.from({ length: 9 }, (_, i) => S(0.761, 0.31 + i * 0.045, 0.73 + Math.sin(i * 1.7 + Math.floor((REDUCE ? 0 : t) * 1.5)) * 0.07));
        c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); c.strokeStyle = "#4FC3F7"; c.lineWidth = 1.2; c.stroke();
        for (const zz of [0.62, 0.84]) { const a = S(0.761, 0.31, zz), b = S(0.761, 0.67, zz); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.strokeStyle = "#FF5A5F"; c.setLineDash([2, 2]); c.stroke(); c.setLineDash([]); }
      }, { o: 0.3 });
    },
  },
  {
    id: "watt", glowPad: 0.9, n: "Máquina de vapor de Watt", tier: 4, r: "legendaria", a: "historia", h: 1.4, cota: "1776",
    specs: [["Inventor", "James Watt, 1776"], ["Mejora", "Condensador separado: cuatro veces menos carbón"], ["Potencia", "Unos 10 caballos de vapor"], ["Consecuencia", "La Revolución Industrial"]],
    uso: "La máquina que empezó todo. Reliquia de museo.",
    m(F, t, x) {
      F.box(0.06, 0.1, 0, 0.88, 0.8, 0.14, K.BRICK);
      F.cyl(0.26, 0.5, 0.14, 0.12, 0.42, "#4A3A2E");
      F.box(0.44, 0.44, 0.14, 0.1, 0.12, 0.92, "#6B5242");
      const a = REDUCE ? 0.2 : t * 1.4;
      const tilt = Math.sin(a) * 0.12;
      F.l3([[0.18, 0.5, 1.06 + tilt], [0.82, 0.5, 1.06 - tilt]], K.BLACK, 6, { o: 0.5 });
      F.l3([[0.26, 0.5, 1.04 + tilt], [0.26, 0.5, 0.56]], K.STEEL, 2.5, { o: 0.3 });
      F.l3([[0.78, 0.5, 1.04 - tilt], [0.78 + Math.cos(a) * 0.12, 0.62, 0.42 + Math.sin(a) * 0.12]], K.STEEL, 2.5, { o: 0.45 });
      F.ring("y", 0.78, 0.66, 0.42, 0.3, K.BLACK, 6, 6, a, { hub: K.BRASS, o: 0.4 });
      F.l3([[0.46, 0.5, 1.06], [0.46, 0.5, 1.26]], K.BRASS, 2, { o: 0.6 });
      const g = REDUCE ? 0 : t * 4;
      F.dot(0.46 + Math.cos(g) * 0.07, 0.5 + Math.sin(g) * 0.07, 1.2, 0.025, K.BRASS, { o: 0.7 });
      F.dot(0.46 - Math.cos(g) * 0.07, 0.5 - Math.sin(g) * 0.07, 1.2, 0.025, K.BRASS, { o: 0.7 });
      F.box(0.34, 0.899, 0.04, 0.32, 0.01, 0.08, K.GOLD, { o: 0.05 });
      if (!x?.mini && !x?.park) F.glow(0.5, 0.5, 0.8, 0.8, "rgba(232,185,35,ALPHA)", 0.2);
    },
  },
  // ------------------------------------------------------------ Categoría 5
  {
    id: "robot", n: "Robot industrial de 6 ejes", tier: 5, r: "comun", a: "digital", h: 1.2, cota: "Alcance 1,8 m",
    specs: [["Ejes", "6"], ["Carga", "20 kg"], ["Alcance", "1,8 m"], ["Repetibilidad", "± 0,05 mm"]],
    uso: "Soldadura, pintura y manipulación, tres turnos sin pausa.",
    m(F, t) {
      F.box(0.1, 0.1, 0, 0.5, 0.5, 0.06, K.DARK);
      F.cyl(0.35, 0.35, 0.06, 0.18, 0.1, K.BLACK);
      F.cyl(0.35, 0.35, 0.16, 0.14, 0.14, K.Y);
      const yaw = REDUCE ? 0.6 : 0.6 + Math.sin(t * 0.9) * 0.7;
      const sh = REDUCE ? 0.3 : 0.25 + Math.sin(t * 0.9 + 1) * 0.15;
      const j1 = [0.35, 0.35, 0.34];
      const L1 = 0.6, L2 = 0.5;
      const j2 = [j1[0] + Math.cos(yaw) * Math.sin(sh) * L1, j1[1] + Math.sin(yaw) * Math.sin(sh) * L1, j1[2] + Math.cos(sh) * L1];
      const el = 1.9 + Math.sin(t * 0.9 + 2) * (REDUCE ? 0 : 0.25);
      const dir = sh + el;
      const j3 = [j2[0] + Math.cos(yaw) * Math.sin(dir) * L2, j2[1] + Math.sin(yaw) * Math.sin(dir) * L2, j2[2] + Math.cos(dir) * L2];
      F.l3([j1, j2], K.Y2, 13, { o: 0.4 }); F.l3([j1, j2], K.Y, 9, { o: 0.41 });
      F.dot(j2[0], j2[1], j2[2], 0.06, K.BLACK, { o: 0.42 });
      F.l3([j2, j3], K.Y2, 10, { o: 0.43 }); F.l3([j2, j3], K.Y, 7, { o: 0.44 });
      F.dot(j3[0], j3[1], j3[2], 0.045, K.BLACK, { o: 0.45 });
      F.l3([j3, [j3[0], j3[1], j3[2] - 0.12]], K.STEEL, 4, { o: 0.46 });
      F.dot(j1[0], j1[1], j1[2], 0.07, K.BLACK, { o: 0.39 });
      F.box(0.64, 0.6, 0, 0.3, 0.3, 0.3, K.STEEL2); F.box(0.68, 0.64, 0.3, 0.12, 0.12, 0.1, K.WOOD); F.box(0.82, 0.76, 0.3, 0.1, 0.1, 0.08, K.WOOD);
      for (const [px, py] of [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98]]) F.box(px - 0.015, py - 0.015, 0, 0.03, 0.03, 0.5, K.Y, { o: -0.2 });
      F.l3([[0.02, 0.98, 0.45], [0.98, 0.98, 0.45], [0.98, 0.02, 0.45]], K.Y, 1.5, { o: 0.6, dash: [3, 3] });
    },
  },
  {
    id: "cinta", n: "Cinta transportadora", tier: 5, r: "comun", a: "gestion", h: 0.6, cota: "800 mm · 1 m/s",
    specs: [["Ancho", "800 mm"], ["Velocidad", "1 m/s"], ["Capacidad", "400 t/h"], ["Accionamiento", "Motorreductor de 11 kW"]],
    uso: "Lleva material de una etapa a la otra sin que nadie lo cargue.",
    m(F, t) {
      for (let i = 0; i < 4; i++) { F.box(0.06 + i * 0.28, 0.3, 0, 0.04, 0.04, 0.26, K.DARK); F.box(0.06 + i * 0.28, 0.66, 0, 0.04, 0.04, 0.26, K.DARK); }
      F.box(0, 0.28, 0.26, 1, 0.06, 0.1, K.Y); F.box(0, 0.66, 0.26, 1, 0.06, 0.1, K.Y);
      F.box(0, 0.34, 0.27, 1, 0.32, 0.06, "#2A2F38", { o: -0.01 });
      const off = REDUCE ? 0 : (t * 0.4) % 0.125;
      for (let i = -1; i < 9; i++) { const x = i * 0.125 + off; if (x > 0.005 && x < 0.97) F.flat([[x, 0.345], [x + 0.025, 0.345], [x + 0.025, 0.655], [x, 0.655]], 0.331, "#4C5462", { stroke: false, o: 0.001 }); }
      for (let i = 0; i < 3; i++) {
        const bx = ((REDUCE ? 0.3 : t * 0.4) + i * 0.42) % 1.26 - 0.18;
        if (bx > -0.02 && bx < 0.84) F.box(Math.max(0, bx), 0.39, 0.33, 0.16, 0.22, 0.14, i === 1 ? "#C9A27A" : K.WOOD, { o: 0.01 });
      }
      F.box(0.88, 0.7, 0.18, 0.12, 0.12, 0.14, K.BLUE); F.hcyl("y", 0.94, 0.72, 0.25, 0.1, 0.05, K.BLUE2);
      F.box(0.5, 0.25, 0.3, 0.03, 0.03, 0.22, K.DARK); F.dot(0.515, 0.265, 0.52, 0.02, REDUCE || Math.sin(t * 5) > 0 ? "#FF5A5F" : "#4A2023", { em: true });
    },
  },
  {
    id: "reactor", n: "Reactor químico encamisado", tier: 5, r: "rara", a: "quimica", h: 1.25, cota: "5 m³ · 10 bar",
    specs: [["Volumen", "5 m³"], ["Material", "Acero inoxidable 316L"], ["Presión de diseño", "10 bar"], ["Agitación", "Turbina Rushton, 120 rpm"]],
    uso: "Donde la química pasa del pizarrón a la escala industrial.",
    m(F, t) {
      for (const [x, y] of [[0.24, 0.24], [0.76, 0.24], [0.24, 0.76], [0.76, 0.76]]) F.box(x - 0.03, y - 0.03, 0, 0.06, 0.06, 0.32, K.DARK);
      F.cone(0.5, 0.5, 0.32, 0.32, -0.12, "#BAC4CE");
      F.cyl(0.5, 0.5, 0.26, 0.34, 0.56, "#DCE2E8", { capless: true });
      F.cyl(0.5, 0.5, 0.42, 0.345, 0.04, K.STEEL2, { capless: true, o: 0.01 });
      F.cyl(0.5, 0.5, 0.66, 0.345, 0.04, K.STEEL2, { capless: true, o: 0.01 });
      F.dome(0.5, 0.5, 0.82, 0.34, "#E6EBF0", { k: 0.5 });
      F.cyl(0.5, 0.5, 0.98, 0.07, 0.06, K.DARK); F.box(0.42, 0.42, 1.04, 0.16, 0.16, 0.16, K.BLUE);
      F.cyl(0.66, 0.38, 0.95, 0.07, 0.07, K.STEEL);
      F.box(0.82, 0.48, 0.5, 0.004, 0.08, 0.14, "#2D5B7A", { o: 0.02 });
      F.hcyl("x", 0.82, 0.62, 0.3, 0.18, 0.04, K.STEEL); F.cyl(0.92, 0.62, 0.3, 0.05, 0.06, K.RED, { o: 0.02 });
      F.l3([[0.9, 0.2, 0], [0.9, 0.2, 0.95]], K.Y, 1.8, { o: 0.6 }); F.l3([[0.9, 0.3, 0], [0.9, 0.3, 0.95]], K.Y, 1.8, { o: 0.6 });
      for (let i = 0; i < 7; i++) F.l3([[0.9, 0.2, 0.1 + i * 0.13], [0.9, 0.3, 0.1 + i * 0.13]], K.Y, 1.3, { o: 0.6 });
      F.box(0.66, 0.16, 0.92, 0.26, 0.2, 0.02, K.STEEL2, { o: 0.5 });
    },
  },
  {
    id: "impresora", glowPad: 0.3, n: "Impresora 3D de metal", tier: 5, r: "rara", a: "digital", h: 1.1, cota: "250 × 250 × 300 mm",
    specs: [["Proceso", "Fusión láser de lecho de polvo"], ["Volumen", "250 × 250 × 300 mm"], ["Capa", "30 µm"], ["Materiales", "Titanio, inoxidable, Inconel"]],
    uso: "Fabrica piezas imposibles de mecanizar, capa por capa.",
    m(F, t, x) {
      F.box(0.08, 0.12, 0, 0.84, 0.76, 0.14, K.DARK);
      F.box(0.1, 0.14, 0.14, 0.8, 0.72, 0.86, "#E3E8EC");
      F.box(0.2, 0.858, 0.26, 0.5, 0.004, 0.58, "#46566E", { o: 0.01 });
      const prog = REDUCE ? 0.6 : ((t * 0.08) % 1);
      const layers = Math.max(1, Math.floor(prog * 16));
      F.box(0.24, 0.86, 0.3, 0.42, 0.004, 0.04, K.STEEL2, { o: 0.02 });
      for (let i = 0; i < layers; i++) { const w = 0.1 + Math.sin(i * 0.4) * 0.04 + 0.08; F.box(0.45 - w / 2, 0.862, 0.34 + i * 0.022, w, 0.003, 0.02, i % 2 ? "#D7DEE6" : "#BCC6D0", { o: 0.02 + i * 0.001 }); }
      const lz = 0.34 + layers * 0.022, lx = REDUCE ? 0.46 : 0.45 + Math.sin(t * 9) * 0.05;
      F.l3([[0.45, 0.862, 0.8], [lx, 0.862, lz]], "#FF6B2C", 1.4, { em: true, o: 0.05 });
      F.dot(lx, 0.862, lz, 0.012, "#FFE0B0", { raw: true, o: 0.06 });
      if (!x?.mini) F.glow(lx, 0.862, lz, 0.18, "rgba(255,120,40,ALPHA)", 0.6);
      F.box(0.2, 0.859, 0.26, 0.5, 0.004, 0.58, K.GLASS, { alpha: 0.18, o: 0.07 });
      F.box(0.1, 0.14, 1.0, 0.8, 0.72, 0.04, K.TEAL);
      F.box(0.74, 0.861, 0.62, 0.12, 0.004, 0.12, "#0B2440", { o: 0.02 });
      F.box(0.75, 0.862, 0.64, 0.1 * prog, 0.004, 0.02, "#4FC3F7", { em: true, o: 0.03 });
      F.dot(0.8, 0.862, 0.5, 0.02, "#FF5A5F", { em: true, o: 0.03 });
    },
  },
  {
    id: "turbina", still: true, n: "Turbina de vapor", tier: 5, r: "epica", a: "energia", h: 0.95, cota: "25 MW",
    specs: [["Potencia", "25 MW"], ["Vapor de entrada", "90 bar, 520 °C"], ["Velocidad", "3000 rpm"], ["Ciclo", "Rankine con recalentamiento"]],
    uso: "Convierte la energía del vapor en trabajo en el eje y, con el generador, en electricidad.",
    m(F, t) {
      F.box(0.02, 0.22, 0, 0.96, 0.56, 0.12, K.DARK);
      F.hcyl("x", 0.04, 0.5, 0.36, 0.2, 0.18, "#3A93A4");
      F.hcyl("x", 0.24, 0.5, 0.38, 0.28, 0.24, "#2E7D8C");
      F.q3([[0.24, 0.26, 0.38], [0.52, 0.26, 0.38], [0.52, 0.5, 0.64], [0.24, 0.5, 0.64]], "#3A93A4", { f: 0.15, o: 0.05 });
      F.hcyl("x", 0.52, 0.5, 0.36, 0.08, 0.08, K.STEEL);
      F.box(0.6, 0.3, 0.12, 0.36, 0.4, 0.42, K.RED);
      F.hcyl("x", 0.6, 0.5, 0.54, 0.36, 0.13, "#C23B3F", { o: 0.01 });
      F.cyl(0.18, 0.38, 0.5, 0.05, 0.4, K.STEEL2); F.cyl(0.18, 0.38, 0.9, 0.07, 0.04, K.STEEL);
      F.cyl(0.36, 0.38, 0.6, 0.04, 0.32, K.STEEL2);
      F.box(0.7, 0.699, 0.2, 0.16, 0.004, 0.08, K.WHITE, { o: 0.02 });
      F.box(0.72, 0.701, 0.22, 0.1, 0.004, 0.02, K.DARK, { o: 0.03 });
    },
  },
  {
    id: "jacquard", glowPad: 0.9, n: "Telar de Jacquard", tier: 5, r: "legendaria", a: "historia", h: 1.4, cota: "1804",
    specs: [["Inventor", "Joseph-Marie Jacquard, 1804"], ["Programa", "Tarjetas perforadas encadenadas"], ["Herencia", "Inspiró a Babbage y a las primeras computadoras"], ["Material", "Roble y hierro"]],
    uso: "La primera máquina programable de la historia. Reliquia de museo.",
    m(F, t, x) {
      for (const [px, py] of [[0.1, 0.15], [0.84, 0.15], [0.1, 0.8], [0.84, 0.8]]) F.box(px, py, 0, 0.06, 0.06, 1.15, K.WOOD2);
      F.box(0.1, 0.15, 1.15, 0.8, 0.71, 0.06, K.WOOD2);
      F.box(0.3, 0.3, 1.21, 0.4, 0.4, 0.14, K.WOOD);
      const off = REDUCE ? 0 : Math.floor(t * 2) % 2;
      for (let i = 0; i < 7; i++) {
        const z = 1.36 - i * 0.05 * 0.5;
        F.box(0.72 + (i % 2) * 0.03, 0.32 + i * 0.05, z, 0.12, 0.04, 0.012, i % 2 === off ? "#E9DFC6" : "#D8CBA9", { o: 0.01 * i });
      }
      for (let i = 0; i < 10; i++) F.l3([[0.2 + i * 0.065, 0.45, 1.15], [0.2 + i * 0.065, 0.62, 0.42]], ["#E5484D", "#2F6FDB", "#FFC21A", "#1F9D6B"][i % 4], 1, { o: 0.2 });
      F.hcyl("x", 0.12, 0.72, 0.38, 0.76, 0.08, "#B23A48");
      for (let i = 0; i < 6; i++) F.hcyl("x", 0.14 + i * 0.12, 0.72, 0.38, 0.05, 0.085, i % 2 ? K.Y : K.BLUE, { o: 0.01 });
      const sx = REDUCE ? 0.4 : 0.2 + (Math.sin(t * 2.4) + 1) * 0.28;
      F.box(sx, 0.56, 0.5, 0.1, 0.04, 0.03, K.WOOD2, { o: 0.3 });
      F.box(0.34, 0.86, 0.04, 0.32, 0.01, 0.08, K.GOLD, { o: 0.05 });
      if (!x?.mini && !x?.park) F.glow(0.5, 0.5, 0.9, 0.8, "rgba(232,185,35,ALPHA)", 0.2);
    },
  },
  // ------------------------------------------------------------ Categoría 6
  {
    id: "caldera", still: true, smoke: [[0.2, 0.5, 1.7, "vapor"]], n: "Caldera humotubular", tier: 6, r: "comun", a: "energia", h: 1.6, cota: "5 t/h · 10 bar",
    specs: [["Producción", "5 t/h de vapor"], ["Presión", "10 bar"], ["Combustible", "Gas natural"], ["Rendimiento", "92 %"]],
    uso: "Genera el vapor para calefacción y procesos de toda la planta.",
    m(F, t, x) {
      F.box(0.04, 0.22, 0, 0.92, 0.56, 0.1, K.DARK);
      F.box(0.14, 0.3, 0.1, 0.06, 0.4, 0.14, K.DARK); F.box(0.74, 0.3, 0.1, 0.06, 0.4, 0.14, K.DARK);
      F.hcyl("x", 0.08, 0.5, 0.48, 0.8, 0.26, "#EEF1F4");
      F.hcyl("x", 0.3, 0.5, 0.48, 0.04, 0.265, K.RED, { o: 0.01 }); F.hcyl("x", 0.62, 0.5, 0.48, 0.04, 0.265, K.RED, { o: 0.01 });
      F.box(0.86, 0.36, 0.28, 0.12, 0.28, 0.36, K.BLUE2);
      F.cyl(0.92, 0.5, 0.64, 0.05, 0.08, K.DARK, { o: 0.02 });
      F.cyl(0.2, 0.5, 0.7, 0.07, 0.95, "#5E6878"); F.cyl(0.2, 0.5, 1.65, 0.085, 0.04, K.DARK);
      F.cyl(0.46, 0.5, 0.74, 0.04, 0.12, K.STEEL); F.cyl(0.6, 0.5, 0.74, 0.03, 0.1, K.BRASS);
    },
  },
  {
    id: "silos", still: true, n: "Batería de silos", tier: 6, r: "comun", a: "gestion", h: 2.0, cota: "3 × 500 t",
    specs: [["Capacidad", "3 silos de 500 t"], ["Material", "Chapa galvanizada corrugada"], ["Carga", "Elevador a cangilones, 60 t/h"], ["Control", "Termometría y aireación"]],
    uso: "Almacena granos e insumos a granel para que la línea nunca se quede sin material.",
    m(F, t) {
      for (const [x, y] of [[0.24, 0.24], [0.66, 0.22], [0.22, 0.66]]) {
        F.cyl(x, y, 0, 0.18, 1.3, "#C7CED6");
        for (let i = 1; i < 6; i++) F.cyl(x, y, i * 0.22, 0.183, 0.012, "#A7B0BA", { capless: true, o: 0.001 });
        F.cone(x, y, 1.3, 0.18, 0.24, "#B4BCC6");
        F.cyl(x, y, 1.52, 0.03, 0.06, K.STEEL2);
      }
      F.box(0.62, 0.62, 0, 0.14, 0.14, 2.0, K.Y);
      for (let i = 0; i < 9; i++) F.box(0.62, 0.759, 0.1 + i * 0.21, 0.14, 0.004, 0.02, K.Y2, { o: 0.01 });
      F.box(0.6, 0.6, 2.0, 0.18, 0.18, 0.1, K.Y2);
      F.l3([[0.62, 0.66, 2.0], [0.22, 0.66, 1.6]], K.STEEL2, 3, { o: 1 }); F.l3([[0.66, 0.62, 2.0], [0.66, 0.22, 1.6]], K.STEEL2, 3, { o: 1 }); F.l3([[0.62, 0.62, 2.02], [0.24, 0.24, 1.6]], K.STEEL2, 3, { o: 1 });
    },
  },
  {
    id: "horno", glowPad: 0.8, smoke: [[0.52, 0.52, 1.75, "humo"]], n: "Alto horno", tier: 6, r: "rara", a: "materiales", h: 2.2, cota: "2000 m³",
    specs: [["Volumen útil", "2000 m³"], ["Producción", "4500 t/día de arrabio"], ["Temperatura", "1500 °C en el crisol"], ["Insumos", "Mineral de hierro, coque y caliza"]],
    uso: "El corazón de la siderurgia integrada.",
    m(F, t, x) {
      for (const [sx, sy] of [[0.15, 0.82], [0.4, 0.86]]) { F.cyl(sx, sy, 0, 0.11, 1.15, "#8C4A3A"); F.dome(sx, sy, 1.15, 0.11, "#7A3F31"); }
      F.box(0.3, 0.3, 0, 0.44, 0.44, 0.2, K.DARK);
      F.cyl(0.52, 0.52, 0.2, 0.3, 0.5, "#6B3A2E");
      F.cyl(0.52, 0.52, 0.7, 0.26, 0.6, "#8C4A3A");
      F.cone(0.52, 0.52, 1.3, 0.26, 0.24, "#5A6578");
      F.cyl(0.52, 0.52, 1.5, 0.08, 0.24, K.STEEL2);
      F.l3([[0.52, 0.52, 1.74], [0.82, 0.3, 2.1], [0.82, 0.3, 0.1]], "#6B7480", 6, { o: -0.6 });
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; F.l3([[0.52 + Math.cos(a) * 0.36, 0.52 + Math.sin(a) * 0.36, 0.8], [0.52 + Math.cos(a) * 0.3, 0.52 + Math.sin(a) * 0.3, 0.62]], "#5A4A40", 2, { o: 0.4 }); }
      const pulse = REDUCE ? 1 : 0.7 + Math.sin(t * 3) * 0.3;
      F.box(0.44, 0.81, 0.06, 0.16, 0.004, 0.12, "#FF8A3D", { em: true, o: 0.05 });
      if (!x?.mini) F.glow(0.52, 0.86, 0.12, 0.7, "rgba(255,140,60,ALPHA)", 0.55 * pulse);
      if (!REDUCE && !x?.mini) { const r = rng(Math.floor(t * 10)); for (let i = 0; i < 5; i++) F.dot(0.46 + r() * 0.14, 0.86 + r() * 0.12, 0.08 + r() * 0.1, 0.008, "#FFD27A", { raw: true, o: 0.6 }); }
    },
  },
  {
    id: "torre", still: true, smoke: [[0.5, 0.5, 1.6, "nube"]], n: "Torre de enfriamiento", tier: 6, r: "rara", a: "energia", h: 1.9, cota: "3000 m³/h",
    specs: [["Caudal", "3000 m³/h"], ["Salto térmico", "10 °C"], ["Tiro", "Natural, hiperboloide"], ["Altura", "60 m (a escala)"]],
    uso: "Rechaza al ambiente el calor del condensador. Lo blanco que sale es vapor de agua.",
    m(F, t, x) {
      const prof = (z) => { const u = z / 1.6; return 0.29 + 0.15 * Math.pow(Math.abs(u - 0.7) / 0.7, 1.6) * (u < 0.7 ? 1 : 0.55); };
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; F.box(0.5 + Math.cos(a) * 0.4 - 0.02, 0.5 + Math.sin(a) * 0.4 - 0.02, 0, 0.04, 0.04, 0.12, "#8C949C", { o: -0.2 }); }
      F.fn(0.5, 0.5, 0.0, (S) => {
        const P = F.P, c = F.ctx, kx = P.tw * 0.7071, ky = P.th * 0.7071;
        const [cx0] = S(0.5, 0.5, 0);
        const L = [], R = [];
        for (let i = 0; i <= 16; i++) { const z = 0.1 + (i / 16) * 1.5; const [, cy] = S(0.5, 0.5, z); const r = prof(z - 0.1) * kx; L.push([cx0 - r, cy]); R.push([cx0 + r, cy]); }
        const top = S(0.5, 0.5, 1.6), bot = S(0.5, 0.5, 0.1);
        const rt = prof(1.5) * kx, rb = prof(0) * kx;
        c.beginPath();
        c.moveTo(L[0][0], L[0][1]);
        for (const p of L) c.lineTo(p[0], p[1]);
        c.ellipse(top[0], top[1], rt, rt * ky / kx, 0, Math.PI, 0, true);
        for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
        c.ellipse(bot[0], bot[1], rb, rb * ky / kx, 0, 0, Math.PI, false);
        c.closePath();
        if (P.style === "normal") { const g = c.createLinearGradient(cx0 - rb, 0, cx0 + rb, 0); g.addColorStop(0, P.col("#E8ECEF")); g.addColorStop(0.5, P.col("#CDD3D9")); g.addColorStop(1, P.col("#9AA3AC")); c.fillStyle = g; } else c.fillStyle = P.col("#CDD3D9");
        c.fill(); c.strokeStyle = P.style === "plano" ? "rgba(232,241,255,.95)" : "rgba(20,33,61,.55)"; c.lineWidth = P.lw; c.stroke();
        c.beginPath(); c.ellipse(top[0], top[1], rt, rt * ky / kx, 0, 0, Math.PI * 2); c.fillStyle = P.col("#6E777F"); c.fill(); c.stroke();
        c.beginPath(); c.ellipse(top[0], top[1] + 2, rt * 0.86, rt * 0.86 * ky / kx, 0, 0, Math.PI * 2); c.fillStyle = P.col("#4E565E"); c.fill();
        c.strokeStyle = P.style === "plano" ? "rgba(232,241,255,.5)" : "rgba(20,33,61,.18)"; c.lineWidth = 1;
        for (const z of [0.5, 0.9, 1.3]) { const [, yy] = S(0.5, 0.5, z); const r = prof(z - 0.1) * kx; c.beginPath(); c.ellipse(cx0, yy, r, r * ky / kx, 0, 0, Math.PI); c.stroke(); }
      }, { o: 0.2 });
    },
  },
  {
    id: "eolico", n: "Aerogenerador", tier: 6, r: "epica", a: "energia", h: 3.0, cota: "4 MW · Ø 136 m",
    specs: [["Potencia", "4 MW"], ["Diámetro de rotor", "136 m"], ["Altura de buje", "110 m"], ["Arranque", "Con 3 m/s de viento"]],
    uso: "Energía del viento patagónico directo a la red.",
    m(F, t) {
      F.cyl(0.5, 0.5, 0, 0.2, 0.08, "#B8C0C8");
      F.cyl(0.5, 0.5, 0.08, 0.075, 1.4, "#F2F4F6", { capless: true });
      F.cyl(0.5, 0.5, 1.48, 0.06, 1.1, "#F2F4F6");
      F.hcyl("x", 0.4, 0.5, 2.62, 0.3, 0.07, "#E6EAEE");
      F.dome(0.72, 0.5, 2.55, 0.07, "#E6EAEE");
      const a0 = REDUCE ? 0.4 : t * 1.2;
      F.fn(0.72, 0.5, 2.62, (S) => {
        const c = F.ctx; if (!c) return;
        const [hx, hy] = S(0.78, 0.5, 2.62);
        for (let i = 0; i < 3; i++) {
          const a = a0 + i * (Math.PI * 2 / 3);
          const pt = (r, da) => S(0.78 + Math.cos(a + da) * r * 0.7071, 0.5 - Math.cos(a + da) * r * 0.7071, 2.62 + Math.sin(a + da) * r);
          const pts = [pt(0.08, 0.5), pt(0.4, 0.13), pt(1.15, 0.0), pt(0.4, -0.05), pt(0.08, -0.5)];
          c.beginPath(); pts.forEach(([u, v], j) => (j ? c.lineTo(u, v) : c.moveTo(u, v))); c.closePath();
          c.fillStyle = F.P.col("#F7F9FA"); c.fill(); c.strokeStyle = "rgba(20,33,61,.45)"; c.lineWidth = 0.8; c.stroke();
        }
        c.beginPath(); c.arc(hx, hy, Math.max(2, F.P.tw * 0.05), 0, Math.PI * 2); c.fillStyle = F.P.col("#D0D6DC"); c.fill();
      }, { o: 3 });
      F.dot(0.62, 0.5, 2.72, 0.02, REDUCE || Math.sin(t * 2) > 0.6 ? "#FF4D4D" : "#5A1E1E", { em: true, o: 2 });
    },
  },
  {
    id: "tokamak", glowPad: 1.0, n: "Tokamak experimental", tier: 6, r: "legendaria", a: "historia", h: 1.3, cota: "Plasma a 150 M °C",
    specs: [["Concepto", "URSS, años 50"], ["Plasma", "150 millones de °C, diez veces el núcleo del Sol"], ["Confinamiento", "Campo magnético toroidal"], ["Estado", "Experimental: la energía del futuro"]],
    uso: "Fusionar núcleos de hidrógeno como hace el Sol. Si sale, es la reliquia del futuro.",
    m(F, t, x) {
      F.cyl(0.5, 0.5, 0, 0.46, 0.14, K.DARK);
      F.cyl(0.5, 0.5, 0.14, 0.42, 0.06, K.STEEL2);
      const N = 14;
      const pulse = REDUCE ? 1 : 0.65 + Math.sin(t * 2.5) * 0.35;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + 0.1;
        const cx = 0.5 + Math.cos(a) * 0.3, cy = 0.5 + Math.sin(a) * 0.3;
        F.cyl(cx, cy, 0.2, 0.09, 0.42, "#4B5B78", { o: 0.01 });
        F.dome(cx, cy, 0.62, 0.09, "#5A6B8A", { k: 0.7 });
      }
      F.fn(0.5, 0.5, 0.42, (S) => {
        const c = F.ctx; if (!c) return;
        c.beginPath();
        for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; const [sx, sy] = S(0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.3, 0.42); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); }
        c.strokeStyle = `rgba(255,120,220,${0.55 + 0.4 * pulse})`; c.lineWidth = Math.max(2, F.P.tw * 0.06); c.stroke();
        c.strokeStyle = `rgba(255,230,250,${0.6 * pulse})`; c.lineWidth = Math.max(1, F.P.tw * 0.02); c.stroke();
      }, { o: 0.35 });
      F.cyl(0.5, 0.5, 0.2, 0.12, 0.62, "#3A4A66", { o: 0.5 });
      F.dome(0.5, 0.5, 0.82, 0.12, "#4B5B78", { o: 0.5 });
      if (!x?.mini) F.glow(0.5, 0.5, 0.42, 0.9, "rgba(240,110,220,ALPHA)", 0.4 * pulse);
      F.box(0.34, 0.95, 0.03, 0.32, 0.01, 0.08, K.GOLD, { o: 0.05 });
    },
  },
  // ------------------------------------------------------------ Chatarra
  {
    id: "chatarra", n: "Chatarra", tier: 0, r: "comun", a: "general", h: 0.4, cota: "Reciclable",
    specs: [["Origen", "Sesión cortada antes de tiempo"], ["Composición", "Un poco de todo"], ["Reciclaje", "5 chatarras se funden en una pieza común"]],
    uso: "Las horas contaron igual. La pieza, no tanto.",
    m(F, t) {
      F.flat([[0.12, 0.42], [0.46, 0.16], [0.86, 0.36], [0.82, 0.8], [0.34, 0.88]], 0.005, "#7A5A44");
      F.box(0.22, 0.34, 0, 0.3, 0.22, 0.16, K.RUST); F.box(0.48, 0.44, 0, 0.24, 0.3, 0.24, "#6B5242");
      F.hcyl("y", 0.36, 0.56, 0.1, 0.12, 0.1, K.BLACK, { cap: "#3B3B3B" });
      F.l3([[0.3, 0.3, 0.2], [0.52, 0.36, 0.34], [0.66, 0.3, 0.32]], K.STEEL2, 3);
      F.q3([[0.5, 0.5, 0.24], [0.74, 0.46, 0.4], [0.7, 0.62, 0.3]], "#9A7B60");
      F.flat(gearPts(0.7, 0.72, 8, 0.1, 0.07, 0.4), 0.02, K.RUST);
      if (!REDUCE) { const a = t * 3; F.dot(0.5 + Math.cos(a) * 0.12, 0.5 + Math.sin(a) * 0.08, 0.5 + Math.sin(a * 2) * 0.04, 0.008, "#14213D", { raw: true, o: 3 }); }
    },
  },
];
const PIECE_BY_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));

const SETS = [
  { id: "linea", n: "Línea de montaje", ids: ["motor", "cinta", "robot", "tablero"], premio: "Tu nave gana una línea de producción animada" },
  { id: "termica", n: "Central térmica", ids: ["caldera", "bomba", "turbina", "torre"], premio: "Tu chimenea larga vapor blanco y la nave se ilumina" },
  { id: "taller", n: "Taller mecánico", ids: ["banco", "torno", "fresadora", "soldadora"], premio: "Insignia de Maestro Tornero" },
  { id: "proceso", n: "Química de proceso", ids: ["reactor", "valvula", "compresor", "calidad"], premio: "Insignia de Ingeniería de Procesos" },
  { id: "museo", n: "Museo de la Ingeniería", ids: ["regla", "anticitera", "dinamo", "watt", "jacquard", "tokamak"], premio: "Aparece el Museo en el parque, para todo el grupo" },
];

// Dibuja una pieza en una baldosa (gx, gy) con rotación k
function drawPiece(P, piece, gx, gy, t, k = 0, x = {}) {
  const F = makeFrame(P, gx, gy, 1, 1, k);
  F.ctx = P.ctx; F.P = P;
  piece.m(F, t, x);
  if (x.star >= 2) F.box(0.02, 0.9, 0, 0.18, 0.06, 0.08, x.star >= 3 ? K.GOLD : K.ALU, { o: 0.9 });
  F.flush();
  if (x.star >= 3 && !x.mini && !REDUCE) {
    const r = rng(Math.floor(t * 3) + gx * 7 + gy * 13);
    for (let i = 0; i < 3; i++) {
      const [sx, sy] = P.S(gx + r(), gy + r(), (piece.h || 0.8) * r() + 0.2);
      const s = Math.max(1.5, P.tw * 0.035) * (0.5 + r());
      P.ctx.fillStyle = "rgba(255,226,120,.95)";
      P.ctx.beginPath(); P.ctx.moveTo(sx, sy - s * 2); P.ctx.lineTo(sx + s * 0.5, sy - s * 0.5); P.ctx.lineTo(sx + s * 2, sy); P.ctx.lineTo(sx + s * 0.5, sy + s * 0.5); P.ctx.lineTo(sx, sy + s * 2); P.ctx.lineTo(sx - s * 0.5, sy + s * 0.5); P.ctx.lineTo(sx - s * 2, sy); P.ctx.lineTo(sx - s * 0.5, sy - s * 0.5); P.ctx.closePath(); P.ctx.fill();
    }
  }
}

export { makePainter, makeFrame, drawPiece, PIECES, PIECE_BY_ID, TIERS, RARITY, AREAS, SETS, K, shade, mix, rng };
