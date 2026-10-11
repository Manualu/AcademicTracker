// Avisos programados. La llama pg_cron (ver supabase/cron.sql) con { job }.
import { admin, arDate, arWeekStart, checkSecret, formatMinutes, json, profiles, sendEach, sendTo } from "../_shared/push.ts";

const WEEK_GOAL_MIN = 14 * 60;
const WEEK_GOAL_ACTIVITY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (!checkSecret(req)) return json({ error: "unauthorized" }, 401);
  const { job } = await req.json();
  const people = await profiles();
  const now = new Date();

  if (job === "wakeup") {
    const ids = people.filter((p) => p.notify_wakeup).map((p) => p.id);
    return json({ sent: await sendTo(ids, {
      title: "Arriba, son las 8:30",
      body: "Tenés hasta las 9 para mandar la foto al grupo.",
      tag: `wakeup-${arDate(now)}`,
    }) });
  }

  if (job === "exams") {
    const in7 = arDate(new Date(now.getTime() + 7 * DAY_MS));
    const in1 = arDate(new Date(now.getTime() + DAY_MS));
    const { data: exams, error } = await admin
      .from("exams")
      .select("id, subject_name, kind, starts_at, exam_participants(user_id)")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", new Date(now.getTime() + 9 * DAY_MS).toISOString());
    if (error) throw error;
    const allowed = new Set(people.filter((p) => p.notify_exams).map((p) => p.id));
    const items: [string, { title: string; body: string; url: string; tag: string }][] = [];
    const today = arDate(now);
    for (const e of exams ?? []) {
      const day = arDate(new Date(e.starts_at));
      if (e.kind === "grupal") {
        // Sesiones grupales: aviso el mismo día a la mañana a los que van
        if (day !== today) continue;
        const time = new Date(e.starts_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
        const push = { title: `Hoy a las ${time}: sesión grupal de ${e.subject_name}`, body: "Llevá lo que tengas pendiente. Cuando arranque, poné el cronómetro desde la sesión.", url: "./#/examenes", tag: `grupal-hoy-${e.id}` };
        for (const p of e.exam_participants as { user_id: string }[]) if (allowed.has(p.user_id)) items.push([p.user_id, push]);
        continue;
      }
      const kind = e.kind === "otro" ? "examen" : e.kind;
      let push = null;
      if (day === in7) push = {
        title: `Falta una semana para el ${kind} de ${e.subject_name}`,
        body: "Hora de arrancar con los parciales de cuatrimestres anteriores.",
        url: "./#/examenes", tag: `exam7-${e.id}`,
      };
      if (day === in1) push = {
        title: `Mañana es el ${kind} de ${e.subject_name}`,
        body: "Repasá, dormí bien y nada de ir a ver qué onda.",
        url: "./#/examenes", tag: `exam1-${e.id}`,
      };
      if (!push) continue;
      for (const p of e.exam_participants as { user_id: string }[]) {
        if (allowed.has(p.user_id)) items.push([p.user_id, push]);
      }
    }
    return json({ sent: await sendEach(items) });
  }

  if (job === "nudge" || job === "weekly") {
    // "nudge" mira la semana en curso; "weekly" la que terminó ayer
    const start = job === "nudge" ? arWeekStart(now) : arWeekStart(new Date(now.getTime() - DAY_MS));
    const end = new Date(start.getTime() + 7 * DAY_MS);
    const [{ data: sessions }, { data: acts }] = await Promise.all([
      admin.from("study_sessions").select("user_id, minutes").gte("started_at", start.toISOString()).lt("started_at", end.toISOString()),
      admin.from("activities").select("user_id").gte("done_on", arDate(start)).lt("done_on", arDate(end)),
    ]);
    const stats = people.map((p) => ({
      p,
      min: (sessions ?? []).filter((s) => s.user_id === p.id).reduce((a, s) => a + s.minutes, 0),
      act: (acts ?? []).filter((a) => a.user_id === p.id).length,
    }));
    const items: [string, { title: string; body: string; url: string; tag: string }][] = [];

    if (job === "nudge") {
      for (const s of stats) {
        if (!s.p.notify_weekly) continue;
        const faltanMin = Math.max(0, WEEK_GOAL_MIN - s.min);
        const faltanAct = Math.max(0, WEEK_GOAL_ACTIVITY - s.act);
        if (faltanMin === 0 && faltanAct === 0) continue;
        const partes = [];
        if (faltanMin > 0) partes.push(`${formatMinutes(faltanMin)} de estudio`);
        if (faltanAct > 0) partes.push(faltanAct === 1 ? "1 actividad física" : `${faltanAct} actividades físicas`);
        items.push([s.p.id, {
          title: "Último día de la semana",
          body: `Te faltan ${partes.join(" y ")} para cumplir el tratado.`,
          url: "./#/", tag: `nudge-${arDate(start)}`,
        }]);
      }
    } else {
      const ranking = [...stats].sort((a, b) => b.min - a.min);
      const podio = ranking.slice(0, 3).map((s, i) => `${i + 1}. ${s.p.display_name} (${formatMinutes(s.min)})`).join("  ");
      for (const s of stats) {
        if (!s.p.notify_weekly) continue;
        const pos = ranking.indexOf(s) + 1;
        const cumple = s.min >= WEEK_GOAL_MIN && s.act >= WEEK_GOAL_ACTIVITY;
        items.push([s.p.id, {
          title: cumple ? `Semana cumplida, terminaste ${pos}.º` : `Semana cerrada, terminaste ${pos}.º`,
          body: `Estudiaste ${formatMinutes(s.min)} (${(s.min / 60 / 7).toFixed(1).replace(".", ",")} h/día) e hiciste ${s.act} de ${WEEK_GOAL_ACTIVITY} actividades. ${podio}`,
          url: "./#/ranking", tag: `weekly-${arDate(start)}`,
        }]);
      }
    }
    return json({ sent: await sendEach(items) });
  }

  return json({ error: `job desconocido: ${job}` }, 400);
});
