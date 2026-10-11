// Sesiones de estudio grupales: comparten tabla y calendario con los exámenes (kind "grupal").
import type { Exam } from "./types";

export const isGroup = (e: Exam) => e.kind === "grupal";
export const isExam = (e: Exam) => e.kind !== "grupal";

/** Duración de una sesión grupal (2 h si no se cargó). */
export const groupMinutes = (e: Exam) => e.durationMin ?? 120;
export const groupEnd = (e: Exam) => new Date(new Date(e.startsAt).getTime() + groupMinutes(e) * 60_000);

/** Está pasando ahora (con 15 minutos de tolerancia antes de empezar). */
export function groupLive(e: Exam, now = new Date()): boolean {
  const start = new Date(e.startsAt).getTime() - 15 * 60_000;
  return now.getTime() >= start && now < groupEnd(e);
}

/** Minutos que quedan para usar como cuenta regresiva al arrancar el cronómetro desde la sesión. */
export function groupRemaining(e: Exam, now = new Date()): number {
  const from = Math.max(now.getTime(), new Date(e.startsAt).getTime());
  return Math.max(25, Math.round((groupEnd(e).getTime() - from) / 60_000));
}

export const isUrl = (s: string | null) => !!s && /^https?:\/\//i.test(s.trim());

/** Lugar para mostrar en una línea: un link se ve como "Videollamada". */
export const placeLabel = (s: string | null) => (s ? (isUrl(s) ? "Videollamada" : s) : "");
