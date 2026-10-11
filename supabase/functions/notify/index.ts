// Avisa al resto del grupo cuando alguien carga algo nuevo.
// La llama la base de datos (trigger notify_group) en cada inserción.
import { PIECE_NAMES, PIECE_RARITY } from "../_shared/pieces.ts";
import { checkSecret, formatMinutes, json, profiles, sendTo } from "../_shared/push.ts";

const RARITY_TAG: Record<string, string> = { rara: " (rara)", epica: " (épica)", legendaria: " (¡legendaria!)" };

const EXAM_KIND: Record<string, string> = {
  parcial: "parcial",
  recuperatorio: "recuperatorio",
  final: "final",
  coloquio: "coloquio",
  otro: "examen",
};

Deno.serve(async (req) => {
  if (!checkSecret(req)) return json({ error: "unauthorized" }, 401);
  const { table, record } = await req.json();

  const people = await profiles();
  const author = people.find((p) => p.id === (record.user_id ?? record.created_by));
  if (!author) return json({ skipped: "sin autor" });
  const others = people.filter((p) => p.id !== author.id && p.notify_feed).map((p) => p.id);
  const name = author.display_name;

  let push;
  switch (table) {
    case "study_sessions": {
      const piece = (PIECE_NAMES[record.piece] ?? "una pieza") + (RARITY_TAG[PIECE_RARITY[record.piece]] ?? "");
      push = {
        title: `${name} sumó ${formatMinutes(record.minutes)} de ${record.subject_name}`,
        body: record.piece === "chatarra" ? "Cortó antes de tiempo y le salió chatarra." : `Fabricó ${piece} para su nave.`,
        url: "./#/",
        tag: `session-${record.id}`,
      };
      break;
    }
    case "activities":
      push = {
        title: `${name} hizo actividad física`,
        body: record.minutes ? `${record.kind}, ${formatMinutes(record.minutes)}` : record.kind,
        url: "./#/",
        tag: `activity-${record.id}`,
      };
      break;
    case "exams": {
      const date = new Date(record.starts_at).toLocaleDateString("es-AR", {
        weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires",
      });
      push = {
        title: `${name} agendó ${EXAM_KIND[record.kind] ?? "examen"} de ${record.subject_name}`,
        body: `Es el ${date}. Si también lo rendís, sumate.`,
        url: "./#/examenes",
        tag: `exam-${record.id}`,
      };
      break;
    }
    case "subject_status":
      push = {
        title: record.status === "aprobada" ? `${name} aprobó ${record.subject_name ?? "una materia"}` : `${name} regularizó ${record.subject_name ?? "una materia"}`,
        body: record.status === "aprobada" ? "Una menos para la Remontada." : "Firma conseguida, ahora a por el final.",
        url: "./#/carrera",
        tag: `status-${record.user_id}-${record.subject_id}`,
      };
      break;
    default:
      return json({ skipped: table });
  }

  const sent = await sendTo(others, push);
  return json({ sent });
});
