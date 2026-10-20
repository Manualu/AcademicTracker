// Cronómetro de estudio. Funciona sin conexión (modo avión): guarda la hora de inicio en el
// celular y calcula el tiempo transcurrido, así que sigue contando aunque bloquees la pantalla
// o se cierre la app. La sesión terminada entra en la cola y se sube cuando vuelve la señal.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { pieceArticle, rollPiece } from "./catalog";
import { localNotify } from "./push";
import { getPrefs } from "./prefs";
import { sfx } from "./sound";
import { useStore } from "./store";
import { fmtMinutes, uuid } from "./time";
import type { StudySession } from "./types";

const KEY = "remontada.timer";
const BREAK_KEY = "remontada.break";
const MAX_MIN = 720;
/** Una pausa puede durar hasta 5 minutos; después la sesión se cierra con lo hecho. */
export const PAUSE_MAX_MIN = 5;

/** Pomodoro: bloques de estudio con descansos. Cada bloque terminado es una sesión y abre un cajón. */
export type Pomo = { work: number; rest: number; longRest: number; every: number; done: number };
export const POMO_PRESETS: { work: number; rest: number; longRest: number; label: string }[] = [
  { work: 25, rest: 5, longRest: 15, label: "25 / 5" },
  { work: 50, rest: 10, longRest: 20, label: "50 / 10" },
];

export type RunningTimer = {
  startedAt: number;
  targetMin: number | null; // null = modo libre
  subjectId: string | null;
  subjectName: string;
  pausedAt?: number | null; // en pausa desde
  pausedMs?: number; // tiempo total en pausa (no cuenta)
  pomo?: Pomo | null;
};

/** Descanso del pomodoro (entre bloques). No suma horas. */
export type PomoBreak = {
  startedAt: number;
  until: number;
  long: boolean;
  pomo: Pomo;
  subjectId: string | null;
  subjectName: string;
};

/** Tiempo estudiado de verdad (sin pausas), en milisegundos. */
export const activeMs = (t: RunningTimer, now: number) => (t.pausedAt ?? now) - t.startedAt - (t.pausedMs ?? 0);

type TimerCtx = {
  running: RunningTimer | null;
  elapsedSec: number;
  paused: boolean;
  pauseLeftSec: number;
  start: (t: Omit<RunningTimer, "startedAt">) => void;
  pause: () => void;
  resume: () => void;
  finish: () => void; // modo libre: guarda lo hecho
  abandon: () => void; // cuenta regresiva o pomodoro: corta antes y sale chatarra
  discard: () => void; // menos de un minuto: no se guarda nada
  result: StudySession | null;
  clearResult: () => void;
  /** Pomodoro entre bloques */
  pomoBreak: PomoBreak | null;
  breakLeftSec: number;
  nextBlock: () => void;
  endPomodoro: () => void;
  /** Aviso cuando la pausa pasó el límite y la sesión se cerró sola */
  autoClosed: boolean;
};

const Ctx = createContext<TimerCtx | null>(null);

function loadKey<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
const load = () => loadKey<RunningTimer>(KEY);

function beep() {
  try {
    const ac = new AudioContext();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = i === 2 ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.22);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.25);
    });
  } catch { /* sin audio */ }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { userId, dispatch } = useStore();
  const [running, setRunning] = useState<RunningTimer | null>(load);
  const [pomoBreak, setBreak] = useState<PomoBreak | null>(() => loadKey<PomoBreak>(BREAK_KEY));
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<StudySession | null>(null);
  const [autoClosed, setAutoClosed] = useState(false);
  const savingRef = useRef(false);
  const savedStartRef = useRef<number | null>(null);
  const bellRef = useRef<number | null>(null);

  const persist = (t: RunningTimer | null) => {
    try {
      if (t) localStorage.setItem(KEY, JSON.stringify(t));
      else localStorage.removeItem(KEY);
    } catch { /* ignorar */ }
    setRunning(t);
  };
  const persistBreak = (b: PomoBreak | null) => {
    try {
      if (b) localStorage.setItem(BREAK_KEY, JSON.stringify(b));
      else localStorage.removeItem(BREAK_KEY);
    } catch { /* ignorar */ }
    setBreak(b);
  };

  /** Guarda la sesión. `endAt` = momento en que terminó el estudio (para encadenar el descanso). */
  const save = useCallback((t: RunningTimer, minutes: number, outcome: StudySession["outcome"], endAt = Date.now()) => {
    if (savingRef.current) return;
    // Cada sesión (identificada por su hora de inicio) se guarda una sola vez, aunque el
    // chequeo de "terminó" corra dos veces seguidas antes de que se actualice la pantalla
    if (savedStartRef.current === t.startedAt) return;
    savedStartRef.current = t.startedAt;
    savingRef.current = true;
    persist(null);
    const min = Math.min(MAX_MIN, Math.floor(minutes));
    if (min >= 1 && userId) {
      const id = uuid();
      const session: StudySession = {
        id,
        userId,
        subjectId: t.subjectId,
        subjectName: t.subjectName,
        startedAt: new Date(t.startedAt).toISOString(),
        minutes: min,
        source: "timer",
        outcome,
        piece: outcome === "abandoned" ? "chatarra" : rollPiece(min, t.subjectName, id),
        createdAt: new Date().toISOString(),
      };
      dispatch({ kind: "session.add", session });
      setResult(session);
      if (outcome === "completed") {
        if (document.visibilityState === "visible") { sfx("bell"); if (!getPrefs().sfx) beep(); }
        navigator.vibrate?.([120, 80, 120]);
        if (document.visibilityState !== "visible") {
          const restTxt = t.pomo ? ` Ahora, descanso.` : "";
          void localNotify(t.pomo ? `Bloque ${t.pomo.done + 1} terminado` : "Sesión terminada", `${fmtMinutes(min)} de ${t.subjectName}. Fabricaste ${pieceArticle(session.piece)}.${restTxt}`);
        }
      }
    }
    // Pomodoro: al terminar un bloque arranca el descanso
    if (t.pomo && outcome === "completed" && min >= 1) {
      const done = t.pomo.done + 1;
      const long = done % t.pomo.every === 0;
      const rest = long ? t.pomo.longRest : t.pomo.rest;
      persistBreak({ startedAt: endAt, until: endAt + rest * 60_000, long, pomo: { ...t.pomo, done }, subjectId: t.subjectId, subjectName: t.subjectName });
    }
    savingRef.current = false;
  }, [dispatch, userId]);

  // Presencia en vivo: el grupo ve que estás estudiando (y en el parque tu nave se prende)
  const { setMyLive } = useStore();
  useEffect(() => {
    // Con pausas, la hora de inicio "efectiva" se corre para que el fin que ve el grupo sea el real
    setMyLive(running ? { subject: running.subjectName, startedAt: running.startedAt + (running.pausedMs ?? 0), targetMin: running.targetMin } : null);
  }, [running, setMyLive]);

  // Reloj: cada medio segundo mientras hay una sesión o un descanso
  useEffect(() => {
    if (!running && !pomoBreak) return;
    const iv = setInterval(() => setNow(Date.now()), 500);
    const vis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
  }, [running, pomoBreak]);

  // Fin de la cuenta regresiva o del bloque (también si terminó con la app cerrada), y límite de pausa
  useEffect(() => {
    if (!running) return;
    if (running.pausedAt) {
      if (now - running.pausedAt >= PAUSE_MAX_MIN * 60_000) {
        const min = activeMs(running, now) / 60_000;
        if (min < 1) { persist(null); return; }
        // Con cuenta regresiva o pomodoro, cortar antes de tiempo da chatarra (las horas cuentan igual)
        save({ ...running, pomo: null }, min, running.targetMin !== null ? "abandoned" : "completed");
        setAutoClosed(true);
        void localNotify("La pausa pasó de 5 minutos", `Se guardaron ${fmtMinutes(Math.floor(min))} de ${running.subjectName}.`);
      }
      return;
    }
    const elapsedMin = activeMs(running, now) / 60_000;
    if (running.targetMin !== null && elapsedMin >= running.targetMin) {
      const endAt = running.startedAt + (running.pausedMs ?? 0) + running.targetMin * 60_000;
      save(running, running.targetMin, "completed", endAt);
    } else if (running.targetMin === null && elapsedMin >= MAX_MIN) save(running, MAX_MIN, "completed");
  }, [now, running, save]);

  // Fin del descanso: suena y avisa (el bloque siguiente lo arrancás vos)
  useEffect(() => {
    if (!pomoBreak || now < pomoBreak.until || bellRef.current === pomoBreak.until) return;
    bellRef.current = pomoBreak.until;
    if (now - pomoBreak.until > 60_000) return; // terminó hace rato (app cerrada): sin ruido
    if (document.visibilityState === "visible") { sfx("bell"); if (!getPrefs().sfx) beep(); }
    navigator.vibrate?.([200, 100, 200]);
    if (document.visibilityState !== "visible") void localNotify("Terminó el descanso", `Volvé a ${pomoBreak.subjectName}: bloque ${pomoBreak.pomo.done + 1}.`);
  }, [now, pomoBreak]);

  // Pantalla encendida mientras corre el cronómetro (si el navegador lo permite)
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const req = () => navigator.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => undefined);
    void req();
    const vis = () => { if (document.visibilityState === "visible") void req(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); void lock?.release(); };
  }, [running]);

  const start = (t: Omit<RunningTimer, "startedAt">) => {
    setResult(null);
    setAutoClosed(false);
    persistBreak(null);
    const r: RunningTimer = { ...t, startedAt: Date.now(), pausedAt: null, pausedMs: 0 };
    setNow(r.startedAt);
    persist(r);
    sfx("start");
  };
  const pause = () => { if (running && !running.pausedAt) { const n = Date.now(); setNow(n); persist({ ...running, pausedAt: n }); sfx("pause"); } };
  const resume = () => {
    if (!running?.pausedAt) return;
    const n = Date.now();
    setNow(n);
    persist({ ...running, pausedMs: (running.pausedMs ?? 0) + (n - running.pausedAt), pausedAt: null });
    sfx("resume");
  };
  const elapsedSec = running ? activeMs(running, now) / 1000 : 0;
  const paused = !!running?.pausedAt;
  const pauseLeftSec = running?.pausedAt ? Math.max(0, PAUSE_MAX_MIN * 60 - (now - running.pausedAt) / 1000) : 0;
  const finish = () => running && save({ ...running, pomo: null }, elapsedSec / 60, "completed");
  const abandon = () => running && save({ ...running, pomo: null }, elapsedSec / 60, "abandoned");
  const discard = () => persist(null);
  const breakLeftSec = pomoBreak ? Math.max(0, (pomoBreak.until - now) / 1000) : 0;
  const nextBlock = () => {
    if (!pomoBreak) return;
    const b = pomoBreak;
    start({ subjectId: b.subjectId, subjectName: b.subjectName, targetMin: b.pomo.work, pomo: b.pomo });
  };
  const endPomodoro = () => persistBreak(null);

  return (
    <Ctx.Provider value={{
      running, elapsedSec, paused, pauseLeftSec, start, pause, resume, finish, abandon, discard, result,
      clearResult: () => { setResult(null); setAutoClosed(false); },
      pomoBreak, breakLeftSec, nextBlock, endPomodoro, autoClosed,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTimer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTimer fuera de TimerProvider");
  return c;
}
