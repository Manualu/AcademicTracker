// Cronómetro de estudio. Funciona sin conexión (modo avión): guarda la hora de inicio en el
// celular y calcula el tiempo transcurrido, así que sigue contando aunque bloquees la pantalla
// o se cierre la app. La sesión terminada entra en la cola y se sube cuando vuelve la señal.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { pieceArticle, rollPiece } from "./catalog";
import { localNotify } from "./push";
import { useStore } from "./store";
import { fmtMinutes, uuid } from "./time";
import type { StudySession } from "./types";

const KEY = "remontada.timer";
const MAX_MIN = 720;

export type RunningTimer = {
  startedAt: number;
  targetMin: number | null; // null = modo libre
  subjectId: string | null;
  subjectName: string;
};

type TimerCtx = {
  running: RunningTimer | null;
  elapsedSec: number;
  start: (t: Omit<RunningTimer, "startedAt">) => void;
  finish: () => void; // modo libre: guarda lo hecho
  abandon: () => void; // modo cuenta regresiva: corta antes y sale chatarra
  discard: () => void; // menos de un minuto: no se guarda nada
  result: StudySession | null;
  clearResult: () => void;
};

const Ctx = createContext<TimerCtx | null>(null);

function load(): RunningTimer | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<StudySession | null>(null);
  const savingRef = useRef(false);

  const persist = (t: RunningTimer | null) => {
    try {
      if (t) localStorage.setItem(KEY, JSON.stringify(t));
      else localStorage.removeItem(KEY);
    } catch { /* ignorar */ }
    setRunning(t);
  };

  const save = useCallback((t: RunningTimer, minutes: number, outcome: StudySession["outcome"]) => {
    if (savingRef.current) return;
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
        if (document.visibilityState === "visible") beep();
        navigator.vibrate?.([120, 80, 120]);
        if (document.visibilityState !== "visible") {
          void localNotify("Sesión terminada", `${fmtMinutes(min)} de ${t.subjectName}. Fabricaste ${pieceArticle(session.piece)}.`);
        }
      }
    }
    savingRef.current = false;
  }, [dispatch, userId]);

  // Presencia en vivo: el grupo ve que estás estudiando (y en el parque tu nave se prende)
  const { setMyLive } = useStore();
  useEffect(() => {
    setMyLive(running ? { subject: running.subjectName, startedAt: running.startedAt, targetMin: running.targetMin } : null);
  }, [running, setMyLive]);

  // Reloj: cada medio segundo mientras hay una sesión en curso
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setNow(Date.now()), 500);
    const vis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
  }, [running]);

  // Fin de la cuenta regresiva (también si terminó mientras la app estaba cerrada)
  useEffect(() => {
    if (!running) return;
    const elapsedMin = (now - running.startedAt) / 60_000;
    if (running.targetMin !== null && elapsedMin >= running.targetMin) save(running, running.targetMin, "completed");
    else if (running.targetMin === null && elapsedMin >= MAX_MIN) save(running, MAX_MIN, "completed");
  }, [now, running, save]);

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
    const r = { ...t, startedAt: Date.now() };
    setNow(r.startedAt);
    persist(r);
  };
  const elapsedSec = running ? (now - running.startedAt) / 1000 : 0;
  const finish = () => running && save(running, elapsedSec / 60, "completed");
  const abandon = () => running && save(running, elapsedSec / 60, "abandoned");
  const discard = () => persist(null);

  return (
    <Ctx.Provider value={{ running, elapsedSec, start, finish, abandon, discard, result, clearResult: () => setResult(null) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTimer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTimer fuera de TimerProvider");
  return c;
}
