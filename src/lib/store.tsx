import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyOp } from "./apply";
import { DemoBackend } from "./demoBackend";
import { pieceArticle } from "./catalog";
import { SupabaseBackend, isNetworkError } from "./supabaseBackend";
import { fmtMinutes, uuid } from "./time";
import { emptyData, type Backend, type GroupData, type LiveStudy, type Op, type PieceKey, type QueuedOp, type RemoteEvent } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const backend: Backend =
  import.meta.env.VITE_DEMO === "1" || !url || !key ? new DemoBackend() : new SupabaseBackend(url, key);

const QUEUE_KEY = "remontada.queue";
const LAST_USER_KEY = "remontada.lastUser";
const cacheKey = (u: string) => `remontada.cache.${u}`;

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* almacenamiento lleno o bloqueado */ }
}

export type Toast = { id: string; title: string; body?: string; tone?: "info" | "error" | "success"; userId?: string; piece?: PieceKey; icon?: string };

type Store = {
  ready: boolean;
  userId: string | null;
  data: GroupData;
  online: boolean;
  pending: number;
  syncing: boolean;
  toasts: Toast[];
  dispatch: (op: Op) => void;
  refresh: () => Promise<void>;
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
  setUserId: (id: string | null) => void;
  /** Quién está estudiando ahora, incluido vos (tu cronómetro cuenta aunque no haya señal). */
  live: Record<string, LiveStudy>;
  setMyLive: (l: LiveStudy | null) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserIdState] = useState<string | null>(null);
  const [server, setServer] = useState<GroupData>(emptyData);
  const [queue, setQueue] = useState<QueuedOp[]>(() => read(QUEUE_KEY, []));
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [remoteLive, setRemoteLive] = useState<Record<string, LiveStudy>>({});
  const [myLive, setMyLiveState] = useState<LiveStudy | null>(null);
  const queueRef = useRef(queue);
  const userRef = useRef(userId);
  const flushing = useRef(false);
  const serverRef = useRef(server);

  queueRef.current = queue;
  userRef.current = userId;
  serverRef.current = server;

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = uuid();
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5000);
  }, []);
  const dismiss = useCallback((id: string) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const setQueuePersist = useCallback((q: QueuedOp[]) => {
    queueRef.current = q;
    write(QUEUE_KEY, q);
    setQueue(q);
  }, []);

  const refresh = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    try {
      const d = await backend.fetchAll();
      setServer(d);
      write(cacheKey(u), d);
    } catch (e) {
      if (!isNetworkError(e)) console.error(e);
    }
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current || !userRef.current) return;
    flushing.current = true;
    setSyncing(true);
    let sentSomething = false;
    try {
      while (queueRef.current.length > 0) {
        const first = queueRef.current[0];
        // Se saca por id y leyendo la cola de nuevo: mientras se mandaba este cambio pudieron
        // entrar otros (por ejemplo, "Marcar CBC completo" encola seis de golpe)
        const done = () => setQueuePersist(queueRef.current.filter((q) => q.qid !== first.qid));
        try {
          await backend.exec(first.op);
          sentSomething = true;
          done();
        } catch (e) {
          if (isNetworkError(e)) break; // sin conexión: queda en la cola para más tarde
          console.error(e);
          done();
          toast({ tone: "error", title: "No se pudo guardar un cambio", body: String((e as Error).message ?? e) });
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
    if (sentSomething) await refresh();
  }, [refresh, setQueuePersist, toast]);

  const dispatch = useCallback((op: Op) => {
    setQueuePersist([...queueRef.current, { qid: uuid(), op }]);
    void flush();
  }, [flush, setQueuePersist]);

  const setUserId = useCallback((id: string | null) => {
    userRef.current = id;
    setUserIdState(id);
    if (id) {
      write(LAST_USER_KEY, id);
      setServer(read(cacheKey(id), emptyData()));
    } else {
      try { localStorage.removeItem(LAST_USER_KEY); } catch { /* ignorar */ }
      setServer(emptyData());
    }
  }, []);

  // Arranque: sesión guardada, o la última conocida si estamos sin conexión
  useEffect(() => {
    let alive = true;
    (async () => {
      let id: string | null = null;
      try { id = await backend.currentUserId(); } catch { /* sin conexión */ }
      if (!id && !navigator.onLine) id = read<string | null>(LAST_USER_KEY, null);
      if (!alive) return;
      setUserId(id);
      setReady(true);
    })();
    const off = backend.onAuthChange((id) => {
      if (id !== userRef.current) setUserId(id);
    });
    return () => { alive = false; off(); };
  }, [setUserId]);

  useEffect(() => {
    if (!userId) return;
    void refresh().then(() => flush());
  }, [userId, refresh, flush]);

  // Conexión: al volver, se manda lo pendiente
  useEffect(() => {
    const on = () => { setOnline(true); void flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const iv = setInterval(() => { if (queueRef.current.length) void flush(); }, 30_000);
    const vis = () => { if (document.visibilityState === "visible") void refresh().then(() => flush()); };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", vis);
      clearInterval(iv);
    };
  }, [flush, refresh]);

  // Tiempo real: lo que cargan los demás aparece solo y con aviso
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = backend.subscribe((e: RemoteEvent) => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 400);
      const author = (e.record.user_id ?? e.record.created_by) as string | undefined;
      if (e.type !== "INSERT" || !author || author === userRef.current) return;
      const name = serverRef.current.profiles.find((p) => p.id === author)?.displayName ?? "Alguien";
      if (e.table === "study_sessions") {
        toast({
          title: `${name} sumó ${fmtMinutes(Number(e.record.minutes))} de ${e.record.subject_name}`,
          body: `Fabricó ${pieceArticle(e.record.piece as PieceKey)}.`,
          userId: author,
          piece: e.record.piece as PieceKey,
        });
      } else if (e.table === "activities") {
        toast({ title: `${name} hizo actividad física`, body: String(e.record.kind), userId: author, icon: "run" });
      } else if (e.table === "exams") {
        toast({ title: `${name} agendó un examen de ${e.record.subject_name}`, userId: author, icon: "calendar" });
      }
    });
    return () => { clearTimeout(timer); off(); };
  }, [userId, refresh, toast]);

  const data = useMemo(() => queue.reduce((d, q) => applyOp(d, q.op), server), [queue, server]);

  // Presencia: escuchar quién estudia y publicar si estudiás vos
  useEffect(() => {
    if (!userId) return;
    return backend.onPresence(setRemoteLive);
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    backend.setPresence(userId, myLive);
  }, [userId, myLive, online]);
  const setMyLive = useCallback((l: LiveStudy | null) => setMyLiveState(l), []);
  const live = useMemo(() => {
    const out = { ...remoteLive };
    if (userId) { if (myLive) out[userId] = myLive; else delete out[userId]; }
    return out;
  }, [remoteLive, myLive, userId]);

  const value: Store = {
    ready, userId, data, online, pending: queue.length, syncing, toasts,
    dispatch, refresh, toast, dismiss, setUserId, live, setMyLive,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fuera de StoreProvider");
  return s;
}

export function useMe() {
  const { data, userId } = useStore();
  return data.profiles.find((p) => p.id === userId) ?? null;
}
