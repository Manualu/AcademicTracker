import { addDays, DAY_MS, dayKey, fmtHours, inRange, parseDay, startOfWeek, TRATADO_INICIO, WEEK_GOAL_ACTIVITY, WEEK_GOAL_MIN } from "./time";
import type { Activity, GroupData, StudySession } from "./types";

export type Scope = "week" | "all";
export type RankRow = { userId: string; value: number; main: string; sub: string };

export const sessionsOf = (d: GroupData, userId: string) => d.sessions.filter((s) => s.userId === userId);
export const activitiesOf = (d: GroupData, userId: string) => d.activities.filter((a) => a.userId === userId);

export function weekMinutes(sessions: StudySession[], weekStart: Date): number {
  const end = addDays(weekStart, 7);
  return sessions.filter((s) => inRange(s.startedAt, weekStart, end)).reduce((a, s) => a + s.minutes, 0);
}

export function weekActivities(acts: Activity[], weekStart: Date): number {
  const from = dayKey(weekStart);
  const to = dayKey(addDays(weekStart, 7));
  return acts.filter((a) => a.doneOn >= from && a.doneOn < to).length;
}

export function studiedDays(sessions: StudySession[]): Set<string> {
  return new Set(sessions.map((s) => dayKey(s.startedAt)));
}

/** Días seguidos con al menos una sesión. Si hoy todavía no estudiaste, la racha cuenta hasta ayer. */
export function currentStreak(sessions: StudySession[], now = new Date()): number {
  const days = studiedDays(sessions);
  let d = new Date(now);
  if (!days.has(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

export function bestStreak(sessions: StudySession[]): number {
  const days = [...studiedDays(sessions)].sort();
  let best = 0, run = 0, prev: number | null = null;
  for (const k of days) {
    const t = parseDay(k).getTime();
    run = prev !== null && Math.round((t - prev) / DAY_MS) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

/** Desde cuándo cuenta el histórico de una persona: la firma del tratado o su primera sesión, lo que haya sido antes. */
export function historyStart(sessions: StudySession[]): Date {
  const first = sessions.reduce<string | null>((m, s) => (m === null || s.startedAt < m ? s.startedAt : m), null);
  const t = parseDay(TRATADO_INICIO);
  return first && new Date(first) < t ? parseDay(dayKey(first)) : t;
}

export function daysSince(start: Date, now = new Date()): number {
  return Math.max(1, Math.round((parseDay(dayKey(now)).getTime() - start.getTime()) / DAY_MS) + 1);
}

/** Semanas cerradas (lunes a domingo) que cumplieron una condición, desde el inicio del histórico. */
export function closedWeeks(start: Date, now = new Date()): Date[] {
  const out: Date[] = [];
  for (let w = startOfWeek(start); addDays(w, 7) <= startOfWeek(now); w = addDays(w, 7)) out.push(w);
  return out;
}

function sortRows(rows: RankRow[]): RankRow[] {
  return rows.sort((a, b) => b.value - a.value);
}

export function hoursRanking(d: GroupData, scope: Scope, now = new Date()): RankRow[] {
  return sortRows(d.profiles.map((p) => {
    const ss = sessionsOf(d, p.id);
    if (scope === "week") {
      const min = weekMinutes(ss, startOfWeek(now));
      return { userId: p.id, value: min, main: `${fmtHours(min)} h`, sub: `${fmtHours(min / 7)} h/día de promedio` };
    }
    const start = historyStart(ss);
    const total = ss.filter((s) => new Date(s.startedAt) >= start).reduce((a, s) => a + s.minutes, 0);
    const avg = total / daysSince(start, now);
    return { userId: p.id, value: avg, main: `${fmtHours(avg)} h/día`, sub: `${fmtHours(total, 0)} h en total` };
  }));
}

export function activityRanking(d: GroupData, scope: Scope, now = new Date()): RankRow[] {
  return sortRows(d.profiles.map((p) => {
    const acts = activitiesOf(d, p.id);
    if (scope === "week") {
      const n = weekActivities(acts, startOfWeek(now));
      return { userId: p.id, value: n, main: `${n} de ${WEEK_GOAL_ACTIVITY}`, sub: n >= WEEK_GOAL_ACTIVITY ? "Semana cumplida" : `Le faltan ${WEEK_GOAL_ACTIVITY - n}` };
    }
    const start = historyStart(sessionsOf(d, p.id));
    const startKey = dayKey(start);
    const total = acts.filter((a) => a.doneOn >= startKey).length;
    const perWeek = (total / daysSince(start, now)) * 7;
    const cumplidas = closedWeeks(start, now).filter((w) => weekActivities(acts, w) >= WEEK_GOAL_ACTIVITY).length;
    return {
      userId: p.id, value: perWeek, main: `${fmtHours(perWeek * 60)} por semana`,
      sub: `${total} en total, ${cumplidas} ${cumplidas === 1 ? "semana cumplida" : "semanas cumplidas"}`,
    };
  }));
}

export function streakRanking(d: GroupData, scope: Scope, now = new Date()): RankRow[] {
  return sortRows(d.profiles.map((p) => {
    const ss = sessionsOf(d, p.id);
    if (scope === "week") {
      const ws = startOfWeek(now);
      const days = [...studiedDays(ss)].filter((k) => k >= dayKey(ws) && k < dayKey(addDays(ws, 7))).length;
      const elapsed = Math.min(7, daysSince(ws, now));
      return { userId: p.id, value: days * 1000 + weekMinutes(ss, ws) / 1000, main: `${days} de ${elapsed} días`, sub: "estudiados esta semana" };
    }
    const cur = currentStreak(ss, now);
    const best = bestStreak(ss);
    return { userId: p.id, value: cur * 1000 + best, main: `${cur} ${cur === 1 ? "día" : "días"} seguidos`, sub: `Mejor racha: ${best}` };
  }));
}

export function weekSummary(d: GroupData, userId: string, now = new Date()) {
  const ws = startOfWeek(now);
  const ss = sessionsOf(d, userId);
  const min = weekMinutes(ss, ws);
  const acts = weekActivities(activitiesOf(d, userId), ws);
  const elapsed = Math.min(7, daysSince(ws, now));
  return {
    minutes: min,
    goalMinutes: WEEK_GOAL_MIN,
    activities: acts,
    goalActivities: WEEK_GOAL_ACTIVITY,
    avgPerDay: min / 7,
    /** Lo que tendrías que llevar a esta altura de la semana para ir en ritmo */
    paceMinutes: (WEEK_GOAL_MIN / 7) * elapsed,
    daysLeft: 7 - elapsed,
    weekSessions: ss.filter((s) => inRange(s.startedAt, ws, addDays(ws, 7))),
  };
}
