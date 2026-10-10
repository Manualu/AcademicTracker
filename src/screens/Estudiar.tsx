import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Piece } from "../components/Piece";
import { Icon, ScreenHead, Sheet } from "../components/ui";
import { nextPiece, pieceFor, pieceInfo, PIECES } from "../lib/pieces";
import { useMe, useStore } from "../lib/store";
import { dayKey, fmtClock, fmtMinutes, fmtTime, parseDay, uuid } from "../lib/time";
import { useTimer } from "../lib/timer";

const DURATIONS = [25, 50, 90, 120];

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
  const isCustom = value !== null && !subjects.some((s) => s.name === value.name);
  return (
    <div className="subject-pick" role="group" aria-label="Materia">
      {subjects.map((s) => (
        <button key={s.name} aria-pressed={value?.name === s.name} onClick={() => onChange(s)}>{s.name}</button>
      ))}
      <input
        className="input"
        placeholder={subjects.length ? "Otra materia" : "¿Qué vas a estudiar?"}
        value={isCustom ? value!.name : custom}
        onChange={(e) => { setCustom(e.target.value); onChange(e.target.value.trim() ? { id: null, name: e.target.value } : null); }}
        maxLength={80}
      />
      {subjects.length === 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          Si marcás las materias que estás cursando en <Link to="/carrera">Carrera</Link>, aparecen acá para elegirlas rápido.
        </p>
      )}
    </div>
  );
}

function Dial({ progress, children }: { progress: number; children: React.ReactNode }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="dial">
      <svg className="ring" viewBox="0 0 100 100" aria-hidden>
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const long = i % 5 === 0;
          const r1 = long ? 45.5 : 47;
          return (
            <line key={i} x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)} x2={50 + 49 * Math.cos(a)} y2={50 + 49 * Math.sin(a)}
              stroke="var(--ink-3)" strokeWidth={long ? 0.9 : 0.5} />
          );
        })}
        <circle cx="50" cy="50" r={r - 4} fill="var(--card)" stroke="var(--line)" strokeWidth="1.2" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--soft)" strokeWidth="5" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--yellow)" strokeWidth="5" strokeDasharray={`${c * progress} ${c}`} />
      </svg>
      <div className="center">{children}</div>
    </div>
  );
}

function Running() {
  const { running, elapsedSec, finish, abandon, discard } = useTimer();
  const [confirm, setConfirm] = useState(false);
  if (!running) return null;
  const elapsedMin = elapsedSec / 60;
  const countdown = running.targetMin !== null;

  let piece = pieceFor(Math.max(1, elapsedMin));
  let progress: number;
  let pieceProgress: number;
  let caption: string;
  if (countdown) {
    piece = pieceFor(running.targetMin!);
    progress = Math.min(1, elapsedMin / running.targetMin!);
    pieceProgress = progress;
    caption = `Fabricando ${pieceInfo(piece).article}`;
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
      pieceProgress = 1;
      caption = "Ya fabricaste el alto horno";
    }
  }

  return (
    <div className="stack" style={{ alignItems: "stretch" }}>
      <p className="h2" style={{ textAlign: "center", marginTop: 4 }}>{running.subjectName}</p>
      <Dial progress={progress}>
        <Piece piece={piece} size={92} progress={pieceProgress} />
        <span className="num clock">{fmtClock(countdown ? running.targetMin! * 60 - elapsedSec : elapsedSec)}</span>
        <span className="small muted">{caption}</span>
      </Dial>
      <p className="small muted row" style={{ justifyContent: "center", textAlign: "center", margin: "4px 0" }}>
        <Icon name="plane" size={16} /> Funciona en modo avión y con la pantalla bloqueada.
      </p>
      {countdown ? (
        <button className="btn danger block" onClick={() => setConfirm(true)}>Cortar antes de tiempo</button>
      ) : elapsedMin < 1 ? (
        <button className="btn block" onClick={discard}>Cancelar</button>
      ) : (
        <button className="btn primary big block" onClick={finish}>Terminar y guardar</button>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} label="Cortar la sesión">
        <div className="stack">
          <h2 className="h2">¿Cortás la sesión?</h2>
          {elapsedMin >= 1 ? (
            <p style={{ margin: 0 }}>
              Se guardan los {fmtMinutes(Math.floor(elapsedMin))} que estudiaste, pero en vez de {pieceInfo(piece).article} te sale chatarra.
            </p>
          ) : (
            <p style={{ margin: 0 }}>Llevás menos de un minuto, así que no se guarda nada.</p>
          )}
          <div className="row">
            <button className="btn grow" onClick={() => setConfirm(false)}>Seguir estudiando</button>
            <button className="btn danger grow" onClick={() => { setConfirm(false); if (elapsedMin >= 1) abandon(); else discard(); }}>Cortar</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function Result() {
  const { result, clearResult } = useTimer();
  const { online } = useStore();
  if (!result) return null;
  const info = pieceInfo(result.piece);
  const scrap = result.piece === "chatarra";
  return (
    <div className="card celebrate stack" style={{ alignItems: "center" }}>
      <div className="piece-big"><Piece piece={result.piece} size={120} /></div>
      <h2 className="h1" style={{ fontSize: "1.8rem" }}>{scrap ? "Salió chatarra" : `Fabricaste ${info.article}`}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {fmtMinutes(result.minutes)} de {result.subjectName}. {scrap ? "Las horas cuentan igual; la pieza no." : online ? "Ya está en tu planta y el grupo lo ve." : "Ya está en tu planta. El grupo lo ve cuando vuelva la señal."}
      </p>
      <div className="row" style={{ width: "100%" }}>
        <button className="btn grow" onClick={clearResult}>Otra sesión</button>
        <Link className="btn primary grow" to="/" onClick={clearResult}>Ir al inicio</Link>
      </div>
    </div>
  );
}

function ManualSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId, dispatch, toast } = useStore();
  const [subject, setSubject] = useState<Subj | null>(null);
  const [date, setDate] = useState(dayKey(new Date()));
  const [h, setH] = useState(1);
  const [m, setM] = useState(0);
  const minutes = h * 60 + m;
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
    toast({ tone: "success", title: `Cargaste ${fmtMinutes(minutes)}`, body: `Fabricaste ${pieceInfo(pieceFor(minutes)).article}.` });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} label="Cargar horas a mano">
      <div className="stack">
        <h2 className="h2">Cargar horas a mano</h2>
        <p className="small muted" style={{ margin: 0 }}>Para cuando estudiaste sin el cronómetro. Suma igual y también fabrica pieza.</p>
        <SubjectPicker value={subject} onChange={setSubject} />
        <label className="field">
          <span>Día</span>
          <input className="input" type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="row">
          <label className="field grow">
            <span>Horas</span>
            <input className="input" type="number" inputMode="numeric" min={0} max={12} value={h} onChange={(e) => setH(Math.max(0, Math.min(12, Number(e.target.value) || 0)))} />
          </label>
          <label className="field grow">
            <span>Minutos</span>
            <input className="input" type="number" inputMode="numeric" min={0} max={59} step={5} value={m} onChange={(e) => setM(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} />
          </label>
        </div>
        <button className="btn primary big block" disabled={!valid} onClick={save}>Cargar {minutes >= 1 ? fmtMinutes(minutes) : ""}</button>
      </div>
    </Sheet>
  );
}

export default function Estudiar() {
  const { running, result, start } = useTimer();
  const { data, userId, dispatch } = useStore();
  const [subject, setSubject] = useState<Subj | null>(null);
  const [duration, setDuration] = useState<number | null>(50);
  const [manual, setManual] = useState(false);

  const todays = data.sessions
    .filter((s) => s.userId === userId && dayKey(s.startedAt) === dayKey(new Date()))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  if (running) return (<><ScreenHead title="Estudiando" /><Running /></>);

  return (
    <>
      <ScreenHead title="Estudiar" sub="Elegí la materia y cuánto tiempo. Al terminar, fabricás una pieza para tu planta." />
      {result ? <Result /> : (
        <div className="stack">
          <section className="stack">
            <h2 className="h2">Materia</h2>
            <SubjectPicker value={subject} onChange={setSubject} />
          </section>
          <section className="stack">
            <h2 className="h2">Duración</h2>
            <div className="chips" role="group" aria-label="Duración">
              {DURATIONS.map((d) => (
                <button key={d} className="chip" aria-pressed={duration === d} onClick={() => setDuration(d)}>{fmtMinutes(d)}</button>
              ))}
              <button className="chip" aria-pressed={duration === null} onClick={() => setDuration(null)}>Libre</button>
            </div>
            <div className="card row">
              <Piece piece={duration ? pieceFor(duration) : "tornillo"} size={52} />
              <p className="small grow" style={{ margin: 0 }}>
                {duration
                  ? <>Si llegás al final, fabricás <b>{pieceInfo(pieceFor(duration)).article}</b>. Si cortás antes, sale chatarra.</>
                  : <>Cronómetro sin límite: la pieza mejora a medida que pasa el tiempo y la guardás cuando terminás.</>}
              </p>
            </div>
          </section>
          <button className="btn primary big block" disabled={!subject?.name.trim()}
            onClick={() => subject && start({ subjectId: subject.id, subjectName: subject.name.trim(), targetMin: duration })}>
            Empezar
          </button>
          <button className="btn block" onClick={() => setManual(true)}>Cargar horas a mano</button>

          {todays.length > 0 && (
            <section>
              <div className="section-title"><h2 className="h2">Hoy</h2><span className="small muted">{fmtMinutes(todays.reduce((a, s) => a + s.minutes, 0))}</span></div>
              <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
                <ul className="feed">
                  {todays.map((s) => (
                    <li key={s.id} style={{ alignItems: "center" }}>
                      <Piece piece={s.piece} size={34} />
                      <div className="grow">
                        <div className="what"><b>{s.subjectName}</b></div>
                        <div className="when">
                          {fmtTime(new Date(s.startedAt))}, {fmtMinutes(s.minutes)}
                          {s.source === "manual" ? " (manual)" : ""}
                        </div>
                      </div>
                      <button className="btn-ghost" aria-label="Borrar sesión"
                        onClick={() => { if (confirm("¿Borrar esta sesión?")) dispatch({ kind: "session.delete", id: s.id, userId: s.userId }); }}>
                        <Icon name="trash" size={20} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      )}
      <ManualSheet open={manual} onClose={() => setManual(false)} />
    </>
  );
}
