import type { PieceKey } from "./types";

export type PieceInfo = { key: PieceKey; name: string; article: string; min: number; blurb: string };

/** Cada sesión fabrica una pieza para tu planta según cuánto duró. */
export const PIECES: PieceInfo[] = [
  { key: "tornillo", name: "Tornillo", article: "un tornillo", min: 1, blurb: "Menos de 15 minutos" },
  { key: "engranaje", name: "Engranaje", article: "un engranaje", min: 15, blurb: "De 15 a 29 minutos" },
  { key: "motor", name: "Motor", article: "un motor", min: 30, blurb: "De 30 a 59 minutos" },
  { key: "torno", name: "Torno", article: "un torno", min: 60, blurb: "De 1 h a 1 h 29 min" },
  { key: "robot", name: "Brazo robótico", article: "un brazo robótico", min: 90, blurb: "De 1 h 30 min a 1 h 59 min" },
  { key: "horno", name: "Alto horno", article: "un alto horno", min: 120, blurb: "2 horas o más" },
];

export const CHATARRA: PieceInfo = {
  key: "chatarra", name: "Chatarra", article: "chatarra", min: 0, blurb: "Cortaste el cronómetro antes de tiempo",
};

export function pieceFor(minutes: number): PieceKey {
  let key: PieceKey = "tornillo";
  for (const p of PIECES) if (minutes >= p.min) key = p.key;
  return key;
}

export function pieceInfo(key: PieceKey): PieceInfo {
  return key === "chatarra" ? CHATARRA : PIECES.find((p) => p.key === key)!;
}

/** La siguiente pieza a la que llegás si seguís estudiando (para el modo libre). */
export function nextPiece(minutes: number): PieceInfo | null {
  return PIECES.find((p) => p.min > minutes) ?? null;
}
