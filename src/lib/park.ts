// Datos del parque a partir de lo que carga el grupo.
import { setWorld, type ParkFriend } from "../iso/park";
import { inventoryOf } from "./catalog";
import { currentStreak, sessionsOf } from "./stats";
import { addDays, dayKey, parseDay, TRATADO_INICIO } from "./time";
import type { GroupData } from "./types";

const FALLBACK = ["FFC21A", "7FC4E8", "F4A3B8", "8ED1A8"];

/** Desde cuándo cuentan las horas del parque: la firma del tratado.
 *  En la demo, desde la primera sesión inventada (si no, el parque arrancaría vacío). */
export function parkStart(d: GroupData, isDemo: boolean): Date {
  if (!isDemo) return parseDay(TRATADO_INICIO);
  const first = d.sessions.reduce<string | null>((m, s) => (m === null || s.startedAt < m ? s.startedAt : m), null);
  return first ? parseDay(dayKey(first)) : parseDay(TRATADO_INICIO);
}

export type ParkWorld = { friends: ParkFriend[]; groupHours: number; start: Date };

/** Las naves van en el orden en que se sumó cada uno al grupo (el lote no cambia). */
export function buildWorld(d: GroupData, isDemo: boolean): ParkWorld {
  const start = parkStart(d, isDemo);
  const today = dayKey(new Date());
  const yesterday = dayKey(addDays(new Date(), -1));
  const people = [...d.profiles].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const friends: ParkFriend[] = people.map((p, i) => {
    const ss = sessionsOf(d, p.id);
    const min = ss.filter((s) => new Date(s.startedAt) >= start).reduce((a, s) => a + s.minutes, 0);
    const recent = ss.some((s) => { const k = dayKey(s.startedAt); return k === today || k === yesterday; });
    const bg = /^[0-9a-f]{6}$/i.test(p.avatar.bg) ? p.avatar.bg : FALLBACK[i % FALLBACK.length];
    return {
      id: p.id, n: p.displayName, col: `#${bg.toUpperCase()}`, hours: min / 60,
      closed: !recent, flag: currentStreak(ss) >= 7, inv: inventoryOf(d, p.id),
    };
  });
  const groupHours = friends.reduce((a, f) => a + f.hours, 0);
  return { friends, groupHours, start };
}

export function applyWorld(w: ParkWorld) {
  setWorld({ friends: w.friends, groupHours: w.groupHours });
}
