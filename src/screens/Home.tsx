import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ActivitySheet } from "../components/ActivitySheet";
import { IsoPiece } from "../components/IsoPiece";
import { ParkCanvas, useParkWorld } from "../components/ParkCanvas";
import { celebrate, clearSelection, lotOf, STAGES, stageIdx, type ParkScene, type ParkSelection } from "../iso/park";
import { pieceDef, RARITY, type Rarity } from "../lib/catalog";
import { PieceSheet } from "../components/PieceSheet";
import { inventoryOf } from "../lib/catalog";
import { Inspector, useParkMilestones } from "./Parque";
import { Avatar, Icon, isoWeek, Ring } from "../components/ui";
import { buildFeed, type FeedItem } from "../lib/feed";
import { activitiesOf, sessionsOf, weekActivities, weekMinutes, weekSummary } from "../lib/stats";
import { useMe, useStore } from "../lib/store";
import { addDays, capitalize, dayKey, daysUntil, fmtClock, fmtHours, fmtMinutes, fmtTime, startOfWeek } from "../lib/time";
import { useTimer } from "../lib/timer";

const DOW = ["L", "M", "M", "J", "V", "S", "D"];

function Meter({ minutes, pace }: { minutes: number; pace: number }) {
  const hours = minutes / 60;
  const pacePct = Math.min(100, (pace / 60 / 14) * 100);
  return (
    <div className="meter" role="img" aria-label={`${fmtHours(minutes)} de 14 horas`}>
      {pace > 0 && pace < 14 * 60 && (
        <div className="meter-pace" style={{ left: `${pacePct}%` }}><span>ritmo</span></div>
      )}
      <div className="meter-cells">
        {Array.from({ length: 14 }, (_, i) => {
          const fill = Math.max(0, Math.min(1, hours - i));
          return <i key={i}>{fill > 0 && <b style={{ width: `${fill * 100}%`, animationDelay: `${i * 35}ms` }} />}</i>;
        })}
      </div>
      <div className="meter-scale"><span>0</span><span>7 h</span><span>14 h</span></div>
    </div>
  );
}

function DayBars({ perDay }: { perDay: number[] }) {
  const todayIdx = (new Date().getDay() + 6) % 7;
  const max = Math.max(150, ...perDay);
  return (
    <div className="days" aria-label="Horas por día">
      {perDay.map((m, i) => {
        const future = i > todayIdx;
        return (
          <div key={i} className={i === todayIdx ? "today" : ""}>
            <span className={`bar ${m > 0 ? "on" : ""} ${future ? "future" : ""}`}
              style={future ? undefined : { height: `${Math.max(4, (m / max) * 100)}%`, animationDelay: `${i * 50}ms` }}>
              {m > 0 && <span className="v">{fmtHours(m)}</span>}
            </span>
            <span className="d">{DOW[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

function dayLabel(iso: string): string {
  const k = dayKey(iso);
  if (k === dayKey(new Date())) return "Hoy";
  if (k === dayKey(addDays(new Date(), -1))) return "Ayer";
  return capitalize(new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" }).replace(".", ""));
}

const KIND_ICON: Record<FeedItem["kind"], [string, string] | null> = {
  session: null,
  activity: ["k-act", "run"],
  exam: ["k-exam", "calendar"],
  subject: ["k-mat", "check"],
};

/** Festeja sobre su nave cada sesión nueva que llega (de cualquiera del grupo). */
function useDeliveries(sessions: { id: string; userId: string; piece: string; outcome: string; createdAt: string }[]) {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const fresh = (iso: string) => { const d = Date.now() - new Date(iso).getTime(); return d >= 0 && d < 90_000; };
    if (!seen.current) {
      // Al entrar: festejamos solo lo recién terminado (por ejemplo, la sesión que acabás de cerrar)
      seen.current = new Set(sessions.filter((x) => !fresh(x.createdAt)).map((x) => x.id));
    }
    const nuevos = sessions.filter((x) => !seen.current!.has(x.id));
    nuevos.forEach((x, i) => {
      seen.current!.add(x.id);
      const scrap = x.outcome === "abandoned";
      const d = pieceDef(scrap ? "chatarra" : x.piece);
      window.setTimeout(() => celebrate(x.userId, scrap ? "Chatarra" : `+ ${d.n}`, scrap ? "#9AA2AC" : RARITY[d.r as Rarity].color), 900 + i * 1400);
    });
  }, [sessions]);
}

export default function Home() {
  const { data, userId } = useStore();
  const me = useMe();
  const { running, elapsedSec } = useTimer();
  const [actOpen, setActOpen] = useState(false);
  const [feedLen, setFeedLen] = useState(10);
  const week = useMemo(() => weekSummary(data, userId!), [data, userId]);
  const feed = useMemo(() => buildFeed(data, 200), [data]);
  const byId = useMemo(() => new Map(data.profiles.map((p) => [p.id, p])), [data.profiles]);

  const ws = startOfWeek();
  const perDay = useMemo(() => {
    const out = [0, 0, 0, 0, 0, 0, 0];
    for (const s of week.weekSessions) out[(new Date(s.startedAt).getDay() + 6) % 7] += s.minutes;
    return out;
  }, [week.weekSessions]);

  const crew = useMemo(() => data.profiles
    .map((p) => ({ p, min: weekMinutes(sessionsOf(data, p.id), ws), acts: weekActivities(activitiesOf(data, p.id), ws) }))
    .sort((a, b) => b.min - a.min), [data, ws]);

  const myExamIds = new Set(data.participants.filter((p) => p.userId === userId).map((p) => p.examId));
  const nextExam = data.exams
    .filter((e) => myExamIds.has(e.id) && new Date(e.startsAt) > new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  const diff = week.minutes - week.paceMinutes;
  const done = week.minutes >= week.goalMinutes;
  const led = done ? "ok" : diff >= 0 ? "ok" : diff > -120 ? "" : "warn";
  const paceText = done
    ? <><b>Semana cumplida.</b> Lo que sumes ahora es ventaja.</>
    : diff >= 0
      ? <><b>Vas {fmtMinutes(Math.round(diff))} arriba del ritmo.</b> Promedio {fmtHours(week.avgPerDay)} h por día.</>
      : <><b>Te faltan {fmtMinutes(Math.round(-diff))}</b> para ir en ritmo. Promedio {fmtHours(week.avgPerDay)} h por día.</>;

  const now = new Date();
  const dateTag = now.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");
  const hour = now.getHours();
  const greet = hour < 6 ? "Buenas noches" : hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  const world = useParkWorld();
  useParkMilestones(world);
  useDeliveries(data.sessions);
  const scene = useRef<ParkScene | null>(null);
  const parkRef = useRef<HTMLElement>(null);
  const [sel, setSel] = useState<ParkSelection | null>(null);
  const [ficha, setFicha] = useState<{ id: string; owner: string } | null>(null);
  const focusOn = (id: string, z = 1.7, instant = false) => {
    const lot = lotOf(id);
    if (lot) scene.current?.focus(lot[0] + 1.6, lot[1] + 1.8, z, instant);
  };
  // Al entrar, la cámara va a tu nave
  useEffect(() => {
    // Sin animación: entrar ya parado en tu nave (animar el zoom al abrir costaba en iPad)
    const t = window.setTimeout(() => userId && focusOn(userId, 1.45, true), 0);
    return () => window.clearTimeout(t);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearSelection(), []);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __park?: unknown }).__park = scene.current; });
  // Si el panel tapa el parque, se deja de dibujar (ahorra batería)
  useEffect(() => {
    const onScroll = () => {
      scene.current?.setVisible(window.scrollY < window.innerHeight * 0.55);
      parkRef.current?.classList.toggle("scrolled", window.scrollY > 30);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const studying = world.friends.filter((f) => f.live);
  const stage = stageIdx(world.groupHours);
  const nextStage = STAGES[stage + 1];
  const leader = crew[0];

  let lastDay = "";

  return (
    <>
      <section className="home-park" aria-label="Parque del grupo" ref={parkRef}>
        <ParkCanvas sceneRef={scene} onSelect={setSel} label="Parque industrial del grupo. Arrastrá, hacé zoom y tocá a cada uno." />
        <div className="hp-top">
          <Link to={`/perfil/${userId}`} aria-label="Mi perfil" className="hp-me">
            <Avatar profile={me} size={40} />
            <span className="grow">
              <span className="eyebrow">{dateTag} · Semana {isoWeek()}</span>
              <b>{greet}, {me?.displayName ?? "…"}</b>
            </span>
          </Link>
          <div className="hp-tools">
            <button className="icon-btn boxed" onClick={() => userId && focusOn(userId, 1.7)} aria-label="Ir a mi nave"><Icon name="pin" size={19} /></button>
            <button className="icon-btn boxed" onClick={() => scene.current?.recenter()} aria-label="Ver todo el parque"><Icon name="fit" size={19} /></button>
            <Link to="/parque" className="icon-btn boxed" aria-label="Mi nave, catálogo y etapas"><Icon name="factory" size={19} /></Link>
          </div>
        </div>
        <div className="hp-strip">
          <Link to="/parque?tab=etapas" className="hp-chip">
            <span className="eyebrow">Etapa {stage + 1}/{STAGES.length} · {Math.round(world.groupHours)} h</span>
            <b className="ellipsis">{STAGES[stage].n}</b>
            {nextStage && <span className="mini-bar"><b style={{ width: `${((world.groupHours - STAGES[stage].h) / (nextStage.h - STAGES[stage].h)) * 100}%` }} /></span>}
          </Link>
          {studying.length > 0 && (
            <div className="hp-live" role="group" aria-label="Estudiando ahora">
              <span className="eyebrow"><span className="dotlive" /> Ahora</span>
              {studying.map((f) => (
                <button key={f.id} onClick={() => { focusOn(f.id, 2); setSel({ k: "nave", f: { ...f, lot: lotOf(f.id) ?? [0, 0] } }); }} aria-label={`${f.n} está estudiando ${f.live!.subject}`}>
                  <img src={f.avatar} alt="" style={{ background: f.col }} />
                </button>
              ))}
            </div>
          )}
        </div>
        {sel && <Inspector sel={sel} world={world} onClose={() => { setSel(null); clearSelection(); }} onFicha={(id, owner) => setFicha({ id, owner })} />}
      </section>

      <div className="home-sheet">
      <button className="sheet-grip-btn" aria-label="Ver tu semana y el grupo"
        onClick={() => window.scrollTo({ top: window.scrollY > 40 ? 0 : window.innerHeight * 0.62, behavior: "smooth" })}><span /></button>
      <section className="console" aria-labelledby="semana">
        <div className="wk-top">
          <p className="eyebrow" id="semana">Estudio · meta 14 h</p>
          <p className="eyebrow" style={{ color: week.daysLeft <= 1 && !done ? "var(--yellow)" : undefined }}>
            {week.daysLeft === 0 ? "Último día" : week.daysLeft === 1 ? "Queda 1 día" : `Quedan ${week.daysLeft} días`}
          </p>
        </div>
        <div className="wk-total">
          <span className="display">{fmtHours(week.minutes)}</span>
          <span className="of muted"><b>/ 14 h</b>esta semana</span>
          <span className="wk-badge">
            <span className="display" style={{ fontSize: "1.9rem", color: done ? "#3fd09a" : "var(--yellow)" }}>
              {Math.min(100, Math.round((week.minutes / week.goalMinutes) * 100))}%
            </span>
          </span>
        </div>
        <Meter minutes={week.minutes} pace={week.paceMinutes} />
        <DayBars perDay={perDay} />
        <p className="status-line"><span className={`led ${led}`} /> <span>{paceText}</span></p>
        <div className="rule" />
        <div className="act-row">
          <div className="grow">
            <p className="eyebrow" style={{ marginBottom: 8 }}>Actividad · {Math.min(week.activities, 3)} de 3</p>
            <div className="pips" aria-label={`${week.activities} de 3 actividades`}>
              {Array.from({ length: Math.max(3, week.activities) }, (_, i) => (
                <i key={i} className={i < week.activities ? "on" : ""}>{i < week.activities && <Icon name="check" size={15} stroke={3} />}</i>
              ))}
            </div>
          </div>
          <button className="btn sm" onClick={() => setActOpen(true)}><Icon name="plus" size={16} stroke={2.4} />Registrar</button>
        </div>
      </section>

      {running ? (
        <Link to="/estudiar" className="live-card">
          <span className="dotlive" />
          <span className="grow">
            <span className="eyebrow" style={{ color: "rgba(16,27,51,.65)" }}>En marcha</span>
            <b className="ellipsis" style={{ display: "block" }}>{running.subjectName}</b>
          </span>
          <span className="num">{fmtClock(running.targetMin ? running.targetMin * 60 - elapsedSec : elapsedSec)}</span>
          <Icon name="next" size={20} />
        </Link>
      ) : (
        <div className="cta-row">
          <Link to="/estudiar" className="btn primary big"><Icon name="play" size={20} />Empezar a estudiar</Link>
        </div>
      )}

      <div className="section-title">
        <h2 className="h2">La cuadrilla</h2>
        <Link to="/ranking" className="link">Ranking</Link>
      </div>
      <div className="crew">
        {crew.map(({ p, min, acts }, i) => (
          <Link key={p.id} to={`/perfil/${p.id}`} className={p.id === userId ? "me" : ""}>
            <span className="pos">{i + 1}</span>
            {i === 0 && leader.min > 0 && <span className="crown"><Icon name="crown" size={14} /></span>}
            <Ring value={min / week.goalMinutes} color={min >= week.goalMinutes ? "var(--green)" : "var(--yellow-2)"}>
              <Avatar profile={p} size={46} />
            </Ring>
            <span className="name ellipsis" style={{ maxWidth: "100%" }}>{p.id === userId ? "Vos" : p.displayName}</span>
            <span className="hrs">{fmtHours(min)}<small>h</small></span>
            <span className="acts" aria-label={`${acts} de 3 actividades`}>
              {[0, 1, 2].map((k) => <i key={k} className={k < acts ? "on" : ""} />)}
            </span>
          </Link>
        ))}
      </div>

      {nextExam && (() => {
        const n = daysUntil(nextExam.startsAt);
        const d = new Date(nextExam.startsAt);
        const hot = n <= 7;
        const others = data.participants.filter((p) => p.examId === nextExam.id && p.userId !== userId).map((p) => byId.get(p.userId));
        return (
          <>
            <div className="section-title">
              <h2 className="h2">Próximo examen</h2>
              <Link to="/examenes" className="link">Calendario</Link>
            </div>
            <Link to="/examenes" className={`ticket ${hot ? "hot" : ""}`}>
              <div className="stub">
                <span className="eyebrow">{d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")}</span>
                <span className="num">{d.getDate()}</span>
                <span className="eyebrow">{d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}</span>
              </div>
              <div className="body">
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <span className="title">{nextExam.subjectName}</span>
                  <span className="cd">{n === 0 ? "Hoy" : n === 1 ? "Mañana" : `${n} días`}</span>
                </div>
                <span className="small muted">{capitalize(nextExam.kind)}, {fmtTime(d)} h{nextExam.location ? ` · ${nextExam.location}` : ""}</span>
                <div className="row" style={{ marginTop: 6, gap: 8 }}>
                  {others.length > 0 && <div className="avatar-stack">{others.map((p) => <Avatar key={p!.id} profile={p} size={22} />)}</div>}
                  <span className="tiny muted">
                    {hot ? "Semana de parciales viejos." : others.length ? `Lo rendís con ${others.length} más` : "Todavía hay margen."}
                  </span>
                </div>
              </div>
            </Link>
          </>
        );
      })()}

      <div className="section-title"><h2 className="h2">Movimiento del grupo</h2></div>
      <div className="card tight">
        {feed.length === 0 ? (
          <div className="empty">Cuando alguien estudie o entrene, aparece acá.</div>
        ) : (
          <ul className="feed">
            {feed.slice(0, feedLen).map((f) => {
              const p = byId.get(f.userId);
              const lbl = dayLabel(f.at);
              const showDay = lbl !== lastDay;
              lastDay = lbl;
              const k = KIND_ICON[f.kind];
              return [
                showDay && <li key={`d${f.id}`} className="feed-day" style={{ borderTop: 0 }}>{lbl}</li>,
                <li key={f.id}>
                  <Link to={`/perfil/${f.userId}`} aria-label={p?.displayName} className="badge">
                    <Avatar profile={p} size={40} />
                    {k && <span className={`kind ${k[0]}`}><Icon name={k[1]} size={11} stroke={2.6} /></span>}
                  </Link>
                  <div className="grow">
                    <div className="what"><b>{p?.displayName ?? "Alguien"}</b> {f.verb}</div>
                    <div className="when">{fmtTime(f.at)}{f.detail ? ` · ${f.detail}` : ""}</div>
                  </div>
                  {f.piece && <IsoPiece piece={f.piece} size={44} />}
                </li>,
              ];
            })}
          </ul>
        )}
      </div>
      {feed.length > feedLen && (
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => setFeedLen(feedLen + 20)}>Ver más movimiento</button>
      )}

      </div>
      <ActivitySheet open={actOpen} onClose={() => setActOpen(false)} />
      <PieceSheet piece={ficha?.id ?? null} count={ficha ? inventoryOf(data, ficha.owner).get(ficha.id) ?? 0 : 0}
        owner={ficha ? (ficha.owner === userId ? "Vos" : data.profiles.find((p) => p.id === ficha.owner)?.displayName ?? "") : ""} onClose={() => setFicha(null)} />
    </>
  );
}
