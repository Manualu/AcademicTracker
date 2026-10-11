import { activitiesOf, bestStreak, closedWeeks, historyStart, sessionsOf, weekActivities, weekMinutes } from "./stats";
import { addDays, dayKey, startOfWeek, WEEK_GOAL_ACTIVITY, WEEK_GOAL_MIN } from "./time";
import { CATALOG, inventoryOf, pieceDef, SETS } from "./catalog";
import type { GroupData } from "./types";

export type Trophy = {
  id: string;
  name: string;
  description: string;
  glyph: string; // símbolo que se dibuja en la medalla
  earned: boolean;
  progress?: string;
};

type Def = { id: string; name: string; description: string; glyph: string; check: (c: Ctx) => boolean | [boolean, string] };

type Ctx = {
  data: GroupData;
  userId: string;
  totalMin: number;
  weeks: Date[]; // semanas cerradas + la actual
};

function consecutive(flags: boolean[], n: number): boolean {
  let run = 0;
  for (const f of flags) { run = f ? run + 1 : 0; if (run >= n) return true; }
  return false;
}

const hoursDef = (id: string, name: string, h: number, glyph: string): Def => ({
  id, name, glyph, description: `Sumá ${h} horas de estudio en total.`,
  check: (c) => [c.totalMin >= h * 60, `${Math.floor(c.totalMin / 60)} de ${h} h`],
});

const DEFS: Def[] = [
  {
    id: "primera-pieza", name: "Primera pieza", glyph: "1",
    description: "Terminá tu primera sesión de estudio.",
    check: (c) => sessionsOf(c.data, c.userId).some((s) => s.outcome === "completed"),
  },
  hoursDef("puesta-en-marcha", "Puesta en marcha", 10, "10"),
  hoursDef("capacidad-instalada", "Capacidad instalada", 50, "50"),
  hoursDef("economia-de-escala", "Economía de escala", 100, "100"),
  hoursDef("llave-en-mano", "Planta llave en mano", 250, "250"),
  {
    id: "regimen-permanente", name: "Régimen permanente", glyph: "∿",
    description: "Cumplí las 14 horas semanales cuatro semanas seguidas.",
    check: (c) => consecutive(c.weeks.map((w) => weekMinutes(sessionsOf(c.data, c.userId), w) >= WEEK_GOAL_MIN), 4),
  },
  {
    id: "factor-de-seguridad", name: "Factor de seguridad", glyph: "1,5",
    description: "Hacé 21 horas en una semana: un 50 % por encima de lo que pide el tratado.",
    check: (c) => c.weeks.some((w) => weekMinutes(sessionsOf(c.data, c.userId), w) >= WEEK_GOAL_MIN * 1.5),
  },
  {
    id: "sin-tiempo-muerto", name: "Sin tiempo muerto", glyph: "7",
    description: "Estudiá los siete días de una misma semana.",
    check: (c) => {
      const days = new Set(sessionsOf(c.data, c.userId).map((s) => dayKey(s.startedAt)));
      return c.weeks.some((w) => Array.from({ length: 7 }, (_, i) => dayKey(addDays(w, i))).every((k) => days.has(k)));
    },
  },
  {
    id: "maraton", name: "Ciclo combinado", glyph: "3h",
    description: "Hacé una sola sesión de 3 horas o más.",
    check: (c) => sessionsOf(c.data, c.userId).some((s) => s.minutes >= 180),
  },
  {
    id: "cero-defectos", name: "Cero defectos", glyph: "0",
    description: "Completá 10 sesiones de cronómetro seguidas sin cortar ninguna.",
    check: (c) => {
      const timer = sessionsOf(c.data, c.userId).filter((s) => s.source === "timer").sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      return consecutive(timer.map((s) => s.outcome === "completed"), 10);
    },
  },
  {
    id: "turno-manana", name: "Turno mañana", glyph: "7am",
    description: "Empezá una sesión antes de las 8.",
    check: (c) => sessionsOf(c.data, c.userId).some((s) => new Date(s.startedAt).getHours() < 8),
  },
  {
    id: "turno-noche", name: "Turno noche", glyph: "0h",
    description: "Estudiá pasada la medianoche.",
    check: (c) => sessionsOf(c.data, c.userId).some((s) => {
      const start = new Date(s.startedAt);
      const end = new Date(start.getTime() + s.minutes * 60_000);
      return start.getHours() < 5 || (end.getHours() < 5 && dayKey(end) !== dayKey(start));
    }),
  },
  {
    id: "racha-15", name: "Proceso continuo", glyph: "15",
    description: "Estudiá 15 días seguidos.",
    check: (c) => [bestStreak(sessionsOf(c.data, c.userId)) >= 15, `Mejor racha: ${bestStreak(sessionsOf(c.data, c.userId))}`],
  },
  {
    id: "cuerpo-rigido", name: "Cuerpo rígido", glyph: "3×4",
    description: "Hacé actividad física 3 veces por semana durante cuatro semanas seguidas.",
    check: (c) => consecutive(c.weeks.map((w) => weekActivities(activitiesOf(c.data, c.userId), w) >= WEEK_GOAL_ACTIVITY), 4),
  },
  {
    id: "resistencia-de-materiales", name: "Resistencia de materiales", glyph: "σ",
    description: "Cumplí las 3 actividades físicas en una semana con examen.",
    check: (c) => {
      const mine = new Set(c.data.participants.filter((p) => p.userId === c.userId).map((p) => p.examId));
      const examWeeks = c.data.exams.filter((e) => mine.has(e.id)).map((e) => dayKey(startOfWeek(new Date(e.startsAt))));
      return examWeeks.some((k) => weekActivities(activitiesOf(c.data, c.userId), new Date(`${k}T00:00`)) >= WEEK_GOAL_ACTIVITY);
    },
  },
  {
    id: "ensamble", name: "Ensamble", glyph: "∪",
    description: "Rendí un examen junto con alguien más del grupo.",
    check: (c) => c.data.exams.some((e) => {
      if (new Date(e.startsAt) > new Date()) return false;
      const ps = c.data.participants.filter((p) => p.examId === e.id);
      return ps.length >= 2 && ps.some((p) => p.userId === c.userId);
    }),
  },
  {
    id: "control-de-calidad", name: "Control de calidad", glyph: "✓",
    description: "Aprobá una materia (sin contar el CBC).",
    check: (c) => c.data.statuses.some((s) => s.userId === c.userId && s.status === "aprobada" && !s.subjectId.startsWith("CBC")),
  },
  {
    id: "linea-de-produccion", name: "Línea de producción", glyph: "5",
    description: "Tené 5 materias aprobadas (sin contar el CBC).",
    check: (c) => {
      const n = c.data.statuses.filter((s) => s.userId === c.userId && s.status === "aprobada" && !s.subjectId.startsWith("CBC")).length;
      return [n >= 5, `${n} de 5`];
    },
  },
  {
    id: "pieza-epica", name: "Pieza de colección", glyph: "◆",
    description: "Conseguí una pieza épica o legendaria.",
    check: (c) => [...inventoryOf(c.data, c.userId).keys()].some((id) => { const r = pieceDef(id).r; return r === "epica" || r === "legendaria"; }),
  },
  {
    id: "reliquia", name: "Reliquia", glyph: "★",
    description: "Conseguí una de las seis reliquias legendarias del Museo de la Ingeniería.",
    check: (c) => [...inventoryOf(c.data, c.userId).keys()].some((id) => pieceDef(id).r === "legendaria"),
  },
  {
    id: "coleccionista", name: "Coleccionista", glyph: "18",
    description: "Juntá la mitad del catálogo: 18 piezas distintas.",
    check: (c) => {
      const n = [...inventoryOf(c.data, c.userId).keys()].filter((id) => id !== "chatarra").length;
      return [n >= CATALOG.length / 2, `${n} de ${CATALOG.length / 2}`];
    },
  },
  {
    id: "juego-completo", name: "Juego completo", glyph: "4/4",
    description: "Completá una colección (por ejemplo, la Línea de montaje).",
    check: (c) => { const inv = inventoryOf(c.data, c.userId); return SETS.some((st) => st.ids.every((id) => inv.has(id))); },
  },
];

export function trophiesFor(data: GroupData, userId: string, now = new Date()): Trophy[] {
  const ss = sessionsOf(data, userId);
  const weeks = [...closedWeeks(historyStart(ss), now), startOfWeek(now)];
  const ctx: Ctx = { data, userId, totalMin: ss.reduce((a, s) => a + s.minutes, 0), weeks };
  return DEFS.map((d) => {
    const r = d.check(ctx);
    const [earned, progress] = Array.isArray(r) ? r : [r, undefined];
    return { id: d.id, name: d.name, description: d.description, glyph: d.glyph, earned, progress };
  });
}
