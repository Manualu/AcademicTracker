import type { IsoPainter } from "./iso";

export type ParkFriend = { id: string; n: string; col: string; hours: number; closed: boolean; flag: boolean; inv: Map<string, number> };
export type ParkSelection =
  | { k: "nave" | "racha" | "cerrado"; f: ParkFriend & { lot: [number, number] } }
  | { k: "pieza"; f: ParkFriend & { lot: [number, number] }; p: { id: string; n: string; r: string }; n: number }
  | { k: string; f?: ParkFriend; [x: string]: unknown };

export const MAX_NAVES: number;
export const LEVELS: { h: number; n: string }[];
export const NAVE_FORMS: { from: number; n: string }[];
export const STAGES: { h: number; id: string; n: string; d: string }[];
export const STAGE_FOCUS: Record<string, [number, number, number]>;
export function levelOf(hours: number): number;
export function formOf(level: number): number;
export function stageIdx(hours: number): number;
export function boundsFor(hours: number): [number, number];
export function starsOf(n: number): number;
export function setsDone(f: { inv: Map<string, number> }): { id: string; n: string; ids: string[]; premio: string }[];
export function drawNave(P: IsoPainter, f: { n: string; col: string; lot: [number, number] }, form: number, closed: boolean, t: number): void;
export function setWorld(w: { friends: ParkFriend[]; groupHours: number }): void;
export function setLight(mode: "auto" | "dia" | "atardecer" | "noche"): void;
export function getLight(): "auto" | "dia" | "atardecer" | "noche";
export function clearSelection(): void;
export function emitParticles(x: number, y: number, z: number, kind: string): void;

export type ParkScene = {
  init(canvas: HTMLCanvasElement, onSelect?: (sel: ParkSelection | null) => void): void;
  start(): void;
  redraw(): void;
  destroy(): void;
  zoomBy(f: number): void;
  recenter(): void;
  focus(x: number, y: number, z?: number): void;
  bench(n?: number): number;
};
export function createScene(opts?: { compact?: boolean }): ParkScene;
