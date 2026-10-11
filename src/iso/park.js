// Parque industrial del grupo: mundo (naves, etapas, infraestructura, gente) y escena con cámara.
// Portado del prototipo del Parque Remontada. Los datos vienen de la app con setWorld().
/* eslint-disable */
import { makePainter, makeFrame, drawPiece, PIECES, PIECE_BY_ID, SETS, K, shade, mix, rng, hash2, hull, circ, REDUCE } from "./iso.js";

// ============================================================================
// Mundo: amigos, niveles, etapas del parque, entidades, gente, vehículos, render
// ============================================================================
// Las naves del grupo. Las carga la app con setWorld(); cada una:
// { id, n (nombre), col (color), lot: [x, y], hours, closed (no estudió en 2 días), flag (racha de 7+), inv: Map<idPieza, cantidad> }
let FRIENDS = [];
const LOTS = [[5, 5], [11, 5], [5, 11], [11, 11]];
/** Cuántas naves entran en el parque. */
export const MAX_NAVES = LOTS.length;

const LEVELS = [
  { h: 0, n: "Ingresante" }, { h: 5, n: "Aprendiz de taller" }, { h: 15, n: "Operario" }, { h: 30, n: "Operario calificado" },
  { h: 50, n: "Técnico" }, { h: 80, n: "Supervisor de turno" }, { h: 120, n: "Jefe de sección" }, { h: 170, n: "Jefe de planta" },
  { h: 230, n: "Gerente de operaciones" }, { h: 300, n: "Director industrial" }, { h: 400, n: "Ingeniero del año" }, { h: 520, n: "Leyenda de la Remontada" },
];
const NAVE_FORMS = [
  { from: 1, n: "Galpón de chapa" }, { from: 3, n: "Taller" }, { from: 5, n: "Nave con techo de dientes de sierra" },
  { from: 7, n: "Nave con oficinas" }, { from: 9, n: "Planta con tanques y cartel" }, { from: 11, n: "Complejo con torre" },
];
const levelOf = (h) => { let l = 1; LEVELS.forEach((L, i) => { if (h >= L.h) l = i + 1; }); return l; };
const formOf = (lvl) => { let f = 0; NAVE_FORMS.forEach((F, i) => { if (lvl >= F.from) f = i; }); return f; };

const STAGES = [
  { h: 0, id: "base", n: "Cuatro lotes", d: "Un terreno de 10 × 10 con un galpón por persona." },
  { h: 25, id: "cerco", n: "Cerco y portería", d: "Alambrado perimetral, portón y garita de seguridad." },
  { h: 50, id: "calles", n: "Calles y luminarias", d: "Asfalto, sendas peatonales y faroles que se prenden de noche." },
  { h: 80, id: "camion", n: "Camiones de reparto", d: "El parque empieza a despachar: camiones recorriendo las calles." },
  { h: 120, id: "tanque", n: "Rotonda con tanque de agua", d: "El símbolo del parque, en el centro de la rotonda." },
  { h: 160, id: "amp1", n: "Primera ampliación", d: "El terreno crece a 14 × 14 y se arbola el perímetro." },
  { h: 200, id: "subestacion", n: "Subestación eléctrica", d: "Transformadores y torres de alta tensión para alimentar el parque." },
  { h: 260, id: "deposito", n: "Centro logístico", d: "Un depósito con muelles de carga y autoelevadores." },
  { h: 320, id: "comedor", n: "Comedor y club", d: "Mesas al aire libre donde la gente del parque almuerza." },
  { h: 380, id: "tren", n: "Ramal ferroviario", d: "Vías, andén y un tren de carga que entra y sale." },
  { h: 450, id: "amp2", n: "Segunda ampliación", d: "18 × 18 y una planta de tratamiento de efluentes." },
  { h: 520, id: "contenedores", n: "Patio de contenedores", d: "Una grúa pórtico mueve contenedores todo el día." },
  { h: 600, id: "lab", n: "Laboratorio de I+D", d: "Edificio vidriado con cúpula: acá se inventa lo que viene." },
  { h: 700, id: "solar", n: "Parque solar", d: "Filas de paneles fotovoltaicos en el borde oeste." },
  { h: 800, id: "amp3", n: "Tercera ampliación y parque eólico", d: "20 × 20 y aerogeneradores en todo el perímetro." },
  { h: 950, id: "torre", n: "Torre Remontada", d: "La torre corporativa con el logo que se ve desde lejos." },
  { h: 1100, id: "polo", n: "Polo industrial", d: "Dirigible, fuegos artificiales y el parque completo." },
];
const stageIdx = (h) => { let i = 0; STAGES.forEach((s, k) => { if (h >= s.h) i = k; }); return i; };
const has = (h, id) => h >= STAGES.find((s) => s.id === id).h;
const boundsFor = (h) => (h >= 800 ? [0, 20] : h >= 450 ? [1, 19] : h >= 160 ? [3, 17] : [5, 15]);

// ---------------------------------------------------------------- Estado
const STATE = { light: "auto", selected: null, groupHours: 0, deliveries: [], meId: null };

// Caras de los personajes: el avatar de cada uno (data URI de DiceBear), cacheado como imagen
const AVATARS = new Map();
function avatarImg(uri) {
  if (!uri) return null;
  let img = AVATARS.get(uri);
  if (!img) { img = new Image(); img.decoding = "async"; img.src = uri; AVATARS.set(uri, img); }
  return img.complete && img.naturalWidth ? img : null;
}

/** Festejo sobre la nave de alguien: un cartel que sube ("+ Motor trifásico IE3") y chispas. */
export function celebrate(friendId, text, color = "#FFC21A") {
  const f = FRIENDS.find((x) => x.id === friendId);
  if (!f) return;
  STATE.deliveries.push({ f, text, color, t0: performance.now() });
  const [lx, ly] = f.lot;
  for (let k = 0; k < 16; k++) emit(lx + 1 + (Math.random() - 0.5) * 2, ly + 1.5 + (Math.random() - 0.5) * 2, 0.1, "polvo");
  if (!REDUCE) {
    const z = 2.6;
    for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2, e = Math.random() * 0.4 + 0.5; FIREWORKS.push({ x: lx + 1, y: ly + 1.5, z, vx: Math.cos(a) * e, vy: -Math.cos(a) * e * 0.2, vz: Math.sin(a) * e + 0.4, life: 1.2, col: i % 3 ? color : "#FFFFFF" }); }
  }
}
const RANK = { comun: 0, rara: 1, epica: 2, legendaria: 3 };
const GH = () => STATE.groupHours;
const friendHours = (f) => f.hours;

/**
 * Carga los datos reales del grupo.
 * friends: [{ id, n, col, hours, closed, flag, inv }] (en orden: los primeros cuatro tienen lote)
 */
export function setWorld({ friends, groupHours, meId }) {
  FRIENDS = friends.slice(0, LOTS.length).map((f, i) => ({ ...f, lot: LOTS[i] }));
  STATE.groupHours = groupHours;
  STATE.meId = meId ?? null;
  for (const d of STATE.deliveries) d.f = FRIENDS.find((x) => x.id === d.f.id) ?? d.f;
}
/** Lote de una persona (para centrar la cámara en su nave). */
export function lotOf(friendId) { return FRIENDS.find((f) => f.id === friendId)?.lot ?? null; }
export function setLight(mode) { STATE.light = mode; }
export function getLight() { return STATE.light; }
export function clearSelection() { STATE.selected = null; }

// Las piezas que se exhiben en el lote: más espacio a medida que sube el nivel.
// Se eligen las de mayor categoría y rareza, mezclando categorías para que haya variedad.
function showcase(f, slots) {
  const inv = f.inv;
  const lvl = levelOf(friendHours(f));
  const n = Math.min(slots, 2 + Math.ceil(lvl * 0.75));
  const all = [...inv.entries()].filter(([id]) => id !== "chatarra" && PIECE_BY_ID[id]).map(([id, c]) => ({ p: PIECE_BY_ID[id], n: c }))
    .sort((a, b) => RANK[b.p.r] - RANK[a.p.r] || b.p.tier - a.p.tier || b.n - a.n);
  const out = [];
  let tall = 0;
  for (const it of all) {
    if (out.length >= n) break;
    const isTall = (it.p.h || 0) > 1.5;
    if (isTall && tall >= 2) continue;
    if (isTall) tall++;
    out.push(it);
  }
  return out.sort((a, b) => (b.p.h || 0) - (a.p.h || 0));
}
const starsOf = (n) => (n >= 6 ? 3 : n >= 3 ? 2 : 1);
function setsDone(f) { return SETS.filter((s) => s.ids.every((id) => f.inv.has(id))); }
const museumOpen = () => FRIENDS.some((f) => setsDone(f).some((s) => s.id === "museo"));
const leader = () => { const l = FRIENDS.reduce((a, b) => (!a || b.hours > a.hours ? b : a), null); return l && l.hours > 0 ? l : null; };

// ---------------------------------------------------------------- Luz del día
function lightNow() {
  let hr;
  if (STATE.light === "dia") hr = 13; else if (STATE.light === "atardecer") hr = 19.2; else if (STATE.light === "noche") hr = 23;
  else { const d = new Date(); hr = d.getHours() + d.getMinutes() / 60; }
  let night = 0, dusk = 0;
  if (hr >= 20.5 || hr < 5.5) night = 1;
  else if (hr >= 18 && hr < 20.5) { night = Math.pow((hr - 18) / 2.5, 2); dusk = 1 - Math.abs(hr - 19.3) / 1.4; }
  else if (hr >= 5.5 && hr < 7.5) { night = 1 - (hr - 5.5) / 2; dusk = 1 - Math.abs(hr - 6.6) / 1.1; }
  return { night: Math.max(0, Math.min(1, night)), dusk: Math.max(0, Math.min(1, dusk)), hr };
}

// ---------------------------------------------------------------- Edificios
function wallColor(f, closed) { const c = mix(f.col, "#FFFFFF", 0.18); return closed ? mix(c, "#9AA2AC", 0.55) : c; }
function windowCol(P, closed, seed) {
  if (closed) return "#4A5260";
  if (P.night > 0.35) return hash2(seed, 3) > 0.15 ? "#FFE08A" : "#6E6130";
  return "#A9D2EE";
}

function drawNave(P, f, form, closed, t, sel) {
  const [lx, ly] = f.lot;
  const fd = form >= 4 ? 4 : form === 0 ? 2 : 3;
  const F = makeFrame(P, lx, ly, 2, fd, 0); F.ctx = P.ctx; F.P = P;
  const wall = wallColor(f, closed);
  const roof = closed ? "#5C6575" : "#36486C";
  const em = { em: true };
  if (form === 0) {
    F.box(0.1, 0.1, 0, 1.8, 1.8, 0.7, wall);
    for (let i = 0; i < 9; i++) F.l3([[0.2 + i * 0.19, 1.902, 0.04], [0.2 + i * 0.19, 1.902, 0.66]], mix(wall, "#000000", 0.18), 1, { o: 0.01 });
    F.q3([[0.05, 0.05, 0.7], [1.95, 0.05, 0.7], [1.95, 1.0, 1.08], [0.05, 1.0, 1.08]], "#8A9BB0", { f: 0.1, o: 0.2 });
    F.q3([[0.05, 1.0, 1.08], [1.95, 1.0, 1.08], [1.95, 1.95, 0.7], [0.05, 1.95, 0.7]], "#8A9BB0", { f: -0.02, o: 0.21 });
    F.q3([[1.9, 0.1, 0.7], [1.9, 1.9, 0.7], [1.9, 1.0, 1.06]], wall, { f: -0.2, o: 0.1 });
    F.q3([[0.4, 1.0, 1.07], [1.0, 1.0, 1.07], [1.0, 1.5, 0.87], [0.4, 1.5, 0.87]], "#9C6B4A", { o: 0.22 });
    F.box(1.902, 0.7, 0, 0.004, 0.6, 0.5, closed ? "#6B7380" : "#5A4636", { o: 0.02 });
    F.box(0.6, 1.902, 0.3, 0.4, 0.004, 0.22, windowCol(P, closed, f.lot[0]), { ...em, o: 0.03 });
  } else if (form === 1) {
    F.box(0.1, 0.1, 0, 1.8, 2.8, 0.85, wall);
    F.q3([[0.05, 0.05, 0.85], [1.0, 0.05, 1.3], [1.0, 2.95, 1.3], [0.05, 2.95, 0.85]], roof, { f: 0.12, o: 0.3 });
    F.q3([[1.0, 0.05, 1.3], [1.95, 0.05, 0.85], [1.95, 2.95, 0.85], [1.0, 2.95, 1.3]], roof, { f: -0.15, o: 0.31 });
    F.q3([[0.1, 2.9, 0.85], [1.9, 2.9, 0.85], [1.0, 2.9, 1.28]], wall, { f: 0.0, o: 0.2 });
    for (let i = 0; i < 3; i++) F.box(0.25 + i * 0.5, 2.902, 0.4, 0.32, 0.004, 0.28, windowCol(P, closed, i + f.lot[0]), { ...em, o: 0.03 });
    F.box(1.902, 1.0, 0, 0.004, 1.0, 0.68, closed ? "#7A828E" : "#C3CCD6", { o: 0.02 });
    for (let i = 0; i < 6; i++) F.box(1.904, 1.0, 0.08 + i * 0.1, 0.004, 1.0, 0.012, "#9AA4B0", { o: 0.03 });
    F.cyl(0.4, 0.5, 1.0, 0.1, 0.7, closed ? "#6B7380" : "#B5473F");
  } else {
    // dientes de sierra (formas 2..5)
    const H = 1.0;
    F.box(0.1, 0.1, 0, 1.8, 2.8, H, wall);
    for (let i = 0; i < 4; i++) F.box(0.1 + i * 0.45, 2.902, 0.08, 0.02, 0.004, H - 0.12, mix(wall, "#000000", 0.12), { o: 0.01 });
    const teeth = 3, td = 2.8 / teeth;
    for (let i = 0; i < teeth; i++) {
      const y0 = 0.1 + i * td, y1 = y0 + td;
      F.q3([[0.08, y0, H + 0.42], [1.92, y0, H + 0.42], [1.92, y1, H], [0.08, y1, H]], roof, { f: 0.12, o: 0.3 + i * 0.01 });
      F.q3([[1.92, y0, H], [1.92, y1, H], [1.92, y0, H + 0.42]], roof, { f: -0.25, o: 0.31 + i * 0.01 });
      F.q3([[0.08, y1, H], [1.92, y1, H], [1.92, y1, H + 0.0], [0.08, y1, H]], roof, { o: 0.32 });
      F.q3([[0.12, y0 - 0.001, H + 0.02], [1.88, y0 - 0.001, H + 0.02], [1.88, y0 - 0.001, H + 0.4], [0.12, y0 - 0.001, H + 0.4]], windowCol(P, closed, i), { ...em, o: 0.29 + i * 0.01 });
    }
    if (form < 3) for (let i = 0; i < 3; i++) F.box(0.25 + i * 0.5, 2.902, 0.45, 0.32, 0.004, 0.3, windowCol(P, closed, i + 7), { ...em, o: 0.03 });
    F.box(1.902, 0.6, 0, 0.004, 0.9, 0.75, closed ? "#7A828E" : "#C3CCD6", { o: 0.02 });
    for (let i = 0; i < 7; i++) F.box(1.904, 0.6, 0.08 + i * 0.1, 0.004, 0.9, 0.012, "#9AA4B0", { o: 0.03 });
    F.box(1.9, 0.55, 0, 0.3, 1.0, 0.18, K.DARK, { o: 0.05 });
    F.box(2.18, 0.55, 0.02, 0.03, 0.08, 0.14, K.Y, { o: 0.06 }); F.box(2.18, 1.47, 0.02, 0.03, 0.08, 0.14, K.Y, { o: 0.06 });
    F.cyl(0.35, 0.4, H + 0.2, 0.11, 1.1, closed ? "#6B7380" : "#B5473F");
    for (let i = 0; i < 3; i++) F.cyl(0.35, 0.4, H + 0.5 + i * 0.25, 0.115, 0.04, "#F2F4F6", { capless: true, o: 0.01 });
    if (form >= 3) {
      // bloque de oficinas al frente
      F.box(0.1, 2.0, 0, 1.8, 0.95, 1.7, mix(wall, "#FFFFFF", 0.35), { o: 0.5 });
      for (let fl = 0; fl < 3; fl++) {
        F.box(0.16, 2.952, 0.18 + fl * 0.5, 1.68, 0.004, 0.3, windowCol(P, closed, fl + 11), { ...em, o: 0.52 });
        F.box(1.902, 2.08, 0.18 + fl * 0.5, 0.004, 0.8, 0.3, windowCol(P, closed, fl + 21), { ...em, o: 0.52 });
      }
      F.box(1.1, 2.95, 0, 0.5, 0.15, 0.04, K.DARK, { o: 0.55 });
      F.box(1.1, 2.95, 0.5, 0.5, 0.25, 0.04, K.DARK, { o: 0.56 });
      F.box(0.3, 2.3, 1.7, 0.3, 0.3, 0.18, K.ALU, { o: 0.6 }); F.box(0.75, 2.3, 1.7, 0.3, 0.3, 0.18, K.ALU, { o: 0.6 });
    }
    if (form >= 4) {
      for (const x of [0.5, 1.4]) { F.cyl(x, 3.5, 0, 0.36, 1.3, closed ? "#9AA2AC" : "#DCE2E8"); F.dome(x, 3.5, 1.3, 0.36, closed ? "#8A929C" : "#C8D0D8", { k: 0.4 }); F.cyl(x, 3.5, 0.2, 0.37, 0.05, f.col, { capless: true, o: 0.01 }); }
      F.l3([[0.5, 3.5, 1.45], [0.5, 2.6, 1.85]], K.STEEL2, 3, { o: 0.7 });
      // cartel en la azotea
      F.box(0.25, 2.55, 1.88, 0.03, 0.03, 0.4, K.DARK, { o: 0.7 }); F.box(1.7, 2.55, 1.88, 0.03, 0.03, 0.4, K.DARK, { o: 0.7 });
      F.fn(1.0, 2.56, 2.15, (S) => {
        const c = P.ctx; const a = S(0.2, 2.56, 2.0), b = S(1.8, 2.56, 2.0), d = S(1.8, 2.56, 2.36), e = S(0.2, 2.56, 2.36);
        c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.lineTo(...e); c.closePath();
        c.fillStyle = closed ? P.col("#3A4250") : P.night > 0.35 ? "#14213D" : P.col("#14213D"); c.fill();
        const m = S(1.0, 2.56, 2.18); c.save(); c.translate(m[0], m[1]);
        c.transform(1, 0.5, 0, 1, 0, 0);
        c.font = `800 ${Math.max(7, P.tw * 0.2)}px "Bricolage Grotesque", system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillStyle = closed ? "#7A828E" : P.night > 0.35 ? f.col : mix(f.col, "#FFFFFF", 0.2);
        if (P.night > 0.35 && !closed) { c.shadowColor = f.col; c.shadowBlur = 8; }
        c.fillText(f.n.toUpperCase(), 0, 0); c.restore();
      }, { o: 0.8 });
    }
    if (form >= 5) {
      F.box(0.2, 2.1, 1.7, 0.9, 0.75, 2.4, "#5C8DB8", { o: 0.9 });
      for (let i = 0; i < 8; i++) F.box(0.2, 2.852, 1.8 + i * 0.28, 0.9, 0.004, 0.04, "#E3E8EC", { o: 0.91 });
      for (let i = 0; i < 6; i++) F.box(0.25 + (i % 3) * 0.28, 2.853, 1.86 + Math.floor(i / 3) * 1.1, 0.2, 0.004, 0.2, windowCol(P, closed, i + 31), { ...em, o: 0.92 });
      F.box(0.15, 2.05, 4.1, 1.0, 0.85, 0.08, K.DARK, { o: 0.95 });
      F.flat([[0.4, 2.25], [0.95, 2.25], [0.95, 2.75], [0.4, 2.75]], 4.181, "#2C3442", { o: 0.96 });
      F.text(0.67, 2.5, 4.19, "H", { size: 0.18, color: "#FFC21A", o: 0.97 });
      F.cyl(0.25, 2.2, 4.18, 0.012, 0.4, K.STEEL, { o: 0.97 });
      F.dot(0.25, 2.2, 4.6, 0.02, (REDUCE || Math.sin(t * 3) > 0) && !closed ? "#FF4D4D" : "#4A1E1E", { em: true, o: 0.98 });
    }
  }
  if (closed) {
    F.box(1.903, 0.65, 0.35, 0.004, 0.5, 0.16, "#D94448", { o: 0.07 });
    F.fn(1.904, 0.9, 0.43, (S) => { const c = P.ctx; const m = S(1.904, 0.9, 0.43); c.save(); c.translate(m[0], m[1]); c.transform(1, -0.5, 0, 1, 0, 0); c.font = `800 ${Math.max(6, P.tw * 0.09)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#FFFFFF"; c.fillText("CERRADO", 0, 0); c.restore(); }, { o: 0.08 });
  }
  F.flush();
  return { fd };
}

// Árboles y detalles chicos
function tree(F, x, y, kind, s = 1) {
  F.box(x - 0.03, y - 0.03, 0, 0.06, 0.06, 0.25 * s, "#7A5A44");
  if (kind === 0) { F.cone(x, y, 0.18 * s, 0.26 * s, 0.75 * s, "#3E8E5E"); F.cone(x, y, 0.5 * s, 0.19 * s, 0.55 * s, "#4FA36D", { o: 0.01 }); }
  else { F.dome(x, y, 0.22 * s, 0.28 * s, kind === 1 ? "#4FA36D" : "#7BB661", { k: 1.4 }); }
}
function lampPost(F, x, y, P) {
  F.box(x - 0.02, y - 0.02, 0, 0.04, 0.04, 0.95, "#5E6878");
  F.box(x - 0.02, y - 0.02, 0.92, 0.22, 0.04, 0.03, "#5E6878");
  F.dot(x + 0.18, y, 0.9, 0.035, P.night > 0.3 ? "#FFE48A" : "#E6EAEE", { em: true, raw: P.night > 0.3 });
  if (P.night > 0.3) F.glow(x + 0.18, y, 0.3, 1.0, "rgba(255,228,138,ALPHA)", 0.32 * P.night);
}

// ---------------------------------------------------------------- Infraestructura (devuelve entidades)
function infraEntities(H, P, t) {
  const E = [];
  const [lo, hi] = boundsFor(H);
  const add = (x0, y0, w, d, h, draw, info, anim = false) => E.push({ x0, y0, w, d, h, draw, info, anim, id: "inf:" + (info?.k || "x") + ":" + x0.toFixed(2) + "," + y0.toFixed(2) + ":" + w });
  // cerco y portería
  if (has(H, "cerco")) {
    const posts = [];
    for (let i = lo; i <= hi; i += 1) { posts.push([i, lo]); posts.push([i, hi]); posts.push([lo, i]); posts.push([hi, i]); }
    for (const [x, y] of posts) {
      if ((x > 8.8 && x < 11.2 && (y === lo || y === hi)) || (y > 8.8 && y < 11.2 && (x === lo || x === hi))) continue;
      add(x - 0.03, y - 0.03, 0.06, 0.06, 0.5, (F) => F.box(x - 0.025, y - 0.025, 0, 0.05, 0.05, 0.5, "#6B7480"));
    }
    add(lo, lo, hi - lo, 0.02, 0.4, (F) => {
      const segs = [[[lo, lo], [9, lo]], [[11, lo], [hi, lo]], [[lo, lo], [lo, 9]], [[lo, 11], [lo, hi]]];
      for (const [[a, b], [c, d]] of segs) for (const z of [0.2, 0.42]) F.l3([[a, b, z], [c, d, z]], "#8A939E", 0.9);
    });
    add(lo, hi, hi - lo, 0.02, 0.4, (F) => {
      const segs = [[[lo, hi], [9, hi]], [[11, hi], [hi, hi]], [[hi, lo], [hi, 9]], [[hi, 11], [hi, hi]]];
      for (const [[a, b], [c, d]] of segs) for (const z of [0.2, 0.42]) F.l3([[a, b, z], [c, d, z]], "#8A939E", 0.9);
    });
    const gx = 11.15, gy = lo + 0.15;
    add(gx, gy, 0.6, 0.6, 0.8, (F) => {
      F.box(gx, gy, 0, 0.6, 0.6, 0.62, "#E3E8EC"); F.box(gx - 0.05, gy - 0.05, 0.62, 0.7, 0.7, 0.06, K.NAVY);
      F.box(gx + 0.1, gy + 0.602, 0.28, 0.4, 0.004, 0.22, windowCol(P, false, 99), { em: true, o: 0.01 });
      const up = REDUCE ? 0.6 : Math.max(0, Math.sin(t * 0.5)) * 1.2;
      F.box(9.0, lo + 0.05, 0, 0.08, 0.08, 0.42, K.DARK);
      const ang = Math.min(1.3, up);
      const tip = [9.04 + Math.cos(ang) * 1.85, lo + 0.09, 0.4 + Math.sin(ang) * 1.85];
      F.l3([[9.04, lo + 0.09, 0.4], tip], "#FFFFFF", 3, { o: 1 });
      F.l3([[9.04, lo + 0.09, 0.4], tip], "#E5484D", 3, { o: 1.01, dash: [5, 7] });
    }, { k: "cerco" }, true);
  }
  // luminarias
  if (has(H, "calles")) {
    for (let v = lo + 1; v < hi; v += 2) {
      if (v > 8 && v < 12) continue;
      E.push({ x0: 8.7, y0: v, w: 0.1, d: 0.1, h: 1, dyn: true, draw: (F) => lampPost(F, 8.75, v, P) });
      E.push({ x0: v, y0: 11.3, w: 0.1, d: 0.1, h: 1, dyn: true, draw: (F) => lampPost(F, v, 11.32, P) });
    }
  }
  // rotonda con tanque
  if (has(H, "tanque")) {
    add(9.2, 9.2, 1.6, 1.6, 3, (F) => {
      F.flat(circ(10, 10, 0.95, 24), 0.01, "#7BB661");
      F.flat(circ(10, 10, 0.98, 24).map(([a, b]) => [a, b]), 0.005, "#E3E8EC");
      F.flat(circ(10, 10, 0.95, 24), 0.012, "#7BB661");
      for (const [x, y] of [[9.65, 9.65], [10.35, 9.65], [9.65, 10.35], [10.35, 10.35]]) F.box(x - 0.04, y - 0.04, 0, 0.08, 0.08, 1.7, "#6B7480");
      F.l3([[9.65, 9.65, 0.6], [10.35, 10.35, 1.2]], "#6B7480", 1.2); F.l3([[10.35, 9.65, 0.6], [9.65, 10.35, 1.2]], "#6B7480", 1.2);
      F.cyl(10, 10, 1.7, 0.62, 0.8, "#E9EDF1");
      F.cyl(10, 10, 2.0, 0.625, 0.12, "#FFC21A", { capless: true, o: 0.01 });
      F.cone(10, 10, 2.5, 0.64, 0.32, "#C3CCD6");
      F.fn(10.45, 10.45, 2.2, (S) => { const c = P.ctx; const m = S(10.52, 10.52, 2.24); c.save(); c.translate(m[0], m[1]); c.font = `900 ${Math.max(7, P.tw * 0.26)}px "Bricolage Grotesque", system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#14213D"; c.fillText("R", 0, 0); c.restore(); }, { o: 0.5 });
      F.dot(10, 10, 2.86, 0.03, (REDUCE || Math.sin(t * 2.4) > 0.3) ? "#FF4D4D" : "#5A1E1E", { em: true });
      for (const [x, y] of [[9.4, 10.3], [10.6, 9.5]]) tree(F, x, y, 1, 0.6);
    }, { k: "tanque" }, true);
  }
  // árboles del perímetro
  if (has(H, "amp1")) {
    const spots = [[3.6, 3.8], [4.4, 4.5], [12.2, 3.6], [13.4, 4.2], [14.6, 3.7], [3.6, 12.4], [4.3, 13.6], [3.7, 14.6], [15.6, 11.8], [16.3, 12.9], [15.5, 14.2], [16.4, 15.5], [12.5, 4.6], [16.4, 3.6], [3.5, 16.4]];
    spots.forEach(([x, y], i) => add(x - 0.3, y - 0.3, 0.6, 0.6, 1.1, (F) => tree(F, x, y, i % 3, 0.9 + (i % 4) * 0.1)));
  }
  // subestación
  if (has(H, "subestacion")) {
    add(5, 3, 3.6, 1.9, 2, (F) => {
      F.flat([[5, 3.05], [8.6, 3.05], [8.6, 4.9], [5, 4.9]], 0.01, "#AEB5BC");
      for (let i = 0; i < 8; i++) F.l3([[5 + i * 0.5, 3.05, 0.4], [5 + i * 0.5, 4.9, 0.4]], "#8A939E", 0.6);
    });
    E.push({ id: "trafo1", x0: 5.3, y0: 3.3, w: 1, d: 1, h: 1.1, draw: (F) => { drawPieceInto(F, P, "transformador", 5.3, 3.3, t); }, info: { k: "subestacion" }, raw: true });
    E.push({ id: "trafo2", x0: 6.5, y0: 3.3, w: 1, d: 1, h: 1.1, draw: (F) => { drawPieceInto(F, P, "transformador", 6.5, 3.3, t); }, info: { k: "subestacion" }, raw: true });
    add(7.8, 3.6, 0.6, 0.6, 3.2, (F) => {
      const x = 8.1, y = 3.9, h = 3.0;
      const legs = [[-0.25, -0.25], [0.25, -0.25], [0.25, 0.25], [-0.25, 0.25]];
      for (const [a, b] of legs) F.l3([[x + a, y + b, 0], [x + a * 0.25, y + b * 0.25, h]], "#7D8B99", 1.4);
      for (let z = 0.5; z < h; z += 0.5) { const k = 1 - z / h * 0.75; F.l3(legs.concat([legs[0]]).map(([a, b]) => [x + a * k, y + b * k, z]), "#7D8B99", 0.8); }
      F.l3([[x - 0.6, y, h - 0.3], [x + 0.6, y, h - 0.3]], "#7D8B99", 1.4);
      F.l3([[x - 0.6, y, h - 0.35], [5.8, 3.8, 1.0]], "#2A2F38", 0.7); F.l3([[x + 0.6, y, h - 0.35], [7.0, 3.8, 1.0]], "#2A2F38", 0.7);
      F.l3([[x, y, h], [x + 3, lo + 0.1, h + 0.3]], "#2A2F38", 0.7);
    }, { k: "subestacion" });
  }
  // depósito logístico
  if (has(H, "deposito")) {
    add(3.15, 5.1, 1.7, 3.8, 1.3, (F) => {
      F.box(3.15, 5.1, 0, 1.7, 3.8, 1.1, "#D6DCE2");
      F.q3([[3.1, 5.05, 1.1], [4.0, 5.05, 1.35], [4.0, 8.95, 1.35], [3.1, 8.95, 1.1]], "#7A8BA6", { f: 0.1, o: 0.2 });
      F.q3([[4.0, 5.05, 1.35], [4.9, 5.05, 1.1], [4.9, 8.95, 1.1], [4.0, 8.95, 1.35]], "#7A8BA6", { f: -0.15, o: 0.21 });
      for (let i = 0; i < 4; i++) { F.box(4.852, 5.35 + i * 0.9, 0, 0.004, 0.6, 0.7, "#9AA4B0", { o: 0.02 }); F.box(4.85, 5.3 + i * 0.9, 0, 0.2, 0.7, 0.16, K.DARK, { o: 0.03 }); }
      F.text(4.856, 7.0, 0.9, "LOGÍSTICA", { size: 0.2, color: "#14213D", o: 0.3, face: "x", weight: 800 });
    }, { k: "deposito" });
    const k = REDUCE ? 0.4 : (Math.sin(t * 0.5) + 1) / 2;
    E.push({ x0: 5.0 + 0, y0: 5.3 + k * 2.5, w: 0.6, d: 0.6, h: 1.2, raw: true, dyn: true, info: { k: "deposito" }, draw: () => { const F = makeFrame(P, 5.0, 5.3 + k * 2.5, 0.6, 0.6, 1); F.ctx = P.ctx; F.P = P; const s = 0.6; const G = scaled(F, s); PIECE_BY_ID.autoelevador.m(G, t, { mini: true }); F.flush(); } });
  }
  // comedor y club
  if (has(H, "comedor")) {
    add(15.1, 5.1, 1.8, 1.4, 1.4, (F) => {
      F.box(15.1, 5.1, 0, 1.8, 1.4, 0.8, "#F2E7D5");
      F.q3([[15.05, 5.05, 0.8], [16.0, 5.05, 1.25], [16.0, 6.55, 1.25], [15.05, 6.55, 0.8]], "#C2553F", { f: 0.1, o: 0.2 });
      F.q3([[16.0, 5.05, 1.25], [16.95, 5.05, 0.8], [16.95, 6.55, 0.8], [16.0, 6.55, 1.25]], "#C2553F", { f: -0.15, o: 0.21 });
      F.box(15.3, 6.502, 0.2, 1.4, 0.004, 0.4, windowCol(P, false, 55), { em: true, o: 0.02 });
      F.text(16.0, 6.506, 0.68, "COMEDOR", { size: 0.15, color: "#7A2E22", o: 0.3, face: "y", weight: 800 });
    }, { k: "comedor" });
    const tables = [[15.4, 7.2, "#E5484D"], [16.4, 7.3, "#2F6FDB"], [15.7, 8.2, "#FFC21A"], [16.6, 8.3, "#1F9D6B"]];
    for (const [x, y, c] of tables) add(x - 0.3, y - 0.3, 0.6, 0.6, 0.9, (F) => {
      F.cyl(x, y, 0, 0.2, 0.32, "#E9DFC6"); F.cyl(x, y, 0.32, 0.012, 0.45, "#5E6878"); F.cone(x, y, 0.72, 0.36, 0.14, c);
      for (let i = 0; i < 2; i++) person(F, x + (i ? 0.3 : -0.3), y + 0.1, 0, c === "#FFC21A" ? "#2F6FDB" : "#E5484D", t + i, true, P);
    }, { k: "comedor" });
  }
  // ramal ferroviario
  if (has(H, "tren")) {
    const ry = 15.9;
    add(lo, ry - 0.4, hi - lo, 0.8, 0.05, (F) => {
      for (let x = lo + 0.1; x < hi; x += 0.33) F.box(x, ry - 0.32, 0, 0.08, 0.64, 0.03, "#6B5242");
      F.l3([[lo, ry - 0.18, 0.05], [hi, ry - 0.18, 0.05]], "#8A939E", 1.4); F.l3([[lo, ry + 0.18, 0.05], [hi, ry + 0.18, 0.05]], "#8A939E", 1.4);
    }, { k: "tren" });
    add(5.2, 15.0, 2.6, 0.5, 1.0, (F) => {
      F.box(5.2, 15.0, 0, 2.6, 0.48, 0.18, "#C3C9CF");
      for (const x of [5.4, 6.5, 7.6]) F.box(x, 15.05, 0.18, 0.06, 0.06, 0.65, K.DARK);
      F.q3([[5.1, 14.9, 0.83], [7.9, 14.9, 0.83], [7.9, 15.55, 0.75], [5.1, 15.55, 0.75]], "#36486C", { o: 0.1 });
      F.box(5.9, 15.46, 0.5, 1.2, 0.02, 0.2, "#1F4FA8", { o: 0.15 }); F.text(6.5, 15.49, 0.6, "ESTACIÓN REMONTADA", { size: 0.1, color: "#FFFFFF", o: 0.2, face: "y", weight: 800 });
    }, { k: "tren" });
    const span = hi - lo + 6;
    const head = REDUCE ? lo + 6 : lo - 3 + ((t * 0.9) % span);
    const cars = [["#D94448", 1.1], ["#4E6E8E", 1.0], ["#8C6B4A", 1.0], ["#4E6E8E", 1.0], ["#2F6FDB", 1.0]];
    let x = head;
    cars.forEach(([c, L], i) => {
      const x0 = x - L;
      if (x0 > lo - 0.2 && x < hi + 0.2) {
        const xx = x0;
        E.push({ x0: xx, y0: ry - 0.28, w: L - 0.08, d: 0.56, h: 0.6, dyn: true, info: { k: "tren" }, draw: (F) => {
          F.box(xx, ry - 0.26, 0.08, L - 0.1, 0.52, i === 0 ? 0.55 : 0.48, c);
          if (i === 0) { F.box(xx + L - 0.42, ry - 0.24, 0.63, 0.3, 0.48, 0.18, "#2A2F38"); F.dot(xx + L - 0.08, ry, 0.35, 0.03, P.night > 0.3 ? "#FFF2B0" : "#E6EAEE", { em: true, raw: true }); if (P.night > 0.3) F.glow(xx + L + 0.4, ry, 0.2, 1.2, "rgba(255,242,176,ALPHA)", 0.35); }
          else for (let k2 = 0; k2 < 3; k2++) F.box(xx + 0.08 + k2 * 0.3, ry + 0.262, 0.14, 0.24, 0.004, 0.36, mix(c, "#000000", 0.15), { o: 0.01 });
        } });
      }
      x = x0 - 0.12;
    });
  }
  // planta de efluentes
  if (has(H, "amp2")) {
    add(11.2, 1.1, 4.6, 1.8, 0.5, (F) => {
      for (let i = 0; i < 3; i++) {
        const x = 11.3 + i * 1.5;
        F.box(x, 1.2, 0, 1.3, 1.6, 0.3, "#C3C9CF");
        F.flat([[x + 0.1, 1.3], [x + 1.2, 1.3], [x + 1.2, 2.7], [x + 0.1, 2.7]], 0.27, i === 0 ? "#6B8F6A" : i === 1 ? "#5E9CB0" : "#4F95C9", { o: 0.01 });
        const w = REDUCE ? 0 : (t * 0.3 + i * 0.3) % 1;
        for (let j = 0; j < 3; j++) { const yy = 1.35 + ((w + j / 3) % 1) * 1.3; F.l3([[x + 0.15, yy, 0.272], [x + 1.15, yy, 0.272]], "rgba(255,255,255,.35)", 1, { o: 0.02 }); }
      }
    }, { k: "amp2" }, true);
  }
  // patio de contenedores
  if (has(H, "contenedores")) {
    const cols = ["#D94448", "#2F6FDB", "#1F9D6B", "#F08A24", "#8B5CF6", "#E3E8EC"];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
      const x = 4.2 + i * 1.3, y = 17.2 + j * 0.85, levels = 1 + ((i * 3 + j) % 3);
      add(x, y, 1.2, 0.75, levels * 0.5, (F) => { for (let l = 0; l < levels; l++) { const c = cols[(i + j * 2 + l) % cols.length]; F.box(x, y, l * 0.48, 1.2, 0.72, 0.46, c); for (let s2 = 0; s2 < 6; s2++) F.l3([[x + 0.1 + s2 * 0.18, y + 0.724, l * 0.48 + 0.05], [x + 0.1 + s2 * 0.18, y + 0.724, l * 0.48 + 0.41]], shade(c, -0.25), 1.6, { o: 0.01 }); } }, { k: "contenedores" });
    }
    const gxp = REDUCE ? 8 : 5 + (Math.sin(t * 0.25) + 1) * 3.8;
    E.push({ x0: gxp - 0.2, y0: 17.0, w: 0.5, d: 2.0, h: 2.6, dyn: true, info: { k: "contenedores" }, draw: (F) => {
      F.box(gxp - 0.1, 17.0, 0, 0.14, 0.14, 2.3, K.Y); F.box(gxp - 0.1, 18.85, 0, 0.14, 0.14, 2.3, K.Y);
      F.box(gxp - 0.15, 16.95, 2.3, 0.24, 2.1, 0.22, K.Y);
      const ty = REDUCE ? 18 : 17.6 + (Math.sin(t * 0.6) + 1) * 0.5;
      F.box(gxp - 0.2, ty, 2.18, 0.34, 0.4, 0.16, K.DARK, { o: 0.1 });
      F.l3([[gxp - 0.03, ty + 0.2, 2.18], [gxp - 0.03, ty + 0.2, 1.35]], "#2A2F38", 0.8, { o: 0.11 });
      F.box(gxp - 0.55, ty - 0.15, 0.95, 1.1, 0.7, 0.4, "#F08A24", { o: 0.12 });
    } });
  }
  // laboratorio
  if (has(H, "lab")) {
    add(17.1, 11.1, 1.8, 3.6, 2.4, (F) => {
      F.box(17.1, 11.1, 0, 1.8, 3.6, 1.4, "#E3E8EC");
      for (let i = 0; i < 3; i++) F.box(17.1, 14.702, 0.15 + i * 0.42, 1.8, 0.004, 0.28, windowCol(P, false, 70 + i), { em: true, o: 0.01 });
      for (let i = 0; i < 3; i++) F.box(18.902, 11.2, 0.15 + i * 0.42, 0.004, 3.4, 0.28, windowCol(P, false, 80 + i), { em: true, o: 0.01 });
      F.dome(18.0, 12.2, 1.4, 0.7, "#B8C4CF");
      F.q3([[17.9, 11.6, 1.75], [18.1, 11.6, 1.75], [18.1, 12.8, 2.0], [17.9, 12.8, 2.0]], "#2A2F38", { o: 0.5 });
      F.cyl(18.3, 14.2, 1.4, 0.015, 0.9, K.STEEL);
      F.dot(18.3, 14.2, 2.32, 0.03, (REDUCE || Math.sin(t * 4) > 0) ? "#4FC3F7" : "#1A4A60", { em: true });
      F.text(18.0, 14.706, 1.32, "LABORATORIO I+D", { size: 0.14, color: "#14213D", o: 0.3, face: "y", weight: 800 });
    }, { k: "lab" }, true);
  }
  // parque solar
  if (has(H, "solar")) {
    for (let r = 0; r < 6; r++) {
      const y = 4.6 + r * 1.9;
      add(1.15, y, 1.7, 1.2, 0.6, (F) => {
        for (const x of [1.25, 2.6]) F.box(x, y + 0.5, 0, 0.05, 0.05, 0.35, K.DARK);
        F.q3([[1.15, y, 0.55], [2.85, y, 0.55], [2.85, y + 1.1, 0.2], [1.15, y + 1.1, 0.2]], "#1E3A6E", { f: 0.15, o: 0.1 });
        for (let k2 = 1; k2 < 5; k2++) F.l3([[1.15 + k2 * 0.34, y, 0.555], [1.15 + k2 * 0.34, y + 1.1, 0.205]], "#9EC8E8", 0.6, { o: 0.11 });
        F.l3([[1.15, y + 0.55, 0.377], [2.85, y + 0.55, 0.377]], "#9EC8E8", 0.6, { o: 0.11 });
      }, { k: "solar" });
    }
  }
  // aerogeneradores en el perímetro
  if (has(H, "amp3")) {
    const spots = [[0.1, 2.5], [0.1, 7.5], [0.1, 12.5], [0.1, 17.5], [19.0, 2.5], [19.0, 7.0], [2.5, 0.1], [7.5, 0.1], [16.5, 0.1], [17.5, 19.0], [12.5, 19.0]];
    spots.forEach(([x, y], i) => E.push({ id: "eol" + i, anim: true, x0: x, y0: y, w: 0.9, d: 0.9, h: 3.8, info: { k: "amp3" }, raw: true, draw: () => drawPieceInto(null, P, "eolico", x, y, t + i * 0.7) }));
  }
  // torre corporativa
  if (has(H, "torre")) {
    add(4.6, 1.15, 2.2, 1.7, 6.5, (F) => {
      F.box(4.6, 1.2, 0, 2.2, 1.6, 0.5, "#C3C9CF");
      F.box(4.9, 1.35, 0.5, 1.6, 1.3, 5.2, "#3D6D9A");
      for (let i = 0; i < 17; i++) { F.box(4.9, 2.652, 0.62 + i * 0.3, 1.6, 0.004, 0.18, windowCol(P, false, 200 + i), { em: true, o: 0.01 }); F.box(6.502, 1.4, 0.62 + i * 0.3, 0.004, 1.2, 0.18, windowCol(P, false, 300 + i), { em: true, o: 0.01 }); }
      F.box(4.85, 1.3, 5.7, 1.7, 1.4, 0.18, "#26385E");
      F.fn(6.52, 2.0, 5.2, (S) => { const c = P.ctx; const m = S(6.52, 2.05, 5.25); c.save(); c.translate(m[0], m[1]); c.transform(1, -0.5, 0, 1, 0, 0); c.font = `900 ${Math.max(9, P.tw * 0.55)}px "Bricolage Grotesque", system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#FFC21A"; if (P.night > 0.3) { c.shadowColor = "#FFC21A"; c.shadowBlur = 12; } c.fillText("R", 0, 0); c.restore(); }, { o: 0.3 });
      F.cyl(5.7, 2.0, 5.88, 0.02, 0.9, K.STEEL);
      F.dot(5.7, 2.0, 6.8, 0.04, (REDUCE || Math.sin(t * 2) > 0) ? "#FF4D4D" : "#4A1E1E", { em: true });
    }, { k: "torre" }, true);
  }
  // museo
  if (museumOpen() && has(H, "amp2")) {
    add(7.2, 1.15, 3.2, 1.7, 1.8, (F) => {
      F.box(7.2, 1.2, 0, 3.2, 1.6, 0.12, "#E9E2CF"); F.box(7.3, 1.3, 0.12, 3.0, 1.4, 0.1, "#E9E2CF");
      F.box(7.5, 1.4, 0.22, 2.6, 1.0, 0.9, "#F2ECDD");
      for (let i = 0; i < 6; i++) F.cyl(7.6 + i * 0.48, 2.55, 0.22, 0.07, 0.9, "#F7F2E6", { o: 0.05 });
      F.box(7.4, 1.35, 1.12, 2.8, 1.35, 0.12, "#E9E2CF", { o: 0.06 });
      F.q3([[7.4, 2.7, 1.24], [10.2, 2.7, 1.24], [8.8, 2.7, 1.7]], "#E9E2CF", { o: 0.07 });
      F.text(8.8, 2.706, 1.18, "MUSEO DE LA INGENIERÍA", { size: 0.1, color: "#8C6B2A", o: 0.1, face: "y", weight: 800 });
    }, { k: "museo" });
  }
  return E;
}

// Dibuja una pieza dentro del mundo (en la baldosa x,y)
function drawPieceInto(_F, P, id, x, y, t) { drawPiece(P, PIECE_BY_ID[id], x, y, t, 0, {}); }
// Marco escalado (para meter un modelo en una huella más chica)
function scaled(F, s) {
  const w = (o) => o;
  return {
    ...F,
    box: (x, y, z, ww, d, h, c, o) => F.box(x * s, y * s, z * s, ww * s, d * s, h * s, c, w(o)),
    cyl: (x, y, z, r, h, c, o) => F.cyl(x * s, y * s, z * s, r * s, h * s, c, o),
    cone: (x, y, z, r, h, c, o) => F.cone(x * s, y * s, z * s, r * s, h * s, c, o),
    dome: (x, y, z, r, c, o) => F.dome(x * s, y * s, z * s, r * s, c, o),
    hcyl: (ax, x, y, z, len, r, c, o) => F.hcyl(ax, x * s, y * s, z * s, len * s, r * s, c, o),
    flat: (pts, z, c, o) => F.flat(pts.map(([a, b]) => [a * s, b * s]), z * s, c, o),
    q3: (pts, c, o) => F.q3(pts.map(([a, b, cc]) => [a * s, b * s, cc * s]), c, o),
    l3: (pts, c, ww, o) => F.l3(pts.map(([a, b, cc]) => [a * s, b * s, cc * s]), c, ww * s, o),
    ring: (ax, x, y, z, r, c, ww, sp, rot, o) => F.ring(ax, x * s, y * s, z * s, r * s, c, ww * s, sp, rot, o),
    dot: (x, y, z, r, c, o) => F.dot(x * s, y * s, z * s, r * s, c, o),
    glow: () => {}, text: () => {}, fn: () => {},
  };
}

// ---------------------------------------------------------------- Personajes del grupo
// Cada persona tiene un muñequito con su avatar, en el patio de entrada de su nave.
// mode: "idle" (parado), "sit" (sentado en un banco: nave apagada), "jog" (hizo actividad física hoy)
function character(F, P, f, x, y, t, mode, me) {
  const s = 1.85;
  const sitting = mode === "sit";
  const bob = REDUCE ? 0 : mode === "jog" ? Math.abs(Math.sin(t * 9)) * 0.035 : Math.sin(t * 1.6 + x) * 0.006;
  if (sitting) {
    F.box(x - 0.2, y + 0.06, 0, 0.4, 0.12, 0.12, "#8C6B4A", { o: -0.01 });
    F.box(x - 0.2, y + 0.16, 0.12, 0.4, 0.03, 0.14, "#7A5A44", { o: -0.005 });
  }
  F.fn(x, y, 0, (S) => {
    const c = P.ctx;
    const [gx, gy] = S(x, y, 0);
    const u = P.tw / 64;
    if (me) {
      const pr = REDUCE ? 1 : 1 + Math.sin(t * 3) * 0.12;
      c.save(); c.translate(gx, gy); c.scale(1, 0.5);
      c.beginPath(); c.arc(0, 0, 13 * u * pr, 0, Math.PI * 2);
      c.fillStyle = "rgba(255,194,26,.28)"; c.fill(); c.lineWidth = 2; c.strokeStyle = "#FFC21A"; c.stroke();
      c.restore();
    } else {
      c.save(); c.translate(gx, gy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, 8 * u, 0, Math.PI * 2); c.fillStyle = "rgba(16,28,52,.22)"; c.fill(); c.restore();
    }
    const zz = (z) => S(x, y, z * s + bob)[1];
    const hip = sitting ? 0.13 : 0.15, shoulder = sitting ? 0.3 : 0.32, headZ = sitting ? 0.43 : 0.45;
    c.lineCap = "round";
    // piernas
    c.strokeStyle = P.col("#26324A"); c.lineWidth = Math.max(1.5, 3 * u * s);
    const sw = mode === "jog" && !REDUCE ? Math.sin(t * 9) * 3 * u : 0;
    if (sitting) {
      c.beginPath(); c.moveTo(gx - 2 * u, zz(hip)); c.lineTo(gx - 6 * u, zz(hip) + 2 * u); c.lineTo(gx - 6 * u, gy); c.stroke();
      c.beginPath(); c.moveTo(gx + 2 * u, zz(hip)); c.lineTo(gx + 1 * u, zz(hip) + 3 * u); c.lineTo(gx + 1 * u, gy + 1 * u); c.stroke();
    } else {
      c.beginPath(); c.moveTo(gx - 1.6 * u, zz(hip)); c.lineTo(gx - 1.6 * u + sw, gy - bob * P.zh); c.stroke();
      c.beginPath(); c.moveTo(gx + 1.6 * u, zz(hip)); c.lineTo(gx + 1.6 * u - sw, gy - bob * P.zh); c.stroke();
    }
    // torso con el color de la persona
    c.strokeStyle = P.col(f.col); c.lineWidth = Math.max(3, 7 * u * s);
    c.beginPath(); c.moveTo(gx, zz(hip + 0.02)); c.lineTo(gx, zz(shoulder)); c.stroke();
    // brazos
    c.strokeStyle = P.col(shade(f.col, -0.15)); c.lineWidth = Math.max(1.2, 2.4 * u * s);
    const arm = mode === "jog" && !REDUCE ? Math.cos(t * 9) * 3 * u : 0;
    c.beginPath(); c.moveTo(gx - 3.5 * u * s, zz(shoulder - 0.01)); c.lineTo(gx - 4.5 * u * s + arm, zz(hip + 0.03)); c.stroke();
    c.beginPath(); c.moveTo(gx + 3.5 * u * s, zz(shoulder - 0.01)); c.lineTo(gx + 4.5 * u * s - arm, zz(hip + 0.03)); c.stroke();
    // cabeza: el avatar
    const r = Math.max(6, 8 * u * s);
    const hy = zz(headZ) - r * 0.35;
    c.beginPath(); c.arc(gx, hy, r + 1.6, 0, Math.PI * 2); c.fillStyle = me ? "#FFC21A" : "#FFFFFF"; c.fill();
    const img = avatarImg(f.avatar);
    c.save(); c.beginPath(); c.arc(gx, hy, r, 0, Math.PI * 2); c.clip();
    if (img) { c.fillStyle = f.col; c.fill(); c.drawImage(img, gx - r, hy - r, r * 2, r * 2); }
    else { c.fillStyle = "#E8C1A0"; c.fill(); }
    c.restore();
    c.beginPath(); c.arc(gx, hy, r + 1.6, 0, Math.PI * 2); c.lineWidth = 1; c.strokeStyle = "rgba(16,28,52,.55)"; c.stroke();
    if (P.night > 0.5) { c.beginPath(); c.arc(gx, hy, r, 0, Math.PI * 2); c.fillStyle = `rgba(8,18,40,${(P.night - 0.5) * 0.5})`; c.fill(); }
  }, { o: 0.3 });
}

// ---------------------------------------------------------------- Gente
function person(F, x, y, z, shirt, t, sitting, P, helmet) {
  const bob = REDUCE || sitting ? 0 : Math.abs(Math.sin(t * 8)) * 0.02;
  if (!sitting) { F.l3([[x, y, z], [x, y, z + 0.14]], "#2A2F38", 2.2, { o: 0.001 }); }
  F.l3([[x, y, z + (sitting ? 0.18 : 0.14) + bob], [x, y, z + (sitting ? 0.34 : 0.3) + bob]], shirt, 4, { o: 0.002 });
  F.dot(x, y, z + (sitting ? 0.42 : 0.38) + bob, 0.035, "#E8C1A0", { o: 0.003 });
  if (helmet) F.dot(x, y, z + (sitting ? 0.45 : 0.415) + bob, 0.03, "#FFC21A", { o: 0.004 });
}
const SHIRTS = ["#2F6FDB", "#E5484D", "#1F9D6B", "#F08A24", "#8B5CF6", "#14213D", "#F2F4F6", "#D97706"];
function peopleEntities(H, P, t) {
  const n = Math.min(40, 8 + stageIdx(H) * 2);
  const out = [];
  const [lo, hi] = boundsFor(H);
  for (let i = 0; i < n; i++) {
    const r = rng(500 + i * 31);
    const route = Math.floor(r() * 3);
    let x, y;
    const speed = 0.25 + r() * 0.2, ph = r() * 100;
    const s = REDUCE ? ph : t * speed + ph;
    if (route === 0) { // vereda de la calle vertical
      const L = hi - lo; const k = s % (2 * L); const v = k < L ? k : 2 * L - k;
      x = r() < 0.5 ? 8.82 : 11.18; y = lo + v;
    } else if (route === 1) {
      const L = hi - lo; const k = s % (2 * L); const v = k < L ? k : 2 * L - k;
      y = r() < 0.5 ? 8.82 : 11.18; x = lo + v;
    } else { // alrededor de un lote
      const f = FRIENDS[Math.floor(r() * FRIENDS.length)];
      if (!f || f.closed) continue;
      const [lx, ly] = f.lot; const per = 16; const k = (s * 0.6) % per;
      if (k < 4) { x = lx - 0.15 + k; y = ly + 4.15; } else if (k < 8) { x = lx + 4.15; y = ly + 4.15 - (k - 4); } else if (k < 12) { x = lx + 4.15 - (k - 8); y = ly - 0.15; } else { x = lx - 0.15; y = ly - 0.15 + (k - 12); }
    }
    const shirt = SHIRTS[i % SHIRTS.length], helmet = i % 3 === 0;
    out.push({ x0: x - 0.12, y0: y - 0.12, w: 0.24, d: 0.24, h: 0.5, person: true, dyn: true, info: { k: "persona" }, draw: (F) => person(F, x, y, 0, shirt, t + i, false, P, helmet) });
  }
  // camiones
  if (has(H, "camion")) {
    for (let j = 0; j < 2; j++) {
      const L = hi - lo + 2;
      const v = REDUCE ? 3 + j * 4 : ((t * 0.7 + j * 7) % L) - 1;
      let x, y, k;
      if (j === 0) { x = 9.3; y = lo + v; k = 0; } else { y = 10.7; x = hi - v; k = 1; }
      // desvío por la rotonda
      if (has(H, "tanque")) {
        if (j === 0 && y > 8.7 && y < 11.3) { const a = Math.PI + ((y - 8.7) / 2.6) * Math.PI; x = 10 + Math.cos(a) * 1.25 - 0.05; }
        if (j === 1 && x > 8.7 && x < 11.3) { const a = ((x - 8.7) / 2.6) * Math.PI; y = 10 + Math.sin(a) * 1.25 + 0.05; }
      }
      if (x < lo - 0.3 || x > hi + 0.3 || y < lo - 0.3 || y > hi + 0.3) continue;
      const cab = j ? "#2F6FDB" : "#D94448";
      out.push({ x0: x - 0.2, y0: y - 0.3, w: 0.4, d: 0.6, h: 0.6, dyn: true, info: { k: "camion" }, draw: (F) => {
        if (k === 0) { F.box(x - 0.17, y - 0.42, 0.06, 0.34, 0.58, 0.38, "#E8ECEF"); F.box(x - 0.17, y + 0.18, 0.06, 0.34, 0.22, 0.3, cab); F.box(x - 0.15, y + 0.39, 0.22, 0.3, 0.004, 0.1, "#9EC8E8", { o: 0.01 }); }
        else { F.box(x - 0.18, y - 0.17, 0.06, 0.58, 0.34, 0.38, "#E8ECEF"); F.box(x - 0.42, y - 0.17, 0.06, 0.24, 0.34, 0.3, cab); }
        if (P.night > 0.3) F.glow(k === 0 ? x : x - 0.7, k === 0 ? y + 0.8 : y, 0.15, 0.9, "rgba(255,242,176,ALPHA)", 0.3);
      } });
    }
  }
  return out;
}

// ---------------------------------------------------------------- Partículas
const PARTS = [];
function emit(x, y, z, kind) {
  if (REDUCE || PARTS.length > 260) return;
  const cfg = {
    humo: { r: 0.06, vr: 0.05, vz: 0.45, life: 3, c: [120, 128, 140], a: 0.4 },
    vapor: { r: 0.06, vr: 0.05, vz: 0.55, life: 2.4, c: [240, 244, 248], a: 0.5 },
    nube: { r: 0.14, vr: 0.07, vz: 0.4, life: 4, c: [244, 247, 250], a: 0.5 },
    chimenea: { r: 0.05, vr: 0.045, vz: 0.45, life: 2.6, c: [230, 234, 240], a: 0.45 },
    polvo: { r: 0.18, vr: 0.22, vz: 0.35, life: 2.2, c: [214, 190, 150], a: 0.55 },
  }[kind];
  const spread = kind === "polvo" ? 1 : 0;
  PARTS.push({ x, y, z, r: cfg.r, vr: cfg.vr, vz: cfg.vz, vx: spread ? (Math.random() - 0.5) * 1.2 : 0.12 + Math.random() * 0.06, vy: spread ? (Math.random() - 0.5) * 1.2 : -0.04, life: cfg.life, max: cfg.life, c: cfg.c, a: cfg.a });
}
function stepParticles(dt) {
  for (const p of PARTS) { p.life -= dt; p.z += p.vz * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
  for (let i = PARTS.length - 1; i >= 0; i--) if (PARTS[i].life <= 0) PARTS.splice(i, 1);
}
function drawParticles(P) {
  const c = P.ctx;
  for (const p of PARTS) {
    const [sx, sy] = P.S(p.x, p.y, p.z);
    const k = p.life / p.max;
    let [r, g, b] = p.c;
    if (P.night > 0.3) { r *= 0.55; g *= 0.6; b *= 0.7; }
    c.beginPath(); c.arc(sx, sy, Math.max(1, p.r * P.tw), 0, Math.PI * 2);
    c.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${p.a * Math.min(1, k * 1.5) * Math.min(1, (1 - k) * 6)})`; c.fill();
  }
}
// Fuegos artificiales (etapa final)
const FIREWORKS = [];
function stepFireworks(dt, H) {
  if (REDUCE) { FIREWORKS.length = 0; return; }
  if (has(H, "polo") && Math.random() < dt * 0.9) {
    const x = 4 + Math.random() * 12, y = 4 + Math.random() * 12, z = 5 + Math.random() * 2;
    const col = ["#FFC21A", "#FF5A8A", "#4FC3F7", "#7CFFB2", "#FFFFFF"][Math.floor(Math.random() * 5)];
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, e = Math.random() * 0.5 + 0.6; FIREWORKS.push({ x, y, z, vx: Math.cos(a) * e, vy: -Math.cos(a) * e * 0.2, vz: Math.sin(a) * e, life: 1.4, col }); }
  }
  for (const f of FIREWORKS) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vz -= 0.5 * dt; }
  for (let i = FIREWORKS.length - 1; i >= 0; i--) if (FIREWORKS[i].life <= 0) FIREWORKS.splice(i, 1);
}
function drawFireworks(P) {
  const c = P.ctx;
  for (const f of FIREWORKS) { const [sx, sy] = P.S(f.x, f.y, f.z); c.globalAlpha = Math.max(0, f.life / 1.4); c.fillStyle = f.col; c.beginPath(); c.arc(sx, sy, Math.max(1.2, P.tw * 0.03), 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
}

// ============================================================================
// Render de la escena, cámara (arrastrar, pellizcar, rueda) y selección por toque
// ============================================================================
export function createScene(opts = {}) {
  const compact = !!opts.compact;
  let canvas, ctx, W = 0, H = 0, dpr = 1;
  const cam = { cx: 10, cy: 10, zoom: 1, fitN: 10, userMoved: false, tx: null, ty: null, tz: null };
  let hits = [];
  let lastT = 0, acc = 0, raf = 0, running = false, onSelect = null, timeNow = 0;
  let lastBounds = null;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  // En vertical se deja que el parque desborde un poco a los costados (se puede arrastrar)
  const fitTw = (n) => compact ? Math.min(((W - 8) / n) * 1.05, (H - 24) / (n / 2 + 1.6)) : Math.min(((W - 20) / n) * (W < H ? 1.38 : 1), (H - 150) / (n / 2 + 2.6));
  function view() {
    const tw = fitTw(cam.fitN) * cam.zoom;
    const ox = W / 2 - (cam.cx - cam.cy) * tw / 2;
    const oy = H * (compact ? 0.64 : 0.6) - (cam.cx + cam.cy) * tw / 4;
    return { tw, ox, oy };
  }
  const toWorld = (sx, sy, v = view()) => {
    const u = (sx - v.ox) / (v.tw / 2), w = (sy - v.oy) / (v.tw / 4);
    return [(u + w) / 2, (w - u) / 2];
  };

  // ------------------------------------------------------------ cielo
  function sky(L) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const top = mix(mix("#8FCDF0", "#3D4F91", L.dusk), "#071330", L.night);
    const bot = mix(mix("#E2F1EA", "#F79A5C", L.dusk), "#1B3256", L.night * (1 - L.dusk * 0.5));
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (L.night > 0.4) {
      ctx.fillStyle = `rgba(255,255,255,${(L.night - 0.4) * 1.3})`;
      for (let i = 0; i < 70; i++) { const x = hash2(i, 1) * W, y = hash2(i, 2) * H * 0.5, s = hash2(i, 3) * 1.4 + 0.4; ctx.fillRect(x, y, s, s); }
      ctx.beginPath(); ctx.arc(W * 0.82, H * 0.13, 14, 0, Math.PI * 2); ctx.fillStyle = `rgba(245,240,220,${L.night})`; ctx.fill();
      ctx.beginPath(); ctx.arc(W * 0.82 + 6, H * 0.13 - 3, 12, 0, Math.PI * 2); ctx.fillStyle = mix("#071330", "#1B3256", 0.15); ctx.fill();
    } else {
      const sx = W * 0.14, sy = H * (0.12 + L.dusk * 0.25);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60);
      sg.addColorStop(0, `rgba(255,${L.dusk ? 200 : 246},${L.dusk ? 140 : 210},.95)`); sg.addColorStop(0.25, "rgba(255,240,200,.35)"); sg.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = sg; ctx.fillRect(sx - 60, sy - 60, 120, 120);
      // nubes
      const drift = REDUCE ? 0 : timeNow * 6;
      ctx.fillStyle = `rgba(255,255,255,${0.75 - L.dusk * 0.3})`;
      for (let i = 0; i < 4; i++) {
        const x = ((hash2(i, 9) * W * 1.4 + drift * (0.5 + hash2(i, 4))) % (W + 200)) - 100, y = 20 + hash2(i, 5) * H * 0.22, s = 0.6 + hash2(i, 6);
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + k * 16 * s, y + (k % 2) * 4, 18 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }

  // ------------------------------------------------------------ suelo
  function ground(P, Hh, L) {
    const [lo, hi] = boundsFor(Hh);
    const roads = has(Hh, "calles");
    const nb = boundsFor(nextStageHours(Hh) ?? Hh);
    // anillo futuro (vista previa)
    if (nb[0] < lo) {
      for (let y = nb[0]; y < nb[1]; y++) for (let x = nb[0]; x < nb[1]; x++) {
        if (x >= lo && x < hi && y >= lo && y < hi) continue;
        P.tile(x, y, 1, 1, (x + y) % 2 ? "#C7D4BC" : "#CBD8C0");
      }
      const c = P.ctx; c.save(); c.setLineDash([5, 5]); c.strokeStyle = L.night > 0.4 ? "rgba(220,230,243,.35)" : "rgba(20,33,61,.35)"; c.lineWidth = 1.2;
      c.beginPath(); [[nb[0], nb[0]], [nb[1], nb[0]], [nb[1], nb[1]], [nb[0], nb[1]]].forEach(([x, y], i) => { const [a, b] = P.S(x, y); i ? c.lineTo(a, b) : c.moveTo(a, b); }); c.closePath(); c.stroke(); c.restore();
    }
    for (let y = lo; y < hi; y++) for (let x = lo; x < hi; x++) {
      const lot = FRIENDS.find((f) => x >= f.lot[0] && x < f.lot[0] + 4 && y >= f.lot[1] && y < f.lot[1] + 4);
      const road = (x >= 9 && x < 11) || (y >= 9 && y < 11);
      let col;
      if (lot) col = mix("#D6DCE2", "#C9D0D7", hash2(x, y) * 0.8);
      else if (road) col = roads ? mix("#56606C", "#4C5561", hash2(x, y)) : mix("#CDB892", "#C4AE86", hash2(x, y));
      else col = mix("#A8CF8C", "#93C177", hash2(x, y, 7));
      P.tile(x, y, 1, 1, col);
      if (lot && hash2(x, y, 3) > 0.7) P.tile(x + 0.2, y + 0.3, 0.3, 0.2, "#C3CAD1");
      if (!lot && !road && hash2(x, y, 5) > 0.75) { P.tile(x + hash2(x, y, 6) * 0.6, y + hash2(x, y, 8) * 0.6, 0.18, 0.14, "#7FB466"); }
    }
    // juntas de hormigón en los lotes
    const c = P.ctx;
    c.strokeStyle = L.night > 0.4 ? "rgba(255,255,255,.05)" : "rgba(20,33,61,.08)"; c.lineWidth = 1;
    for (const f of FRIENDS) {
      const [lx, ly] = f.lot;
      for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(...P.S(lx + i, ly)); c.lineTo(...P.S(lx + i, ly + 4)); c.moveTo(...P.S(lx, ly + i)); c.lineTo(...P.S(lx + 4, ly + i)); c.stroke(); }
    }
    if (roads) {
      // veredas
      for (const [x0, x1] of [[8.82, 9], [11, 11.18]]) P.flat([[x0, lo], [x1, lo], [x1, hi], [x0, hi]], 0.004, "#C9CED4", { stroke: false });
      for (const [y0, y1] of [[8.82, 9], [11, 11.18]]) P.flat([[lo, y0], [hi, y0], [hi, y1], [lo, y1]], 0.004, "#C9CED4", { stroke: false });
      // líneas de carril
      c.save(); c.setLineDash([P.tw * 0.22, P.tw * 0.22]); c.strokeStyle = L.night > 0.4 ? "rgba(255,226,140,.55)" : "rgba(255,226,140,.95)"; c.lineWidth = Math.max(1, P.tw / 34);
      c.beginPath(); c.moveTo(...P.S(10, lo, 0.005)); c.lineTo(...P.S(10, hi, 0.005)); c.moveTo(...P.S(lo, 10, 0.005)); c.lineTo(...P.S(hi, 10, 0.005)); c.stroke(); c.restore();
      // sendas peatonales
      for (const [ax, ay, dir] of [[9, 8.4, 0], [9, 11.25, 0], [8.4, 9, 1], [11.25, 9, 1]]) {
        for (let i = 0; i < 6; i++) {
          if (dir === 0) P.flat([[ax + 0.1 + i * 0.32, ay], [ax + 0.26 + i * 0.32, ay], [ax + 0.26 + i * 0.32, ay + 0.34], [ax + 0.1 + i * 0.32, ay + 0.34]], 0.006, "#E8ECEF", { stroke: false });
          else P.flat([[ax, ay + 0.1 + i * 0.32], [ax + 0.34, ay + 0.1 + i * 0.32], [ax + 0.34, ay + 0.26 + i * 0.32], [ax, ay + 0.26 + i * 0.32]], 0.006, "#E8ECEF", { stroke: false });
        }
      }
    }
    // espesor del terreno
    const th = P.tw * 0.22;
    const side = (a, b, col) => { c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(b[0], b[1] + th); c.lineTo(a[0], a[1] + th); c.closePath(); c.fillStyle = col; c.fill(); };
    side(P.S(hi, lo), P.S(hi, hi), P.col("#7E5F42")); side(P.S(lo, hi), P.S(hi, hi), P.col("#9C7651"));
    c.strokeStyle = "rgba(20,33,61,.35)"; c.lineWidth = 1; c.beginPath(); c.moveTo(...P.S(lo, hi)); c.lineTo(...P.S(hi, hi)); c.lineTo(...P.S(hi, lo)); c.stroke();
  }
  function nextStageHours(h) { const n = STAGES.find((s) => s.h > h); return n ? n.h : null; }

  // ------------------------------------------------------------ entidades
  const slotsFor = (form) => {
    const base = [[2, 0], [3, 0], [2, 1], [3, 1], [2, 2], [0, 3], [3, 2], [1, 3], [2, 3], [3, 3]];
    if (form === 0) return [...base, [0, 2], [1, 2]];
    if (form >= 4) return base.slice(0, 8);
    return base;
  };
  function rotLocal(u, v, k) { switch (k & 3) { case 1: return [1 - v, u]; case 2: return [1 - u, 1 - v]; case 3: return [v, 1 - u]; default: return [u, v]; } }

  function buildEntities(P, t, dt) {
    const Hh = GH();
    const E = [];
    for (const f of FRIENDS) {
      const lvl = levelOf(friendHours(f)), form = formOf(lvl), closed = !!f.closed;
      const [lx, ly] = f.lot;
      const fd = form >= 4 ? 4 : form === 0 ? 2 : 3;
      const topZ = [1.1, 1.35, 1.45, 1.9, 2.4, 4.7][form];
      const live = !!f.live && !closed;
      E.push({ id: `nave:${f.id}:${form}:${closed}`, anim: form >= 5 && !closed, x0: lx, y0: ly, w: 2, d: fd, h: topZ, raw: true, info: { k: "nave", f }, draw: () => drawNave(P, f, form, closed, t), label: { f, z: topZ, lvl, closed } });
      if (!closed && dt > 0) {
        const chim = form === 0 ? null : form === 1 ? [lx + 0.4, ly + 0.5, 1.7] : [lx + 0.35, ly + 0.4, 2.35];
        if (chim && Math.random() < dt * (live ? 6 : 2.2)) emit(chim[0], chim[1], chim[2], live ? "vapor" : "chimenea");
      }
      // Personaje: adentro de la nave si está estudiando, si no en el patio de entrada
      const me = f.id === STATE.meId;
      if (live) {
        const bx = lx + 1, by = ly + 1.4, bz = topZ + 0.12;
        E.push({ x0: bx - 0.1, y0: by - 0.1, w: 0.2, d: 0.2, h: bz + 0.2, dyn: true, info: { k: "nave", f }, draw: (F) => {
          const on = REDUCE || Math.sin(t * 5) > -0.2;
          F.cyl(bx, by, bz - 0.12, 0.05, 0.12, K.DARK);
          F.dot(bx, by, bz + 0.04, 0.05, on ? "#FFC21A" : "#7A5A10", { em: true, raw: true });
          F.glow(bx, by, bz + 0.04, 0.9, "rgba(255,194,26,ALPHA)", on ? 0.45 : 0.15);
        } });
      } else {
        let mode = closed ? "sit" : f.active ? "jog" : "idle";
        // En la vereda frente a su lote: adelante no hay nada que lo tape
        let cx = lx + 4.25, cy = ly + 1.6;
        if (mode === "jog") {
          const per = 15.2, k = REDUCE ? 2 : (t * 0.45 + FRIENDS.indexOf(f) * 3.1) % per;
          const a = lx - 0.2, b = lx + 4.2, c2 = ly - 0.2, d = ly + 4.2;
          if (k < 3.8) { cx = a + k * ((b - a) / 3.8); cy = d; } else if (k < 7.6) { cx = b; cy = d - (k - 3.8) * ((d - c2) / 3.8); }
          else if (k < 11.4) { cx = b - (k - 7.6) * ((b - a) / 3.8); cy = c2; } else { cx = a; cy = c2 + (k - 11.4) * ((d - c2) / 3.8); }
        }
        E.push({ x0: cx - 0.15, y0: cy - 0.15, w: 0.3, d: 0.3, h: 0.9, depth: cx + cy + 0.2, dyn: true, person: true, info: { k: "nave", f }, draw: (F) => character(F, P, f, cx, cy, t, mode, me) });
      }
      const show = showcase(f, slotsFor(form).length);
      show.forEach(({ p, n }, i) => {
        const [sx, sy] = slotsFor(form)[i];
        const k = Math.floor(hash2(lx + sx, ly + sy, FRIENDS.indexOf(f)) * 4);
        const gx = lx + sx, gy = ly + sy;
        E.push({ id: `p:${gx},${gy}:${p.id}:${starsOf(n)}:${k}:${closed}`, anim: !closed && !p.still, x0: gx, y0: gy, w: 1, d: 1, h: p.h || 0.8, raw: true, info: { k: "pieza", f, p, n }, draw: () => drawPiece(P, p, gx, gy, closed ? 0 : t, k, { star: starsOf(n), park: true }) });
        if (p.smoke && !closed && dt > 0) for (const [u, v, z, kind] of p.smoke) { if (Math.random() < dt * (kind === "nube" ? 1.4 : 1.8)) { const [a, b] = rotLocal(u, v, k); emit(gx + a, gy + b, z, kind); } }
      });
      if (f.flag && !closed) {
        E.push({ id: "flag", anim: true, x0: lx + 0.1, y0: ly + 3.6, w: 0.2, d: 0.2, h: 1.6, info: { k: "racha", f }, draw: (F) => {
          F.box(lx + 0.15, ly + 3.65, 0, 0.04, 0.04, 1.5, K.STEEL);
          F.fn(lx + 0.17, ly + 3.67, 1.4, (S) => {
            const c = P.ctx, w = REDUCE ? 0 : Math.sin(t * 4) * 0.05;
            const a = S(lx + 0.17, ly + 3.67, 1.48), b = S(lx + 0.17 + 0.45, ly + 3.67, 1.38 + w), d = S(lx + 0.17, ly + 3.67, 1.26);
            c.beginPath(); c.moveTo(...a); c.quadraticCurveTo(b[0] - 4, b[1] - 6 + w * 30, ...b); c.lineTo(...d); c.closePath(); c.fillStyle = "#F08A24"; c.fill();
          }, { o: 0.1 });
        } });
      }
      if (closed) {
        const roll = REDUCE ? 0.5 : ((t * 0.12) % 1);
        const x = lx + 0.3 + roll * 3.4, y = ly + 3.55;
        E.push({ x0: x - 0.1, y0: y - 0.1, w: 0.2, d: 0.2, h: 0.2, dyn: true, info: { k: "cerrado", f }, draw: (F) => F.fn(x, y, 0.1, (S) => {
          const c = P.ctx; const [sx, sy] = S(x, y, 0.1); const r = Math.max(3, P.tw * 0.08);
          c.save(); c.translate(sx, sy); c.rotate(roll * 18); c.strokeStyle = P.col("#A0835C"); c.lineWidth = 1;
          for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(0, 0, r * (0.4 + (i % 3) * 0.25), i, i + 4); c.stroke(); }
          c.restore();
        }) });
      }
    }
    E.push(...infraEntities(Hh, P, t));
    E.push(...peopleEntities(Hh, P, t));
    if (has(Hh, "polo")) {
      const a = REDUCE ? 1 : t * 0.08;
      const bx = 10 + Math.cos(a) * 9, by = 10 + Math.sin(a) * 9;
      E.push({ x0: bx, y0: by, w: 0.1, d: 0.1, h: 0.1, depth: 999, dyn: true, info: { k: "polo" }, draw: (F) => F.fn(bx, by, 9, (S) => {
        const c = P.ctx; const [sx, sy] = S(bx, by, 9); const L = P.tw * 1.6, R = P.tw * 0.42;
        c.save(); c.translate(sx, sy); c.rotate(-0.25 + Math.sin(a) * 0.15);
        const g = c.createLinearGradient(0, -R, 0, R); g.addColorStop(0, P.col("#F2F4F6")); g.addColorStop(1, P.col("#AEB8C3"));
        c.beginPath(); c.ellipse(0, 0, L, R, 0, 0, Math.PI * 2); c.fillStyle = g; c.fill(); c.strokeStyle = "rgba(20,33,61,.5)"; c.lineWidth = 1; c.stroke();
        c.beginPath(); c.moveTo(-L * 0.85, 0); c.lineTo(-L * 1.15, -R * 0.9); c.lineTo(-L * 1.05, 0); c.lineTo(-L * 1.15, R * 0.9); c.closePath(); c.fillStyle = P.col("#D94448"); c.fill();
        c.fillStyle = P.col("#26385E"); c.fillRect(-L * 0.2, R * 0.8, L * 0.4, R * 0.4);
        c.font = `900 ${Math.max(8, R * 0.75)}px "Bricolage Grotesque", system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#14213D"; c.fillText("REMONTADA", 0, 0);
        c.restore();
      }) });
    }
    // cartel de próxima ampliación
    const nh = nextStageHours(Hh);
    if (nh != null) {
      const nb = boundsFor(nh), [lo] = boundsFor(Hh);
      if (nb[0] < lo) {
        const x = 9.5, y = nb[0] + 0.6;
        E.push({ id: "prox", x0: x, y0: y, w: 1, d: 0.2, h: 1, info: { k: "proxima" }, draw: (F) => {
          F.box(x + 0.1, y, 0, 0.05, 0.05, 0.7, K.WOOD2); F.box(x + 0.9, y, 0, 0.05, 0.05, 0.7, K.WOOD2);
          F.box(x, y + 0.04, 0.5, 1.05, 0.03, 0.4, K.Y, { o: 0.1 });
          F.text(x + 0.52, y + 0.08, 0.7, `AMPLIACIÓN: ${nb[1] - nb[0]} × ${nb[1] - nb[0]}`, { size: 0.1, color: "#14213D", o: 0.2 });
        } });
      }
    }
    return E;
  }

  function shadows(P, E, L) {
    if (L.night > 0.75) return;
    const c = P.ctx; const a = 0.14 * (1 - L.night);
    c.fillStyle = `rgba(16,28,52,${a})`;
    for (const e of E) {
      if (e.person || e.h < 0.2 || e.depth) continue;
      const sx = 0.55, sy = -0.2, h = Math.min(e.h, 4.5);
      const pts = [[e.x0, e.y0], [e.x0 + e.w, e.y0], [e.x0 + e.w, e.y0 + e.d], [e.x0, e.y0 + e.d]];
      const all = pts.flatMap(([x, y]) => [P.S(x, y), P.S(x + sx * h, y + sy * h)]);
      const hl = hull(all);
      c.beginPath(); hl.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
    }
  }

  function deliveries(P) {
    const c = P.ctx, now = performance.now();
    STATE.deliveries = STATE.deliveries.filter((d) => now - d.t0 < 4800);
    for (const d of STATE.deliveries) {
      const k = (now - d.t0) / 4800;
      const [lx, ly] = d.f.lot;
      const [sx, sy] = P.S(lx + 1, ly + 1.5, 2.2 + k * 1.6);
      c.save();
      c.globalAlpha = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1;
      c.font = `700 13px "IBM Plex Sans", system-ui, sans-serif`;
      const tw = c.measureText(d.text).width, w = tw + 26, h = 28;
      c.translate(sx, sy); const sc = 0.9 + Math.min(1, k * 6) * 0.15; c.scale(sc, sc);
      c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 10); c.fillStyle = "#14213D"; c.fill(); c.lineWidth = 2; c.strokeStyle = d.color; c.stroke();
      c.fillStyle = d.color; c.beginPath(); c.arc(-w / 2 + 12, 0, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#FFFFFF"; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(d.text, -w / 2 + 20, 0.5);
      c.restore();
    }
  }

  function labels(P, E, L) {
    const c = P.ctx;
    const lead = leader();
    const sc = compact ? 0.62 : Math.max(0.72, Math.min(1.05, P.tw / 46));
    for (const e of E) {
      if (!e.label) continue;
      c.save();
      const { f, z, lvl, closed } = e.label;
      const [x0s, y0s] = P.S(f.lot[0] + 1, f.lot[1] + 1.4, z + 0.55);
      c.translate(x0s, y0s); c.scale(sc, sc);
      const x = 0, y = 0;
      const night = L.night > 0.45;
      const live = f.live && !closed ? f.live : null;
      const txt = closed ? `${f.n} · apagada` : `${f.n}`;
      c.font = `700 ${12}px "IBM Plex Sans", system-ui, sans-serif`;
      const tw = c.measureText(txt).width;
      const lvlTxt = `Nv ${lvl}`;
      c.font = `800 11px "Bricolage Grotesque", system-ui, sans-serif`;
      const lw = c.measureText(lvlTxt).width + 10;
      let liveTxt = "";
      if (live) {
        const m = Math.max(0, Math.floor((Date.now() - live.startedAt) / 60000));
        liveTxt = `${live.subject.length > 22 ? live.subject.slice(0, 21) + "…" : live.subject} · ${m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"}`;
      }
      c.font = `600 11px "IBM Plex Sans", system-ui, sans-serif`;
      const ltw = live ? c.measureText(liveTxt).width + 30 : 0;
      const w = Math.max(tw + lw + 24, ltw), h = live ? 42 : 24;
      const x0 = x - w / 2, y0 = y - h;
      c.fillStyle = closed ? (night ? "#2A3346" : "#E3E9EF") : night ? "#15335C" : "#FFFFFF";
      c.strokeStyle = night ? "#DCE6F3" : "#14213D"; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect(x0, y0, w, h, 8); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x - 5, y0 + h); c.lineTo(x, y0 + h + 6); c.lineTo(x + 5, y0 + h); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = c.fillStyle; c.beginPath(); c.fillRect(x - 4.5, y0 + h - 1.6, 9, 2.4);
      const r1 = y0 + 12;
      c.beginPath(); c.arc(x0 + 11, r1, 5, 0, Math.PI * 2); c.fillStyle = closed ? "#9AA2AC" : f.col; c.fill(); c.strokeStyle = "#14213D"; c.lineWidth = 1; c.stroke();
      c.font = `700 12px "IBM Plex Sans", system-ui, sans-serif`; c.textAlign = "left"; c.textBaseline = "middle";
      c.fillStyle = night ? "#F1F5FA" : "#14213D"; c.fillText(txt, x0 + 20, r1 + 0.5);
      c.beginPath(); c.roundRect(x0 + 20 + tw + 4, y0 + 4, lw, 16, 6); c.fillStyle = closed ? "#9AA2AC" : "#FFC21A"; c.fill();
      c.font = `800 11px "Bricolage Grotesque", system-ui, sans-serif`; c.fillStyle = "#14213D"; c.textAlign = "center"; c.fillText(lvlTxt, x0 + 20 + tw + 4 + lw / 2, r1 + 0.5);
      if (live) {
        const r2 = y0 + 31, blink = REDUCE || Math.sin(performance.now() / 300) > -0.3;
        c.beginPath(); c.roundRect(x0 + 4, y0 + 22, w - 8, 17, 6); c.fillStyle = night ? "#0A1A36" : "#14213D"; c.fill();
        c.beginPath(); c.arc(x0 + 13, r2, 3.5, 0, Math.PI * 2); c.fillStyle = blink ? "#FF4D4D" : "#7A2626"; c.fill();
        c.font = `600 11px "IBM Plex Sans", system-ui, sans-serif`; c.textAlign = "left"; c.fillStyle = "#FFC21A"; c.fillText(liveTxt, x0 + 22, r2 + 0.5);
      }
      if (f === lead && !closed) {
        const cx = x0 + w - 2, cy = y0 - 2;
        c.save(); c.translate(cx, cy); c.rotate(0.3);
        c.beginPath(); c.moveTo(-9, 4); c.lineTo(-9, -5); c.lineTo(-4.5, -1); c.lineTo(0, -8); c.lineTo(4.5, -1); c.lineTo(9, -5); c.lineTo(9, 4); c.closePath();
        c.fillStyle = "#FFC21A"; c.fill(); c.strokeStyle = "#14213D"; c.lineWidth = 1.2; c.stroke(); c.restore();
      }
      if (f.id === STATE.meId && !(STATE.selected?.k === "nave" && STATE.selected.f?.id === f.id)) { c.strokeStyle = "#FFC21A"; c.lineWidth = 2.5; c.beginPath(); c.roundRect(x0 - 2, y0 - 2, w + 4, h + 4, 9); c.stroke(); }
      if (STATE.selected?.k === "nave" && STATE.selected.f?.id === f.id) { c.strokeStyle = "#FFC21A"; c.lineWidth = 3; c.beginPath(); c.roundRect(x0 - 3, y0 - 3, w + 6, h + 6, 10); c.stroke(); }
      c.restore();
    }
  }

  function selectionRing(P, t) {
    const s = STATE.selected; if (!s || !s.e) return;
    const e = s.e; const c = P.ctx;
    c.save(); c.setLineDash([6, 4]); c.lineDashOffset = REDUCE ? 0 : -t * 20; c.strokeStyle = "#FFC21A"; c.lineWidth = 2.5;
    c.beginPath(); [[e.x0, e.y0], [e.x0 + e.w, e.y0], [e.x0 + e.w, e.y0 + e.d], [e.x0, e.y0 + e.d]].forEach(([x, y], i) => { const [a, b] = P.S(x, y, 0.01); i ? c.lineTo(a, b) : c.moveTo(a, b); }); c.closePath(); c.stroke(); c.restore();
  }

  // ---------------------------------------------------------- render con sprites
  // Cada entidad quieta se guarda como imagen propia (sprite) y se reutiliza mientras no cambien
  // el zoom, la luz o el estado; las animadas se refrescan a SPRITE_FPS; lo que se mueve se dibuja directo.
  // Todo se compone en orden de profundidad, así la oclusión es correcta.
  const SPRITE_FPS = 8;
  const sprites = new Map();
  let spriteEnv = "", lastTw = 0, twStableSince = 0;
  function bboxOf(P, e) {
    const pts = [[e.x0, e.y0, 0], [e.x0 + e.w, e.y0, 0], [e.x0 + e.w, e.y0 + e.d, 0], [e.x0, e.y0 + e.d, 0], [e.x0, e.y0, e.h], [e.x0 + e.w, e.y0 + e.d, e.h], [e.x0 + e.w, e.y0, e.h], [e.x0, e.y0 + e.d, e.h]].map(([x, y, z]) => P.S(x, y, z));
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
    return [a, b, c, d];
  }
  const keyOf = (e) => e.depth ?? (e.x0 + e.w / 2 + e.y0 + e.d / 2) + (e.person ? 0.05 : 0);

  function drawEntity(e, P, F0) { if (e.raw) e.draw(); else { e.draw(F0); F0.flush(); } }

  function render(t, dt) {
    const L = lightNow();
    const [lo, hi] = boundsFor(GH());
    const n = hi - lo;
    const bkey = lo + ":" + hi;
    if (bkey !== lastBounds) { lastBounds = bkey; if (!cam.userMoved) { cam.tx = (lo + hi) / 2; cam.ty = (lo + hi) / 2; cam.tz = 1; } }
    cam.fitN += (n + 0.5 - cam.fitN) * (REDUCE ? 1 : Math.min(1, dt * 3));
    if (Math.abs(cam.fitN - (n + 0.5)) < 0.02) cam.fitN = n + 0.5;
    if (cam.tx != null) {
      const k = REDUCE ? 1 : Math.min(1, dt * 3);
      cam.cx += (cam.tx - cam.cx) * k; cam.cy += (cam.ty - cam.cy) * k; cam.zoom += (cam.tz - cam.zoom) * k;
      if (Math.abs(cam.tx - cam.cx) < 0.01 && Math.abs(cam.ty - cam.cy) < 0.01 && Math.abs(cam.tz - cam.zoom) < 0.004) { cam.cx = cam.tx; cam.cy = cam.ty; cam.zoom = cam.tz; cam.tx = cam.ty = cam.tz = null; }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sky(L);
    const v = view();
    const P = makePainter(ctx, { ox: v.ox, oy: v.oy, tw: v.tw, night: L.night, dusk: L.dusk });
    ground(P, GH(), L);
    const E = buildEntities(P, t, dt);
    shadows(P, E.filter((e) => !e.dyn), L);
    selectionRing(P, t);
    for (let i = 0; i < E.length; i++) { E[i].key = keyOf(E[i]); E[i].i = i; }
    E.sort((a, b) => a.key - b.key || a.i - b.i);

    // ¿sprites válidos? (dependen del tamaño de baldosa, la luz y el estado; no de dónde está la cámara)
    const twq = Math.round(v.tw * 100);
    if (twq !== lastTw) { lastTw = twq; twStableSince = t; }
    const zooming = REDUCE ? false : t - twStableSince < 0.25;
    const env = [twq, dpr, Math.round(L.night * 20), Math.round(L.dusk * 20)].join("|");
    if (env !== spriteEnv) { sprites.clear(); spriteEnv = env; }
    const bucket = REDUCE ? 0 : Math.floor(t * SPRITE_FPS);
    const [ax, ay] = P.S(0, 0, 0);

    const F0 = makeFrame(P, 0, 0, 1, 1, 0); F0.ctx = ctx; F0.P = P;
    hits = [];
    const seen = new Set();
    for (const e of E) {
      const B = bboxOf(P, e);
      const visible = !(B[2] < -40 || B[0] > W + 40 || B[3] < -60 || B[1] > H + 40);
      if (e.info && visible) hits.push({ e, info: e.info, box: B });
      if (!visible) continue;
      if (e.dyn || zooming || !e.id) { drawEntity(e, P, F0); continue; }
      seen.add(e.id);
      let sp = sprites.get(e.id);
      if (!sp || (e.anim && sp.bucket !== bucket)) {
        // margen generoso para brillos, humo de modelos y textos
        const pad = Math.ceil(v.tw * Math.max(0.3, e.info?.p?.glowPad || 0));
        const bx = Math.floor(B[0] - pad), by = Math.floor(B[1] - pad * 1.5), bw = Math.ceil(B[2] - B[0] + pad * 2), bh = Math.ceil(B[3] - B[1] + pad * 2.5);
        if (!sp || sp.w !== bw || sp.h !== bh) {
          const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(bw * dpr)); c.height = Math.max(1, Math.ceil(bh * dpr));
          sp = { c, x: c.getContext("2d"), w: bw, h: bh };
          sprites.set(e.id, sp);
        }
        sp.dx = bx - ax; sp.dy = by - ay; sp.bucket = bucket;
        const sc = sp.x; sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, sp.c.width, sp.c.height);
        sc.setTransform(dpr, 0, 0, dpr, -bx * dpr, -by * dpr);
        P.setCtx(sc); F0.ctx = sc;
        drawEntity(e, P, F0);
        P.setCtx(ctx); F0.ctx = ctx;
      }
      ctx.drawImage(sp.c, ax + sp.dx, ay + sp.dy, sp.w, sp.h);
    }
    // sprites que ya no existen
    if (sprites.size > seen.size + 40) for (const k of [...sprites.keys()]) if (!seen.has(k)) sprites.delete(k);

    if (dt > 0) { stepParticles(dt); stepFireworks(dt, GH()); }
    drawParticles(P); drawFireworks(P);
    labels(P, E, L);
    deliveries(P);
    if (L.night > 0) { ctx.fillStyle = `rgba(8,18,40,${L.night * 0.08})`; ctx.fillRect(0, 0, W, H); }
  }

  // Cuadros por segundo adaptativos: si el celular tarda en dibujar, se dibuja menos seguido.
  let avgCost = 8, onScreen = true, drawnOnce = false, manualHidden = false;
  function loop(ms) {
    const t = ms / 1000;
    const dt = lastT ? Math.min(0.1, t - lastT) : 0;
    lastT = t; acc += dt;
    const interval = Math.max(1 / 30, Math.min(1 / 12, (avgCost * 2.2) / 1000));
    if (((onScreen && !manualHidden) || !drawnOnce) && (acc >= interval || REDUCE || !drawnOnce)) {
      drawnOnce = true;
      timeNow = t;
      const c0 = performance.now();
      render(t, Math.min(acc, 0.2)); acc = 0;
      avgCost = avgCost * 0.9 + (performance.now() - c0) * 0.1;
    }
    if (running && !REDUCE) raf = requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ entrada
  const pointers = new Map();
  let drag = null, pinch = null, moved = false;
  function onDown(e) {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    moved = false;
    if (pointers.size === 1) drag = { x: e.offsetX, y: e.offsetY, cx: cam.cx, cy: cam.cy };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.zoom }; drag = null; }
  }
  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      cam.zoom = Math.max(0.55, Math.min(3.5, pinch.z * d / pinch.d)); cam.userMoved = true; cam.tx = cam.ty = cam.tz = null; moved = true;
      if (REDUCE) render(timeNow, 0);
      return;
    }
    if (drag) {
      const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (!moved) return;
      const v = view();
      const du = dx / (v.tw / 2), dw = dy / (v.tw / 4);
      cam.cx = clamp(drag.cx - (du + dw) / 2); cam.cy = clamp(drag.cy - (dw - du) / 2);
      cam.userMoved = true; cam.tx = cam.ty = cam.tz = null;
      if (REDUCE) render(timeNow, 0);
    }
  }
  const clamp = (v) => Math.max(-2, Math.min(22, v));
  function onUp(e) {
    const wasMoved = moved;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
    if (!wasMoved && e.type === "pointerup") pick(e.offsetX, e.offsetY);
  }
  function onWheel(e) {
    e.preventDefault();
    const before = toWorld(e.offsetX, e.offsetY);
    cam.zoom = Math.max(0.55, Math.min(3.5, cam.zoom * Math.exp(-e.deltaY * 0.0015)));
    const after = toWorld(e.offsetX, e.offsetY);
    cam.cx = clamp(cam.cx + before[0] - after[0]); cam.cy = clamp(cam.cy + before[1] - after[1]);
    cam.userMoved = true; cam.tx = cam.ty = cam.tz = null;
    if (REDUCE) render(timeNow, 0);
  }
  function pick(x, y) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i], [a, b, c2, d] = h.box;
      if (x >= a && x <= c2 && y >= b && y <= d) { STATE.selected = { ...h.info, e: h.e }; onSelect?.(STATE.selected); if (REDUCE) render(timeNow, 0); return; }
    }
    STATE.selected = null; onSelect?.(null); if (REDUCE) render(timeNow, 0);
  }

  let cleanup = null;
  const api = {
    init(cv, selectCb) {
      canvas = cv; ctx = cv.getContext("2d"); onSelect = selectCb;
      resize();
      const ro = new ResizeObserver(() => { resize(); if (REDUCE) render(timeNow, 0); });
      ro.observe(cv);
      const onVis = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else api.start(); };
      document.addEventListener("visibilitychange", onVis);
      let io = null;
      if ("IntersectionObserver" in window) { io = new IntersectionObserver((en) => { onScreen = en[0].isIntersecting; }); io.observe(cv); }
      if (!compact) {
        cv.addEventListener("pointerdown", onDown);
        cv.addEventListener("pointermove", onMove);
        cv.addEventListener("pointerup", onUp);
        cv.addEventListener("pointercancel", onUp);
        cv.addEventListener("wheel", onWheel, { passive: false });
      }
      cleanup = () => {
        running = false; cancelAnimationFrame(raf); ro.disconnect(); io?.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove);
        cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onUp); cv.removeEventListener("wheel", onWheel);
        sprites.clear();
      };
    },
    destroy() { cleanup?.(); },
    /** Pausar cuando algo tapa el parque (por ejemplo, el panel del inicio). */
    setVisible(v) { manualHidden = !v; },
    start() { running = true; lastT = 0; cancelAnimationFrame(raf); if (REDUCE) render(0, 0); else raf = requestAnimationFrame(loop); },
    redraw() { if (REDUCE) render(timeNow, 0); },
    zoomBy(f) { cam.tz = Math.max(0.55, Math.min(3.5, (cam.tz ?? cam.zoom) * f)); cam.tx = cam.tx ?? cam.cx; cam.ty = cam.ty ?? cam.cy; cam.userMoved = true; if (REDUCE) { cam.zoom = cam.tz; render(timeNow, 0); } },
    recenter() { const [lo, hi] = boundsFor(GH()); cam.tx = (lo + hi) / 2; cam.ty = (lo + hi) / 2; cam.tz = 1; cam.userMoved = false; if (REDUCE) { cam.cx = cam.tx; cam.cy = cam.ty; cam.zoom = 1; render(timeNow, 0); } },
    focus(x, y, z = 1.8) { cam.tx = x; cam.ty = y; cam.tz = z; cam.userMoved = true; if (REDUCE) { cam.cx = x; cam.cy = y; cam.zoom = z; render(timeNow, 0); } },
    get cam() { return cam; },
    bench(n = 20) { const t0 = performance.now(); for (let i = 0; i < n; i++) render(timeNow + i / 30, 1 / 30); return (performance.now() - t0) / n; },
  };
  return api;
}

// ---------------------------------------------------------------- Exportaciones para la interfaz
export { LEVELS, NAVE_FORMS, STAGES, levelOf, formOf, stageIdx, boundsFor, drawNave, setsDone, starsOf };
/** Punto del mapa donde mirar cada etapa: [x, y, zoom] */
export const STAGE_FOCUS = {
  base: [10, 10, 1], cerco: [11.4, 5.2, 2.2], calles: [10, 10, 1.4], camion: [9.4, 7.5, 2.2], tanque: [10, 10, 2.3], amp1: [10, 10, 1],
  subestacion: [6.8, 4, 2.2], deposito: [4, 7, 2.1], comedor: [16, 7, 2.1], tren: [8, 16, 1.6], amp2: [13.5, 2, 1.9], contenedores: [9, 18, 1.6],
  lab: [18, 13, 1.8], solar: [2, 10, 1.5], amp3: [10, 10, 0.95], torre: [5.7, 2, 1.4], polo: [10, 10, 0.95], museo: [8.8, 2, 2],
};
export { emit as emitParticles };
