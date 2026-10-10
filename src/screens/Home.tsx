import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ActivitySheet } from "../components/ActivitySheet";
import { Piece } from "../components/Piece";
import { Avatar, Icon } from "../components/ui";
import { buildFeed } from "../lib/feed";
import { pieceInfo } from "../lib/pieces";
import { weekSummary } from "../lib/stats";
import { useMe, useStore } from "../lib/store";
import { daysUntil, fmtClock, fmtHours, fmtMinutes, relativeTime } from "../lib/time";
import { useTimer } from "../lib/timer";

function WeekGauge({ minutes, pace }: { minutes: number; pace: number }) {
  const hours = minutes / 60;
  const paceH = pace / 60;
  return (
    <div className="gauge" role="img" aria-label={`${fmtHours(minutes)} de 14 horas`}>
      {Array.from({ length: 14 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, hours - i));
        const isPace = paceH > i && paceH <= i + 1;
        return (
          <i key={i} className={`${fill >= 1 ? "done" : ""} ${isPace ? "pace" : ""}`}>
            {fill > 0 && fill < 1 && <b style={{ width: `${fill * 100}%` }} />}
          </i>
        );
      })}
    </div>
  );
}

export default function Home() {
  const { data, userId } = useStore();
  const me = useMe();
  const { running, elapsedSec } = useTimer();
  const [actOpen, setActOpen] = useState(false);
  const [feedLen, setFeedLen] = useState(12);
  const week = useMemo(() => weekSummary(data, userId!), [data, userId]);
  const feed = useMemo(() => buildFeed(data, 200), [data]);
  const byId = useMemo(() => new Map(data.profiles.map((p) => [p.id, p])), [data.profiles]);

  const myExamIds = new Set(data.participants.filter((p) => p.userId === userId).map((p) => p.examId));
  const nextExam = data.exams
    .filter((e) => myExamIds.has(e.id) && new Date(e.startsAt) > new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  const diff = week.minutes - week.paceMinutes;
  const paceText =
    week.minutes >= week.goalMinutes
      ? "Semana cumplida. Lo que sumes ahora es ventaja."
      : diff >= 0
        ? `Vas ${fmtMinutes(Math.round(diff))} por encima del ritmo.`
        : `Te faltan ${fmtMinutes(Math.round(-diff))} para ir en ritmo.`;

  const today = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <header className="screen-head">
        <div className="grow">
          <p className="muted small" style={{ margin: 0 }}>{today.charAt(0).toUpperCase() + today.slice(1)}</p>
          <h1 className="h1">Hola, {me?.displayName ?? "…"}</h1>
        </div>
        <Link to={`/perfil/${userId}`} aria-label="Mi perfil"><Avatar profile={me} size={48} /></Link>
      </header>

      <div className="stack">
        {running && (
          <Link to="/estudiar" className="card row" style={{ textDecoration: "none", background: "var(--yellow)", color: "var(--yellow-ink)" }}>
            <Icon name="timer" />
            <span className="grow ellipsis"><b>Estudiando {running.subjectName}</b></span>
            <span className="num" style={{ fontSize: "1.3rem" }}>
              {fmtClock(running.targetMin ? running.targetMin * 60 - elapsedSec : elapsedSec)}
            </span>
          </Link>
        )}

        <section className="card" aria-labelledby="semana">
          <div className="row between">
            <h2 className="h2" id="semana">Esta semana</h2>
            <span className="small muted">{week.daysLeft === 0 ? "Último día" : week.daysLeft === 1 ? "Queda 1 día" : `Quedan ${week.daysLeft} días`}</span>
          </div>
          <div className="row" style={{ alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span className="num" style={{ fontSize: "2.6rem", lineHeight: 1 }}>{fmtHours(week.minutes)}</span>
            <span className="muted">de 14 h de estudio</span>
          </div>
          <WeekGauge minutes={week.minutes} pace={week.paceMinutes} />
          <p className="small" style={{ margin: "8px 0 0" }}>
            Promedio {fmtHours(week.avgPerDay)} h/día. {paceText}
          </p>
          <div className="dashed" />
          <div className="row between">
            <div>
              <div className="dots" aria-label={`${week.activities} de 3 actividades`}>
                {Array.from({ length: Math.max(3, week.activities) }, (_, i) => <i key={i} className={i < week.activities ? "on" : ""} />)}
              </div>
              <p className="small muted" style={{ margin: "6px 0 0" }}>
                {week.activities >= 3 ? "Actividad física cumplida" : `Actividad física: ${week.activities} de 3`}
              </p>
            </div>
            <button className="btn" onClick={() => setActOpen(true)}><Icon name="run" size={20} />Registrar</button>
          </div>
        </section>

        {!running && <Link to="/estudiar" className="btn primary big block">Empezar a estudiar</Link>}

        {nextExam && (() => {
          const n = daysUntil(nextExam.startsAt);
          return (
            <Link to="/examenes" className="card row" style={{ textDecoration: "none" }}>
              <div className="grow">
                <div className="small muted">Tu próximo examen</div>
                <div className="h2 ellipsis">{nextExam.subjectName}</div>
                <div className="small">{n <= 7 ? "Ya tendrías que estar resolviendo parciales viejos." : "Todavía hay margen, pero no te confíes."}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="num" style={{ fontSize: "2.2rem", lineHeight: 1 }}>{n}</div>
                <div className="tiny muted">{n === 1 ? "día" : "días"}</div>
              </div>
            </Link>
          );
        })()}
      </div>

      <div className="section-title">
        <h2 className="h2">Tu planta esta semana</h2>
        <Link to={`/perfil/${userId}`} className="small muted">Ver toda</Link>
      </div>
      {week.weekSessions.length === 0 ? (
        <div className="card empty small">Cada sesión de estudio fabrica una pieza. Esta semana todavía no hay ninguna.</div>
      ) : (
        <div className="floor">
          {[...week.weekSessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((s) => (
            <div key={s.id} className="tile" title={`${pieceInfo(s.piece).name}: ${fmtMinutes(s.minutes)} de ${s.subjectName}`}>
              <Piece piece={s.piece} size={40} />
            </div>
          ))}
        </div>
      )}

      <div className="section-title"><h2 className="h2">Qué está haciendo el grupo</h2></div>
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {feed.length === 0 ? (
          <div className="empty small">Cuando alguien estudie o entrene, aparece acá.</div>
        ) : (
          <ul className="feed">
            {feed.slice(0, feedLen).map((f) => {
              const p = byId.get(f.userId);
              return (
                <li key={f.id}>
                  <Link to={`/perfil/${f.userId}`} aria-label={p?.displayName}><Avatar profile={p} size={38} /></Link>
                  <div className="grow">
                    <div className="what"><b>{p?.displayName ?? "Alguien"}</b> {f.verb}</div>
                    <div className="when">{f.detail ? `${f.detail}. ` : ""}{relativeTime(f.at)}</div>
                  </div>
                  {f.piece && <Piece piece={f.piece} size={30} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {feed.length > feedLen && (
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => setFeedLen(feedLen + 20)}>Ver más</button>
      )}

      <ActivitySheet open={actOpen} onClose={() => setActOpen(false)} />
    </>
  );
}
