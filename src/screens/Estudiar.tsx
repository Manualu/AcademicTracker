import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IsoPiece, IsoPieceLive } from "../components/IsoPiece";
import { Icon, ScreenHead, Sheet } from "../components/ui";
import { nextPiece, pieceFor, pieceInfo, PIECES } from "../lib/pieces";
import { useMe, useStore } from "../lib/store";
import { dayKey, fmtClock, fmtMinutes, fmtTime, parseDay, uuid } from "../lib/time";
import { useTimer } from "../lib/timer";
import type { PieceKey } from "../lib/types";

const DURATIONS = [25, 50, 60, 90, 120];

type Subj = { id: string | null; name: string };

function useMySubjects(): Subj[] {
  const { data, userId } = useStore();
  const me = useMe();
  return useMemo(() => {
    const out: Subj[] = [];
    const seen = new Set<string>();
    const add = (s: Subj) => { const k = s.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(s); } };
    data.statuses
      .filter((s) => s.userId === userId && s.planId === me?.planId && s.status === "cursando")
      .forEach((s) => add({ id: s.subjectId, name: s.subjectName ?? s.subjectId }));
    [...data.sessions]
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 40)
      .forEach((s) => add({ id: s.subjectId, name: s.subjectName }));
    return out;
  }, [data.statuses, data.sessions, userId, me?.planId]);
}

function SubjectPicker({ value, onChange }: { value: Subj | null; onChange: (s: Subj | null) => void }) {
  const subjects = useMySubjects();
  const [custom, setCustom] = useState("");
  const [typing, setTyping] = useState(subjects.length === 0);
  const isCustom = value !== null && !subjects.some((s) => s.name === value.name);
  return (
    <div>
      <div className="chips subj-chips" role="group" aria-label="Materia">
        {subjects.map((s) => (
          <button key={s.name} className="chip" aria-pressed={value?.name === s.name} onClick={() => { setTyping(false); onChange(s); }}>{s.name}</button>
        ))}
        {subjects.length > 0 && (
          <button className="chip add" aria-pressed={typing || isCustom} onClick={() => { setTyping(true); onChange(custom.trim() ? { id: null, name: custom } : null); }}>
            <Icon name="plus" size={15} stroke={2.4} />Otra
          </button>
        )}
      </div>
      {(typing || isCustom) && (
        <input
          className="input custom-subj"
          placeholder={subjects.length ? "Nombre de la materia" : "¿Qué vas a estudiar?"}
          value={isCustom ? value!.name : custom}
          autoFocus={subjects.length > 0}
          onChange={(e) => { setCustom(e.target.value); onChange(e.target.value.trim() ? { id: null, name: e.target.value } : null); }}
          maxLength={80}
        />
      )}
      {subjects.length === 0 && (
        <p className="small muted" style={{ margin: "10px 2px 0" }}>
          Si marcás lo que estás cursando en <Link to="/carrera">Carrera</Link>, tus materias aparecen acá.
        </p>
      )}
    </div>
  );
}

function Dial({ progress, children, ticks = 60 }: { progress: number; children: ReactNode; ticks?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const a = progress * Math.PI * 2;
  return (
    <div className="dial">
      <svg className="ring" viewBox="0 0 100 100" aria-hidden>
        {Array.from({ length: ticks }, (_, i) => {
          const t = (i / ticks) * Math.PI * 2;
          const long = i % 5 === 0;
          const done = i / ticks <= progress;
          return (
            <line key={i} x1={50 + (long ? 47.2 : 48.2) * Math.cos(t)} y1={50 + (long ? 47.2 : 48.2) * Math.sin(t)}
              x2={50 + 49.8 * Math.cos(t)} y2={50 + 49.8 * Math.sin(t)}
              stroke={done ? "var(--yellow)" : "rgba(220,232,255,.28)"} strokeWidth={long ? 0.7 : 0.4} />
          );
        })}
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(220,232,255,.1)" strokeWidth="2.2" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--yellow)" strokeWidth="2.2" strokeLinecap="round"
          strokeDasharray={`${c * progress} ${c}`} style={{ filter: "drop-shadow(0 0 2px rgba(255,194,26,.8))", transition: "stroke-dasharray 1s linear" }} />
        <circle cx={50 + r * Math.cos(a)} cy={50 + r * Math.sin(a)} r="2.4" fill="#fff" stroke="var(--yellow)" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="38" fill="rgba(6,14,34,.35)" stroke="rgba(220,232,255,.08)" strokeWidth="0.4" />
      </svg>
      <div className="center">{children}</div>
    </div>
  );
}

function useFocusMode(on: boolean) {
  useEffect(() => {
    if (!on) return;
    document.body.classList.add("focus");
    return () => document.body.classList.remove("focus");
  }, [on]);
}

function Running() {
  const { running, elapsedSec, finish, abandon, discard } = useTimer();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  if (!running) return null;
  const elapsedMin = elapsedSec / 60;
  const countdown = running.targetMin !== null;

  let piece: PieceKey;
  let progress: number;
  let pieceProgress: number;
  let caption: string;
  if (countdown) {
    piece = pieceFor(running.targetMin!);
    progress = Math.min(1, elapsedMin / running.targetMin!);
    pieceProgress = progress;
    const end = new Date(running.startedAt + running.targetMin! * 60_000);
    caption = `Fabricando ${pieceInfo(piece).article} · termina ${fmtTime(end)}`;
  } else {
    const nxt = nextPiece(elapsedMin);
    const cur = PIECES.filter((p) => p.min <= elapsedMin).pop();
    progress = (elapsedSec % 3600) / 3600;
    if (nxt) {
      piece = nxt.key;
      const from = cur?.min ?? 0;
      pieceProgress = (elapsedMin - from) / (nxt.min - from);
      caption = `${fmtMinutes(Math.ceil(nxt.min - elapsedMin))} para ${nxt.article}`;
    } else {
      piece = "horno";
      pieceProgress = 1;
      caption = "Alto horno fabricado. Seguí si querés";
    }
  }

  return (
    <div className="focus" role="region" aria-label="Sesión de estudio">
      <div className="focus-inner">
        <div className="top">
          <button className="icon-btn" onClick={() => nav("/")} aria-label="Minimizar"><Icon name="down" /></button>
          <span className="chip-dark"><Icon name="plane" size={13} /> Funciona en modo avión</span>
          <span style={{ width: 40 }} />
        </div>
        <div className="subject">
          <p className="eyebrow" style={{ color: "var(--con-ink-3)" }}>{countdown ? `Sesión de ${fmtMinutes(running.targetMin!)}` : "Modo libre"}</p>
          <h1 className="h1" style={{ color: "#fff", marginTop: 6 }}>{running.subjectName}</h1>
        </div>
        <Dial progress={progress}>
          <IsoPieceLive piece={piece} size={250} height={230} progress={pieceProgress} />
        </Dial>
        <div className="clock" aria-live="off">{fmtClock(countdown ? running.targetMin! * 60 - elapsedSec : elapsedSec)}</div>
        <div className="clock-sub">{caption}</div>

        <div className="actions">
          {countdown ? (
            <button className="btn block" onClick={() => setConfirm(true)}><Icon name="stop" size={16} />Cortar antes de tiempo</button>
          ) : elapsedMin < 1 ? (
            <button className="btn block" onClick={discard}>Cancelar</button>
          ) : (
            <button className="btn primary big block" onClick={finish}><Icon name="check" size={20} stroke={2.6} />Terminar y guardar</button>
          )}
          <p className="note">Podés bloquear el celular: el tiempo sigue contando.</p>
        </div>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} label="Cortar la sesión" title="¿Cortás la sesión?" eyebrow="Cuenta regresiva">
        <div className="stack">
          {elapsedMin >= 1 ? (
            <div className="row" style={{ gap: 14 }}>
              <IsoPiece piece="chatarra" size={72} />
              <p style={{ margin: 0 }} className="grow">
                Se guardan los <b>{fmtMinutes(Math.floor(elapsedMin))}</b> que estudiaste, pero en vez de {pieceInfo(piece).article} te sale <b>chatarra</b>.
              </p>
            </div>
          ) : (
            <p style={{ margin: 0 }}>Llevás menos de un minuto, así que no se guarda nada.</p>
          )}
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn primary grow" onClick={() => setConfirm(false)}>Seguir estudiando</button>
            <button className="btn danger grow" onClick={() => { setConfirm(false); if (elapsedMin >= 1) abandon(); else discard(); }}>Cortar</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

const CONFETTI = ["#FFC21A", "#3FD09A", "#7EAEFF", "#FF7D82", "#FFFFFF"];

function Result() {
  const { result, clearResult } = useTimer();
  const { online } = useStore();
  if (!result) return null;
  const info = pieceInfo(result.piece);
  const scrap = result.piece === "chatarra";
  return (
    <div className="focus" role="dialog" aria-label="Sesión terminada">
      <div className="focus-inner">
        {!scrap && (
          <div className="confetti" aria-hidden>
            {Array.from({ length: 36 }, (_, i) => (
              <i key={i} style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 9) * 60}ms`, animationDuration: `${1.4 + (i % 5) * 0.25}s` }} />
            ))}
          </div>
        )}
        <div className={`result ${scrap ? "scrap" : ""}`} style={{ marginTop: "8vh" }}>
          <p className="eyebrow" style={{ color: "var(--con-ink-3)" }}>{scrap ? "Sesión cortada" : "Sesión completa"}</p>
          <div className="stage">
            <div className="rays" />
            <IsoPiece piece={result.piece} size={260} height={230} />
          </div>
          <h2 className="h1">{scrap ? "Salió chatarra" : `Fabricaste ${info.article}`}</h2>
          <p className="muted" style={{ margin: "10px auto 0", maxWidth: 320, color: "var(--con-ink-2)" }}>
            <b style={{ color: "#fff" }}>{fmtMinutes(result.minutes)}</b> de {result.subjectName}.{" "}
            {scrap ? "Las horas cuentan igual; la pieza no." : online ? "Ya está en tu planta y el grupo lo ve." : "Ya está en tu planta. El grupo lo ve cuando vuelva la señal."}
          </p>
        </div>
        <div className="actions" style={{ flexDirection: "row" }}>
          <button className="btn grow" onClick={clearResult}>Otra sesión</button>
          <Link className="btn primary grow" to="/" onClick={clearResult}>Ir al inicio</Link>
        </div>
      </div>
    </div>
  );
}

function ManualSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId, dispatch, toast } = useStore();
  const [subject, setSubject] = useState<Subj | null>(null);
  const [date, setDate] = useState(dayKey(new Date()));
  const [minutes, setMinutes] = useState(60);
  const valid = subject && subject.name.trim() && minutes >= 1 && minutes <= 720 && date <= dayKey(new Date());

  function save() {
    if (!valid || !userId) return;
    const day = parseDay(date);
    const isToday = date === dayKey(new Date());
    // Si es hoy, la sesión termina ahora; si es otro día, se ubica a la tarde
    const start = isToday ? new Date(Date.now() - minutes * 60_000) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 17, 0);
    if (start < day) start.setTime(day.getTime());
    dispatch({
      kind: "session.add",
      session: {
        id: uuid(), userId, subjectId: subject!.id, subjectName: subject!.name.trim(), startedAt: start.toISOString(),
        minutes, source: "manual", outcome: "completed", piece: pieceFor(minutes), createdAt: new Date().toISOString(),
      },
    });
    toast({ tone: "success", title: `Cargaste ${fmtMinutes(minutes)}`, body: `Fabricaste ${pieceInfo(pieceFor(minutes)).article}.`, piece: pieceFor(minutes) });
    onClose();
  }

  const step = (d: number) => setMinutes((m) => Math.max(5, Math.min(720, m + d)));

  return (
    <Sheet open={open} onClose={onClose} label="Cargar horas a mano" title="Cargar a mano" eyebrow="Sin cronómetro">
      <div className="stack" style={{ gap: 16 }}>
        <p className="small muted" style={{ margin: 0 }}>Para cuando estudiaste sin la app. Suma igual y también fabrica pieza.</p>
        <div className="field"><span>Materia</span><SubjectPicker value={subject} onChange={setSubject} /></div>
        <label className="field">
          <span>Día</span>
          <input className="input" type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="field">
          <span>Duración</span>
          <div className="row" style={{ gap: 12 }}>
            <div className="stepper grow">
              <button onClick={() => step(-15)} aria-label="Menos 15 minutos">−</button>
              <output>{fmtMinutes(minutes)}</output>
              <button onClick={() => step(15)} aria-label="Más 15 minutos">+</button>
            </div>
            <IsoPiece piece={pieceFor(minutes)} size={56} />
          </div>
        </div>
        <button className="btn primary big block" disabled={!valid} onClick={save}>
          {subject?.name.trim() ? `Cargar ${fmtMinutes(minutes)}` : "Elegí la materia"}
        </button>
      </div>
    </Sheet>
  );
}

export default function Estudiar() {
  const { running, result, start } = useTimer();
  const { data, userId, dispatch } = useStore();
  const subjects = useMySubjects();
  const [subject, setSubject] = useState<Subj | null>(null);
  const [duration, setDuration] = useState<number | null>(50);
  const [manual, setManual] = useState(false);
  useFocusMode(!!running || !!result);

  // Arranca con la última materia que estudiaste elegida
  useEffect(() => { if (!subject && subjects.length) setSubject(subjects[0]); }, [subjects]); // eslint-disable-line react-hooks/exhaustive-deps

  const todays = data.sessions
    .filter((s) => s.userId === userId && dayKey(s.startedAt) === dayKey(new Date()))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  if (running) return <Running />;
  if (result) return <Result />;

  const ready = !!subject?.name.trim();

  return (
    <>
      <ScreenHead eyebrow="Sesión nueva" title="Estudiar" sub="Cada sesión fabrica una pieza para tu planta. Más largo, mejor máquina."
        right={<button className="btn sm" onClick={() => setManual(true)}><Icon name="edit" size={16} />A mano</button>} />

      <div className="step-label"><span className="n">1</span><h2 className="h2">Materia</h2></div>
      <SubjectPicker value={subject} onChange={setSubject} />

      <div className="step-label"><span className="n">2</span><h2 className="h2">Duración</h2></div>
      <div className="durations" role="group" aria-label="Duración">
        {DURATIONS.map((d) => (
          <button key={d} className="dur" aria-pressed={duration === d} onClick={() => setDuration(d)}>
            <IsoPiece piece={pieceFor(d)} size={70} height={62} />
            <span className="t">{fmtMinutes(d)}</span>
            <span className="p">{pieceInfo(pieceFor(d)).name}</span>
          </button>
        ))}
        <button className="dur" aria-pressed={duration === null} onClick={() => setDuration(null)}>
          <div style={{ width: 70, height: 62, display: "grid", placeItems: "center" }}>
            <Icon name="timer" size={34} stroke={1.6} />
          </div>
          <span className="t">Libre</span>
          <span className="p">Mejora con el tiempo</span>
        </button>
      </div>
      <p className="reward-note">
        <Icon name="info" size={16} />
        <span>
          {duration
            ? <>Si llegás al final, fabricás <b>{pieceInfo(pieceFor(duration)).article}</b>. Si cortás antes, sale chatarra (las horas cuentan igual).</>
            : <>Sin límite: la pieza sube de categoría mientras estudiás y la guardás cuando terminás.</>}
        </span>
      </p>

      <div className="start-bar">
        <button className="btn primary big block" disabled={!ready}
          onClick={() => subject && start({ subjectId: subject.id, subjectName: subject.name.trim(), targetMin: duration })}>
          {ready ? <><Icon name="play" size={20} />Empezar {duration ? fmtMinutes(duration) : "en modo libre"}</> : "Elegí una materia"}
        </button>
      </div>

      {todays.length > 0 && (
        <section>
          <div className="section-title"><h2 className="h2">Hoy</h2><span className="eyebrow">{fmtMinutes(todays.reduce((a, s) => a + s.minutes, 0))} en total</span></div>
          <div className="card tight">
            <ul className="feed">
              {todays.map((s) => (
                <li key={s.id}>
                  <IsoPiece piece={s.piece} size={46} />
                  <div className="grow">
                    <div className="what"><b>{s.subjectName}</b></div>
                    <div className="when">
                      {fmtTime(s.startedAt)} · {fmtMinutes(s.minutes)} · {pieceInfo(s.piece).name}
                      {s.source === "manual" ? " · manual" : ""}
                    </div>
                  </div>
                  <button className="icon-btn" aria-label="Borrar sesión"
                    onClick={() => { if (confirm("¿Borrar esta sesión?")) dispatch({ kind: "session.delete", id: s.id, userId: s.userId }); }}>
                    <Icon name="trash" size={19} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <ManualSheet open={manual} onClose={() => setManual(false)} />
    </>
  );
}
