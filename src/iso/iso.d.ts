export type IsoPainter = {
  S: (x: number, y: number, z?: number) => [number, number];
  tw: number; th: number; zh: number; ctx: CanvasRenderingContext2D;
  tile: (x: number, y: number, w: number, d: number, c: string, z?: number) => void;
  box: (x: number, y: number, z: number, w: number, d: number, h: number, c: string, o?: Record<string, unknown>) => void;
  setCtx: (c: CanvasRenderingContext2D) => void;
  [k: string]: unknown;
};
export type IsoPieceDef = {
  id: string; n: string; tier: number; r: string; a: string; h?: number; cota?: string;
  specs: [string, string][]; uso: string; still?: boolean; glowPad?: number;
};
export function makePainter(ctx: CanvasRenderingContext2D, opts: { ox: number; oy: number; tw: number; night?: number; dusk?: number; style?: "normal" | "plano" | "sil"; silColor?: string }): IsoPainter;
export function drawPiece(P: IsoPainter, piece: IsoPieceDef, gx: number, gy: number, t: number, k?: number, x?: { star?: number; mini?: boolean; park?: boolean }): void;
export const PIECES: IsoPieceDef[];
export const PIECE_BY_ID: Record<string, IsoPieceDef>;
export const K: Record<string, string>;
export function shade(hex: string, f: number): string;
export function mix(a: string, b: string, t: number): string;
export function rng(seed: number): () => number;
export const TIERS: ({ t: number; label: string; min: number; name: string } | null)[];
export const RARITY: Record<string, { n: string; w: number }>;
export const AREAS: Record<string, string>;
export const SETS: { id: string; n: string; ids: string[]; premio: string }[];
export function makeFrame(P: IsoPainter, gx: number, gy: number, fw?: number, fd?: number, k?: number): any;
