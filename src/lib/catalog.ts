// Catálogo de piezas: 36 máquinas en 6 categorías más la chatarra. Cada sesión terminada
// sortea una pieza: la duración define la categoría, la rareza sale al azar y la materia
// inclina el sorteo hacia máquinas de su área.
import { PIECE_BY_ID, PIECES as ISO_PIECES, RARITY as ISO_RARITY, SETS as ISO_SETS, TIERS as ISO_TIERS, type IsoPieceDef } from "../iso/iso";
import { AREA_LABEL, areaOf, type Area } from "./areas";
import type { GroupData, PieceKey } from "./types";

export type PieceDef = IsoPieceDef;
export type Rarity = "comun" | "rara" | "epica" | "legendaria";

/** Las piezas de antes del catálogo usaban otras claves; esto las traduce. */
const LEGACY: Record<string, string> = { tornillo: "bulones" };

export const CATALOG: PieceDef[] = ISO_PIECES.filter((p) => p.id !== "chatarra");
export const ALL_PIECES: PieceDef[] = ISO_PIECES;

export function pieceDef(id: PieceKey): PieceDef {
  return PIECE_BY_ID[LEGACY[id] ?? id] ?? PIECE_BY_ID.bulones;
}
export const normId = (id: PieceKey) => pieceDef(id).id;

export type Tier = { t: number; label: string; min: number; name: string };
export const TIERS: Tier[] = (ISO_TIERS as (Tier | null)[]).filter(Boolean) as Tier[];

/** Pieza que representa cada categoría (la que se ve "en construcción" mientras estudiás). */
export const TIER_FACE: Record<number, string> = { 1: "bulones", 2: "engranaje", 3: "motor", 4: "torno", 5: "robot", 6: "horno" };

export function tierFor(minutes: number): Tier {
  let t = TIERS[0];
  for (const x of TIERS) if (minutes >= x.min) t = x;
  return t;
}
export function nextTier(minutes: number): Tier | null {
  return TIERS.find((x) => x.min > minutes) ?? null;
}

export const RARITY: Record<Rarity, { n: string; w: number; color: string }> = {
  comun: { n: (ISO_RARITY as Record<string, { n: string }>).comun.n, w: 62, color: "#8A97AD" },
  rara: { n: "Rara", w: 26, color: "#3B82F6" },
  epica: { n: "Épica", w: 10, color: "#9B6BFF" },
  legendaria: { n: "Legendaria", w: 2, color: "#F2B200" },
};
export const RARITY_ORDER: Rarity[] = ["comun", "rara", "epica", "legendaria"];

export const AREAS = AREA_LABEL;
export const SETS: { id: string; n: string; ids: string[]; premio: string }[] = ISO_SETS;

// Género de cada pieza para armar "un motor" / "una bomba"
const FEM = new Set(["carretilla", "regla", "valvula", "soldadora", "dinamo", "bomba", "prensa", "calidad", "watt", "cinta", "impresora", "turbina", "caldera", "silos", "torre"]);

export function pieceName(id: PieceKey): string {
  return pieceDef(id).n;
}
/** "un motor trifásico IE3", "una bomba centrífuga", "chatarra" */
export function pieceArticle(id: PieceKey): string {
  const p = pieceDef(id);
  if (p.id === "chatarra") return "chatarra";
  const n = p.n.charAt(0).toLowerCase() + p.n.slice(1);
  return `${FEM.has(p.id) ? "una" : "un"} ${n}`;
}

// ---------------------------------------------------------------- Sorteo
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sortea la pieza de una sesión. Es determinístico: la misma semilla (el id de la sesión)
 * da siempre la misma pieza, así que se puede recalcular sin guardar nada extra.
 * - La categoría sale de la duración.
 * - La rareza: 62 % común, 26 % rara, 10 % épica, 2 % legendaria (si en esa categoría no hay
 *   de esa rareza, baja a la siguiente).
 * - Dentro de la rareza, las piezas del área de la materia pesan 4 veces más.
 */
export function rollPiece(minutes: number, subjectName: string, seed: string): PieceKey {
  const r = mulberry(hashStr(seed));
  const tier = tierFor(minutes).t;
  const pool = CATALOG.filter((p) => p.tier === tier);
  let x = r() * 100;
  let rar: Rarity = "comun";
  for (const k of [...RARITY_ORDER].reverse()) { x -= RARITY[k].w; if (x < 0) { rar = k; break; } }
  let cands: PieceDef[] = [];
  for (let i = RARITY_ORDER.indexOf(rar); i >= 0 && !cands.length; i--) cands = pool.filter((p) => p.r === RARITY_ORDER[i]);
  if (!cands.length) cands = pool;
  const area: Area = areaOf(subjectName);
  const weights = cands.map((p) => (area !== "general" && p.a === area ? 4 : 1));
  let y = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { y -= weights[i]; if (y < 0) return cands[i].id; }
  return cands[cands.length - 1].id;
}

/** Pieza que se puede reciclar con 5 chatarras: una común de cualquier categoría. */
export function rollRecycled(seed: string): PieceKey {
  const r = mulberry(hashStr(seed));
  const pool = CATALOG.filter((p) => p.r === "comun");
  return pool[Math.floor(r() * pool.length)].id;
}
export const RECYCLE_COST = 5;

// ---------------------------------------------------------------- Inventario
export const starsOf = (n: number) => (n >= 6 ? 3 : n >= 3 ? 2 : 1);

/** Cuántas de cada pieza tiene alguien (las chatarras recicladas se descuentan). */
export function inventoryOf(d: GroupData, userId: string): Map<string, number> {
  const inv = new Map<string, number>();
  const add = (id: string, n = 1) => inv.set(id, (inv.get(id) ?? 0) + n);
  for (const s of d.sessions) if (s.userId === userId) add(s.outcome === "abandoned" ? "chatarra" : normId(s.piece));
  let recycled = 0;
  for (const rc of d.recycles) if (rc.userId === userId) { add(normId(rc.piece)); recycled++; }
  if (recycled) {
    const left = (inv.get("chatarra") ?? 0) - recycled * RECYCLE_COST;
    if (left > 0) inv.set("chatarra", left); else inv.delete("chatarra");
  }
  return inv;
}

export const RARITY_RANK: Record<string, number> = { comun: 0, rara: 1, epica: 2, legendaria: 3 };
