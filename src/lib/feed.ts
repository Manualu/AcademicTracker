import { pieceArticle, pieceDef, RARITY, type Rarity } from "./catalog";
import { fmtMinutes } from "./time";
import type { GroupData, PieceKey } from "./types";

export type FeedItem = {
  id: string;
  userId: string;
  at: string;
  verb: string; // va después del nombre: "sumó 2 h de Probabilidad"
  detail?: string;
  piece?: PieceKey;
  kind: "session" | "activity" | "exam" | "subject";
};

const EXAM_KIND: Record<string, string> = { parcial: "parcial", recuperatorio: "recuperatorio", final: "final", coloquio: "coloquio", otro: "examen" };

export function buildFeed(d: GroupData, limit = 40): FeedItem[] {
  const items: FeedItem[] = [];
  for (const s of d.sessions) {
    items.push({
      id: `s${s.id}`, kind: "session", userId: s.userId, at: s.createdAt,
      verb: `sumó ${fmtMinutes(s.minutes)} de ${s.subjectName}`,
      detail: s.outcome === "abandoned" ? "Cortó antes y le salió chatarra" : `Fabricó ${pieceArticle(s.piece)}${pieceDef(s.piece).r !== "comun" ? ` (${RARITY[pieceDef(s.piece).r as Rarity].n.toLowerCase()})` : ""}${s.source === "manual" ? ", carga manual" : ""}`,
      piece: s.outcome === "abandoned" ? "chatarra" : s.piece,
    });
  }
  for (const a of d.activities) {
    items.push({
      id: `a${a.id}`, kind: "activity", userId: a.userId, at: a.createdAt,
      verb: "hizo actividad física", detail: a.minutes ? `${a.kind}, ${fmtMinutes(a.minutes)}` : a.kind,
    });
  }
  for (const e of d.exams) {
    const date = new Date(e.startsAt).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    if (e.kind === "grupal") {
      const time = new Date(e.startsAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      items.push({ id: `e${e.id}`, kind: "exam", userId: e.createdBy, at: e.createdAt, verb: `armó una sesión de estudio grupal de ${e.subjectName}`, detail: `El ${date} a las ${time}${e.location ? `, ${e.location}` : ""}` });
      continue;
    }
    items.push({ id: `e${e.id}`, kind: "exam", userId: e.createdBy, at: e.createdAt, verb: `agendó ${EXAM_KIND[e.kind]} de ${e.subjectName}`, detail: `El ${date}` });
  }
  for (const r of d.recycles) {
    items.push({ id: `r${r.id}`, kind: "session", userId: r.userId, at: r.createdAt, verb: "recicló 5 chatarras", detail: `Le salió ${pieceArticle(r.piece)}`, piece: r.piece });
  }
  for (const s of d.statuses) {
    if (s.subjectId.startsWith("CBC") || s.status === "cursando") continue;
    items.push({
      id: `m${s.userId}${s.subjectId}`, kind: "subject", userId: s.userId, at: s.updatedAt,
      verb: `${s.status === "aprobada" ? "aprobó" : "regularizó"} ${s.subjectName ?? "una materia"}`,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
