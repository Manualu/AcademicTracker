// Backend de prueba: guarda todo en el navegador y trae un grupo inventado,
// para ver la app sin configurar Supabase. Se activa si faltan las variables de entorno.
import { applyOp } from "./apply";
import { rollPiece } from "./catalog";
import { addDays, dayKey, uuid } from "./time";
import type { Backend, GroupData, LiveStudy, Op, Profile, RemoteEvent, StudySession } from "./types";

const DB_KEY = "remontada.demo.db.v3";
const AUTH_KEY = "remontada.demo.user";
export const DEMO_ME = "demo-manu";
/** Días de historial inventado: alcanza para ver el parque con varias etapas desbloqueadas */
const DEMO_DAYS = 62;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function seed(): GroupData {
  const now = new Date();
  const people: [string, string, Profile["avatar"]][] = [
    [DEMO_ME, "Manu", { style: "bottts", seed: "manu-remontada", bg: "FFC21A" }],
    ["demo-berni", "Berni", { style: "notionists", seed: "berni", bg: "9AD0EC" }],
    ["demo-benja", "Benja", { style: "adventurer", seed: "benja-r", bg: "B7E4C7" }],
    ["demo-vicky", "Vicky", { style: "lorelei", seed: "vicky-fiuba", bg: "F4B6C2" }],
  ];
  const created = addDays(now, -DEMO_DAYS - 2).toISOString();
  const profiles: Profile[] = people.map(([id, name, avatar]) => ({
    id, displayName: name, avatar, planId: "industrial-2020",
    notifyFeed: true, notifyWakeup: true, notifyExams: true, notifyWeekly: true, createdAt: created,
  }));

  const subjects = [
    ["PROBA", "Probabilidad"], ["ECO", "Economía"], ["TDE", "Transformación de la Energía"], ["MAI", "Materiales y Aplicaciones I"],
  ];
  // Lo que cursaban el cuatrimestre pasado (para que el historial largo tenga variedad)
  const before = [
    ["AMII", "Análisis Matemático II"], ["QB", "Química Básica"], ["ERM", "Estática y Resistencia de Materiales"], ["IND", "Industrias Digitales"],
  ];
  const rand = rng(42);
  const sessions: StudySession[] = [];
  const intensity: Record<string, number> = { [DEMO_ME]: 0.8, "demo-berni": 1, "demo-benja": 0.6, "demo-vicky": 0.9 };
  for (const [id] of people) {
    for (let d = DEMO_DAYS; d >= 0; d--) {
      const day = addDays(now, -d);
      if (d === 0 && now.getHours() < 11) continue;
      const count = rand() < 0.15 ? 0 : Math.round(rand() * 2.4 * intensity[id]) + (rand() < intensity[id] ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const pool = d > 30 ? before : subjects;
        const [sid, sname] = pool[Math.floor(rand() * pool.length)];
        const minutes = [25, 25, 50, 50, 50, 75, 90, 120][Math.floor(rand() * 8)];
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9 + i * 3 + Math.floor(rand() * 2), Math.floor(rand() * 60));
        if (start.getTime() + minutes * 60_000 > now.getTime()) continue;
        const abandoned = rand() < 0.08;
        const sidv = uuid();
        sessions.push({
          id: sidv, userId: id, subjectId: sid, subjectName: sname, startedAt: start.toISOString(),
          minutes: abandoned ? Math.round(minutes / 3) : minutes, source: rand() < 0.8 ? "timer" : "manual",
          outcome: abandoned ? "abandoned" : "completed", piece: abandoned ? "chatarra" : rollPiece(minutes, sname, sidv),
          createdAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
        });
      }
    }
  }
  const kinds = ["Running", "Gimnasio", "Fútbol", "Bici", "Natación", "Pádel"];
  const activities = people.flatMap(([id], pi) =>
    Array.from({ length: 22 }, (_, d) => d)
      .filter((d) => (d + pi) % 3 === 0 || rand() < 0.12)
      .filter((d) => !(d === 0 && now.getHours() < 11))
      .map((d) => ({
        id: uuid(), userId: id, kind: kinds[(pi + d) % kinds.length], doneOn: dayKey(addDays(now, -d)),
        minutes: [40, 60, 90][d % 3], createdAt: addDays(now, -d).toISOString(),
      })),
  );

  const at = (days: number, h: number) => {
    const x = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), days);
    x.setHours(h, 0, 0, 0);
    return x.toISOString();
  };
  const exams = [
    { id: uuid(), createdBy: "demo-berni", subjectName: "Probabilidad", kind: "parcial" as const, startsAt: at(6, 18), location: "Paseo Colón, aula 302", notes: "Entra hasta variables aleatorias continuas", createdAt: created },
    { id: uuid(), createdBy: DEMO_ME, subjectName: "Economía", kind: "parcial" as const, startsAt: at(13, 9), location: "Paseo Colón", notes: null, createdAt: created },
    { id: uuid(), createdBy: "demo-vicky", subjectName: "Transformación de la Energía", kind: "parcial" as const, startsAt: at(20, 14), location: "Las Heras", notes: null, createdAt: created },
    { id: uuid(), createdBy: "demo-benja", subjectName: "Análisis Matemático II", kind: "final" as const, startsAt: at(31, 9), location: null, notes: null, createdAt: created },
    { id: uuid(), createdBy: "demo-benja", subjectName: "Química Básica", kind: "recuperatorio" as const, startsAt: at(-9, 9), location: null, notes: null, createdAt: created },
  ];
  const participants = [
    [0, DEMO_ME], [0, "demo-berni"], [0, "demo-vicky"], [1, DEMO_ME], [1, "demo-benja"], [2, "demo-vicky"], [2, "demo-berni"], [3, "demo-benja"], [4, "demo-benja"],
  ].map(([i, u]) => ({ examId: exams[i as number].id, userId: u as string, joinedAt: created }));

  const st = (userId: string, subjectId: string, subjectName: string, status: "cursando" | "regularizada" | "aprobada") =>
    ({ userId, planId: "industrial-2020", subjectId, subjectName, status, updatedAt: created });
  const cbc = ["CBC66", "CBC62", "CBC24", "CBC3", "CBC90", "CBC40"];
  const statuses = people.flatMap(([id]) => [
    ...cbc.map((c) => st(id, c, "CBC", "aprobada")),
    st(id, "AMII", "Análisis Matemático II", id === "demo-benja" ? "regularizada" : "aprobada"),
    st(id, "FSP", "Física de los Sistemas de Partículas", "aprobada"),
    st(id, "PII", "Principios de Ingeniería Industrial", "aprobada"),
    st(id, "AL", "Álgebra Lineal", "aprobada"),
    st(id, "QB", "Química Básica", id === "demo-vicky" ? "aprobada" : "regularizada"),
    st(id, "ERM", "Estática y Resistencia de Materiales", "regularizada"),
    st(id, "ODE", "Organización y Dirección Empresaria", "aprobada"),
    ...subjects.map(([sid, sname]) => st(id, sid, sname, "cursando")),
  ]);
  return { profiles, statuses, sessions, activities, exams, participants, recycles: [] };
}

function load(): GroupData {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return { recycles: [], ...JSON.parse(raw) };
  } catch { /* sin almacenamiento: se usa el grupo inventado en memoria */ }
  const d = seed();
  save(d);
  return d;
}

let memory: GroupData | null = null;
function save(d: GroupData) {
  memory = d;
  try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch { /* ignorar */ }
}

export class DemoBackend implements Backend {
  readonly isDemo = true;
  private listeners = new Set<(e: RemoteEvent) => void>();
  private authListeners = new Set<(id: string | null) => void>();
  private user: string | null;

  constructor() {
    let u: string | null = DEMO_ME;
    try { u = localStorage.getItem(AUTH_KEY) === "out" ? null : DEMO_ME; } catch { /* ignorar */ }
    this.user = u;
    // A los 20 segundos, una amiga carga una sesión para mostrar el aviso en vivo
    setTimeout(() => this.simulateFriend(), 20_000);
  }

  private db(): GroupData {
    return memory ?? load();
  }

  async currentUserId() { return this.user; }
  onAuthChange(cb: (id: string | null) => void) {
    this.authListeners.add(cb);
    return () => { this.authListeners.delete(cb); };
  }
  private setUser(u: string | null) {
    this.user = u;
    try { localStorage.setItem(AUTH_KEY, u ? "in" : "out"); } catch { /* ignorar */ }
    this.authListeners.forEach((cb) => cb(u));
  }
  async signIn() { this.setUser(DEMO_ME); }
  async signUp() { this.setUser(DEMO_ME); return { needsConfirmation: false }; }
  async signOut() { this.setUser(null); }

  async fetchAll() {
    await new Promise((r) => setTimeout(r, 150));
    return structuredClone(this.db());
  }

  async exec(op: Op) {
    if (!navigator.onLine) throw new TypeError("Failed to fetch");
    save(applyOp(this.db(), op));
  }

  subscribe(cb: (e: RemoteEvent) => void) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  // Presencia simulada: Berni está estudiando Probabilidad (termina a los 20 s, ver simulateFriend)
  // y a los 45 s Benja arranca Economía.
  private presence: Record<string, LiveStudy> = {
    "demo-berni": { subject: "Probabilidad", startedAt: Date.now() - 49 * 60_000 - 40_000, targetMin: 50 },
  };
  private presCbs = new Set<(live: Record<string, LiveStudy>) => void>();
  private emitPresence() { this.presCbs.forEach((cb) => cb({ ...this.presence })); }
  setPresence() { /* en la demo no hay otros celulares a quienes avisar */ }
  onPresence(cb: (live: Record<string, LiveStudy>) => void) {
    this.presCbs.add(cb);
    cb({ ...this.presence });
    return () => { this.presCbs.delete(cb); };
  }

  private simulateFriend() {
    delete this.presence["demo-berni"];
    this.emitPresence();
    setTimeout(() => { this.presence["demo-benja"] = { subject: "Economía", startedAt: Date.now(), targetMin: 50 }; this.emitPresence(); }, 25_000);
    const minutes = 50;
    const id = uuid();
    const s: StudySession = {
      id, userId: "demo-berni", subjectId: "PROBA", subjectName: "Probabilidad",
      startedAt: new Date(Date.now() - minutes * 60_000).toISOString(), minutes, source: "timer",
      outcome: "completed", piece: rollPiece(minutes, "Probabilidad", id), createdAt: new Date().toISOString(),
    };
    save(applyOp(this.db(), { kind: "session.add", session: s }));
    this.listeners.forEach((cb) => cb({
      table: "study_sessions", type: "INSERT",
      record: { id: s.id, user_id: s.userId, subject_name: s.subjectName, minutes: s.minutes, piece: s.piece },
    }));
  }

  async savePushSubscription() { /* en la demo no hay servidor de avisos */ }
  async deletePushSubscription() { /* idem */ }
}

export function resetDemo() {
  try { localStorage.removeItem(DB_KEY); } catch { /* ignorar */ }
  memory = null;
}
