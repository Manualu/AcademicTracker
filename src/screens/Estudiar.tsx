import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IsoPiece, IsoPieceLive } from "../components/IsoPiece";
import { Icon, ScreenHead, Sheet } from "../components/ui";
import { areaOf, AREA_LABEL } from "../lib/areas";
import { inventoryOf, nextTier, pieceArticle, pieceDef, pieceName, RARITY, rollPiece, TIER_FACE, tierFor, type Rarity } from "../lib/catalog";
import { PieceSheet } from "../components/PieceSheet";
import { Reveal } from "../components/Reveal";
import { starsOf } from "../iso/park";
import { useMe, useStore } from "../lib/store";
import { dayKey, fmtClock, fmtMinutes, fmtTime, parseDay, uuid } from "../lib/time";
import { BREAK_GRACE_MIN, POMO_PRESETS, useTimer } from "../lib/timer";
import { AmbientSheet } from "../components/AmbientSheet";
import { musicService, onSessionStart, runShortcut, usePrefs } from "../lib/prefs";
import { AMBIENTS, playAmbient, useAmbient } from "../lib/sound";
import type { PieceKey } from "../lib/types";

const DURATIONS = [25, 50, 60, 90, 120];

export type Subj = { id: string | null; name: string };

export function useMySubjects(): Subj[] {
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

export function SubjectPicker({ value, onChange }: { value: Subj | null; onChange: (s: Subj | null) => void }) {
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

function Dial({ progress, children, ticks = 60, color = "var(--yellow)" }: { progress: number; children: ReactNode; ticks?: number; color?: string }) {
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
              stroke={done ? color : "rgba(220,232,255,.28)"} strokeWidth={long ? 0.7 : 0.4} />
          );
        })}
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(220,232,255,.1)" strokeWidth="2.2" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"
          strokeDasharray={`${c * progress} ${c}`} style={{ filter: `drop-shadow(0 0 2px ${color === "var(--yellow)" ? "rgba(255,194,26,.8)" : "rgba(126,184,255,.8)"})`, transition: "stroke-dasharray 1s linear" }} />
        <circle cx={50 + r * Math.cos(a)} cy={50 + r * Math.sin(a)} r="2.4" fill="#fff" stroke={color} strokeWidth="1.2" />
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
  const { running, elapsedSec, finish, abandon, discard, paused, pause, resume, pauseLeftSec } = useTimer();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [prefs] = usePrefs();
  const amb = useAmbient();
  if (!running) return null;
  const elapsedMin = elapsedSec / 60;
  const countdown = running.targetMin !== null;

  let piece: PieceKey;
  let progress: number;
  let pieceProgress: number;
  let caption: string;
  let tierText: string;
  if (countdown) {
    // En pomodoros seguidos, el descanso sumado también cuenta para la categoría del cajón
    const tier = tierFor(running.targetMin! + Math.round(running.bonusMin ?? 0));
    piece = TIER_FACE[tier.t];
    progress = Math.min(1, elapsedMin / running.targetMin!);
    pieceProgress = progress;
    const end = new Date(Date.now() + (running.targetMin! * 60 - elapsedSec) * 1000);
    caption = `Termina ${fmtTime(end)}`;
    tierText = `Cajón de categoría ${tier.t} · ${tier.name}`;
  } else {
    const nxt = nextTier(elapsedMin);
    const cur = tierFor(elapsedMin);
    progress = (elapsedSec % 3600) / 3600;
    if (nxt) {
      piece = TIER_FACE[nxt.t];
      pieceProgress = (elapsedMin - cur.min) / (nxt.min - cur.min);
      caption = `${fmtMinutes(Math.ceil(nxt.min - elapsedMin))} para subir a categoría ${nxt.t}`;
      tierText = elapsedMin < 1 ? "Arrancando" : `Ya asegurás categoría ${cur.t} · ${cur.name}`;
    } else {
      piece = TIER_FACE[6];
      pieceProgress = 1;
      caption = "Categoría máxima. Seguí si querés";
      tierText = "Cajón de categoría 6 · Instalaciones";
    }
  }

  return (
    <div className={`focus ${paused ? "is-paused" : ""}`} role="region" aria-label="Sesión de estudio">
      <div className="focus-inner">
        <div className="top">
          <button className="icon-btn" onClick={() => nav("/")} aria-label="Minimizar"><Icon name="down" /></button>
          <span className="chip-dark"><Icon name="plane" size={13} /> Funciona en modo avión</span>
          <button className={`icon-btn ${prefs.ambient ? "sound-on" : ""}`} onClick={() => setSoundOpen(true)} aria-label="Sonido de fondo">
            <Icon name={prefs.ambient ? "sound" : "mute"} />
          </button>
        </div>
        <div className="subject">
          <p className="eyebrow" style={{ color: "var(--con-ink-3)" }}>
            {running.pomo ? `Pomodoro ${running.pomo.work}/${running.pomo.rest} · bloque ${running.pomo.done + 1}${running.bonusMin ? ` · +${Math.round(running.bonusMin)} min de descanso` : ""}` : countdown ? `Sesión de ${fmtMinutes(running.targetMin!)}` : "Modo libre"}
          </p>
          <h1 className="h1" style={{ color: "#fff", marginTop: 6 }}>{running.subjectName}</h1>
        </div>
        <Dial progress={progress}>
          <IsoPieceLive piece={piece} size={250} height={230} progress={pieceProgress} />
        </Dial>
        <div className="clock" aria-live="off">{fmtClock(countdown ? running.targetMin! * 60 - elapsedSec : elapsedSec)}</div>
        <div className="clock-sub">{paused ? <>En pausa · se cierra sola en <b>{fmtClock(pauseLeftSec)}</b></> : caption}</div>
        <div className="tier-pill"><span className="rdot" style={{ background: "var(--yellow)" }} />{tierText}</div>
        {prefs.ambient && amb.blocked && !paused && (
          <button className="chip-dark sound-blocked" onClick={() => void playAmbient(prefs.ambient)}>
            <Icon name="sound" size={13} /> Tocá para activar {AMBIENTS.find((a) => a.k === prefs.ambient)?.n.toLowerCase()}
          </button>
        )}

        <div className="actions">
          {paused ? (
            <button className="btn primary big block" onClick={resume}><Icon name="play" size={20} />Seguir</button>
          ) : (
            <button className="btn block pause-btn" onClick={pause}><Icon name="pause" size={18} />Pausa (hasta 5 min)</button>
          )}
          {countdown ? (
            <button className="btn block ghost-dark" onClick={() => setConfirm(true)}><Icon name="stop" size={16} />Cortar antes de tiempo</button>
          ) : elapsedMin < 1 ? (
            <button className="btn block ghost-dark" onClick={() => { discard(); runShortcut("end"); }}>Cancelar</button>
          ) : (
            <button className={`btn block ${paused ? "ghost-dark" : "primary big"}`} onClick={finish}><Icon name="check" size={20} stroke={2.6} />Terminar y guardar</button>
          )}
          <p className="note">{paused ? "La pausa no suma tiempo. Si pasan 5 minutos, se guarda lo que llevás." : "Podés bloquear el celular: el tiempo sigue contando."}</p>
        </div>
      </div>

      <AmbientSheet open={soundOpen} onClose={() => setSoundOpen(false)} />
      <Sheet open={confirm} onClose={() => setConfirm(false)} label="Cortar la sesión" title="¿Cortás la sesión?" eyebrow={running.pomo ? "Pomodoro" : "Cuenta regresiva"}>
        <div className="stack">
          {elapsedMin >= 1 ? (
            <div className="row" style={{ gap: 14 }}>
              <IsoPiece piece="chatarra" size={72} />
              <p style={{ margin: 0 }} className="grow">
                Se guardan los <b>{fmtMinutes(Math.floor(elapsedMin))}</b> que estudiaste, pero en vez de abrir el cajón te sale <b>chatarra</b>.{running.pomo ? " El pomodoro termina acá." : ""}
              </p>
            </div>
          ) : (
            <p style={{ margin: 0 }}>Llevás menos de un minuto, así que no se guarda nada.</p>
          )}
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn primary grow" onClick={() => setConfirm(false)}>Seguir estudiando</button>
            <button className="btn danger grow" onClick={() => { setConfirm(false); if (elapsedMin >= 1) abandon(); else { discard(); runShortcut("end"); } }}>Cortar</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function BreakView() {
  const { pomoBreak, breakLeftSec, breakCounts, graceLeftSec, nextBlock, endPomodoro } = useTimer();
  const nav = useNavigate();
  const [soundOpen, setSoundOpen] = useState(false);
  const [prefs] = usePrefs();
  const { data, userId } = useStore();
  if (!pomoBreak) return null;
  const total = (pomoBreak.until - pomoBreak.startedAt) / 1000;
  const over = breakLeftSec <= 0;
  const n = pomoBreak.pomo.done;
  const today = data.sessions.filter((s) => s.userId === userId && dayKey(s.startedAt) === dayKey(new Date()) && s.subjectName === pomoBreak.subjectName).reduce((a, s) => a + s.minutes, 0);
  return (
    <div className="focus is-break" role="region" aria-label="Descanso del pomodoro">
      <div className="focus-inner">
        <div className="top">
          <button className="icon-btn" onClick={() => nav("/")} aria-label="Minimizar"><Icon name="down" /></button>
          <span className="chip-dark"><Icon name="tomato" size={13} /> Pomodoro {pomoBreak.pomo.work}/{pomoBreak.pomo.rest}</span>
          <button className={`icon-btn ${prefs.ambient ? "sound-on" : ""}`} onClick={() => setSoundOpen(true)} aria-label="Sonido de fondo">
            <Icon name={prefs.ambient ? "sound" : "mute"} />
          </button>
        </div>
        <div className="subject">
          <p className="eyebrow" style={{ color: "var(--con-ink-3)" }}>{over ? "Terminó el descanso" : pomoBreak.long ? "Descanso largo" : "Descanso"}</p>
          <h1 className="h1" style={{ color: "#fff", marginTop: 6 }}>{pomoBreak.subjectName}</h1>
        </div>
        <Dial progress={over ? 1 : 1 - breakLeftSec / total} color="#7eb8ff">
          <div className="break-face"><Icon name="coffee" size={84} stroke={1.3} /></div>
        </Dial>
        <div className="clock" aria-live="off">{over && breakCounts ? fmtClock(graceLeftSec) : fmtClock(breakLeftSec)}</div>
        <div className="clock-sub">
          {!over ? <>Bloque {n} listo · levantate, tomá agua, estirá</>
            : breakCounts ? <>Arrancá el bloque {n + 1} ya para que el descanso cuente</>
            : <>Te pasaste del descanso: si seguís, no suma</>}
        </div>
        <div className="pomo-dots" aria-label={`${n} bloques hechos`}>
          {Array.from({ length: Math.max(pomoBreak.pomo.every, n) }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
          <span>{fmtMinutes(today)} hoy de esta materia</span>
        </div>
        <div className="actions">
          <button className={`btn block ${over ? "primary big" : "pause-btn"}`} onClick={nextBlock}><Icon name="play" size={18} />{over ? `Empezar bloque ${n + 1}` : `Saltar descanso y empezar bloque ${n + 1}`}</button>
          <button className="btn block ghost-dark" onClick={() => { endPomodoro(); runShortcut("end"); nav("/"); }}>Terminar el pomodoro</button>
          <p className="note">{breakCounts
            ? `Si arrancás el bloque siguiente antes de que termine el descanso (o hasta ${BREAK_GRACE_MIN} min después), el descanso suma como estudio.`
            : "El descanso ya no suma. Igual podés seguir con otro bloque."}</p>
        </div>
      </div>
      <AmbientSheet open={soundOpen} onClose={() => setSoundOpen(false)} />
    </div>
  );
}

function Result() {
  const { result, clearResult, pomoBreak, endPomodoro, autoClosed, resultBonusMin } = useTimer();
  const { online, data, userId } = useStore();
  const [ficha, setFicha] = useState(false);
  const nav = useNavigate();
  // Pomodoro: si quedó un descanso en marcha, de acá se pasa al descanso
  const inPomo = !!pomoBreak && result?.outcome === "completed";
  const leave = () => { clearResult(); runShortcut("end"); };
  if (!result) return null;
  const scrap = result.outcome === "abandoned";
  const piece = scrap ? "chatarra" : result.piece;
  const p = pieceDef(piece);
  const n = inventoryOf(data, userId!).get(p.id) ?? 1;
  const rar = RARITY[p.r as Rarity];
  return (
    <>
      <Reveal piece={piece} count={n}>
        {(shown) => shown && (
          <>
            {!scrap && <span className="rar big" style={{ ["--rc" as string]: rar.color }}>{rar.n}{n > 1 ? ` · ${"★".repeat(starsOf(n))}` : " · nueva"}</span>}
            <h2 className="h1">{scrap ? "Salió chatarra" : p.n}</h2>
            <p className="small">
              <b style={{ color: "#fff" }}>{fmtMinutes(result.minutes)}</b> de {result.subjectName}{resultBonusMin > 0 ? ` (incluye ${resultBonusMin} min de descanso: volviste a tiempo)` : ""}.{" "}
              {scrap ? "Las horas cuentan igual; la pieza no. Con 5 chatarras reciclás una pieza."
                : n === 1 ? "Pieza nueva para tu colección." : `Ya tenías ${n - 1}.${starsOf(n) > starsOf(n - 1) ? ` ¡Subió a ${"★".repeat(starsOf(n))}!` : ""}`}
              {!scrap && (online ? " Ya está en tu nave." : " Se sube cuando vuelva la señal.")}
              {autoClosed && " La pausa pasó de 5 minutos y la sesión se cerró sola."}
            </p>
            {inPomo ? (
              <>
                <div className="actions">
                  <button className="btn" onClick={() => setFicha(true)}>Ficha técnica</button>
                  <button className="btn primary" onClick={clearResult}><Icon name="coffee" size={18} />Descanso de {pomoBreak!.long ? pomoBreak!.pomo.longRest : pomoBreak!.pomo.rest} min</button>
                </div>
                <button className="btn sm ghost-dark" onClick={() => { endPomodoro(); leave(); nav("/"); }}>Terminar el pomodoro acá</button>
              </>
            ) : (
              <div className="actions">
                {!scrap ? <button className="btn" onClick={() => setFicha(true)}>Ficha técnica</button> : <button className="btn" onClick={leave}>Otra sesión</button>}
                <Link className="btn primary" to="/" onClick={leave}>Guardar en mi nave</Link>
              </div>
            )}
          </>
        )}
      </Reveal>
      <PieceSheet piece={ficha ? piece : null} count={n} owner="Vos" onClose={() => setFicha(false)} />
    </>
  );
}

function ManualSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId, dispatch, toast } = useStore();
  const [subject, setSubject] = useState<Subj | null>(null);
  const [date, setDate] = useState(dayKey(new Date()));
  const [minutes, setMinutes] = useState(60);
  const [time, setTime] = useState(""); // hora de inicio (opcional)
  // Hora de inicio elegida; si no se carga, hoy termina ahora y otro día empieza a las 17
  const chosenStart = (() => {
    if (!time) return null;
    const [h, m] = time.split(":").map(Number);
    const d = parseDay(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  })();
  const endsInFuture = !!chosenStart && chosenStart.getTime() + minutes * 60_000 > Date.now();
  const valid = subject && subject.name.trim() && minutes >= 1 && minutes <= 720 && date <= dayKey(new Date()) && !endsInFuture;

  function save() {
    if (!valid || !userId) return;
    const day = parseDay(date);
    const isToday = date === dayKey(new Date());
    // Si es hoy, la sesión termina ahora; si es otro día, se ubica a la tarde
    const start = chosenStart ?? (isToday ? new Date(Date.now() - minutes * 60_000) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 17, 0));
    if (start < day) start.setTime(day.getTime());
    const id = uuid();
    const piece = rollPiece(minutes, subject!.name, id);
    dispatch({
      kind: "session.add",
      session: {
        id, userId, subjectId: subject!.id, subjectName: subject!.name.trim(), startedAt: start.toISOString(),
        minutes, source: "manual", outcome: "completed", piece, createdAt: new Date().toISOString(),
      },
    });
    toast({ tone: "success", title: `Cargaste ${fmtMinutes(minutes)}`, body: `Fabricaste ${pieceArticle(piece)}.`, piece });
    onClose();
  }

  const step = (d: number) => setMinutes((m) => Math.max(5, Math.min(720, m + d)));

  return (
    <Sheet open={open} onClose={onClose} label="Cargar horas a mano" title="Cargar a mano" eyebrow="Sin cronómetro">
      <div className="stack" style={{ gap: 16 }}>
        <p className="small muted" style={{ margin: 0 }}>Para cuando estudiaste sin la app. Suma igual y también fabrica pieza.</p>
        <div className="field"><span>Materia</span><SubjectPicker value={subject} onChange={setSubject} /></div>
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <label className="field grow">
            <span>Día</span>
            <input className="input" type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field" style={{ width: 130 }}>
            <span>Empezaste a las</span>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora de inicio (opcional)" />
          </label>
        </div>
        {endsInFuture && <p className="tiny" style={{ margin: "-8px 0 0", color: "var(--red)" }}>Con esa hora y duración, la sesión termina en el futuro.</p>}
        {!time && <p className="tiny muted" style={{ margin: "-8px 0 0" }}>Si no ponés la hora, {date === dayKey(new Date()) ? "se toma que terminaste recién" : "se guarda a las 17 h"}.</p>}
        <div className="field">
          <span>Duración</span>
          <div className="row" style={{ gap: 12 }}>
            <div className="stepper grow">
              <button onClick={() => step(-15)} aria-label="Menos 15 minutos">−</button>
              <output>{fmtMinutes(minutes)}</output>
              <button onClick={() => step(15)} aria-label="Más 15 minutos">+</button>
            </div>
            <IsoPiece piece={TIER_FACE[tierFor(minutes).t]} size={56} />
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
  const { running, result, start, pomoBreak } = useTimer();
  const { data, userId, dispatch } = useStore();
  const subjects = useMySubjects();
  const [subject, setSubject] = useState<Subj | null>(null);
  const [duration, setDuration] = useState<number | null | "pomo">(50);
  const [preset, setPreset] = useState(0);
  const [manual, setManual] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [prefs] = usePrefs();
  useFocusMode(!!running || !!result || !!pomoBreak);

  // Arranca con la última materia que estudiaste elegida
  useEffect(() => { if (!subject && subjects.length) setSubject(subjects[0]); }, [subjects]); // eslint-disable-line react-hooks/exhaustive-deps

  const todays = data.sessions
    .filter((s) => s.userId === userId && dayKey(s.startedAt) === dayKey(new Date()))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  if (running) return <Running />;
  if (result) return <Result />;
  if (pomoBreak) return <BreakView />;

  const ready = !!subject?.name.trim();

  return (
    <>
      <ScreenHead eyebrow="Sesión nueva" title="Estudiar" sub="Cada sesión abre un cajón con una máquina para tu nave. Más largo, mejor categoría."
        right={<button className="btn sm" onClick={() => setManual(true)}><Icon name="edit" size={16} />A mano</button>} />

      <div className="step-label"><span className="n">1</span><h2 className="h2">Materia</h2></div>
      <SubjectPicker value={subject} onChange={setSubject} />

      <div className="step-label"><span className="n">2</span><h2 className="h2">Duración</h2></div>
      <div className="durations" role="group" aria-label="Duración">
        {DURATIONS.map((d) => (
          <button key={d} className="dur" aria-pressed={duration === d} onClick={() => setDuration(d)}>
            <IsoPiece piece={TIER_FACE[tierFor(d).t]} size={70} height={62} />
            <span className="t">{fmtMinutes(d)}</span>
            <span className="p">Cat. {tierFor(d).t} · {tierFor(d).name}</span>
          </button>
        ))}
        <button className="dur" aria-pressed={duration === null} onClick={() => setDuration(null)}>
          <div style={{ width: 70, height: 62, display: "grid", placeItems: "center" }}>
            <Icon name="timer" size={34} stroke={1.6} />
          </div>
          <span className="t">Libre</span>
          <span className="p">Mejora con el tiempo</span>
        </button>
        <button className="dur pomo" aria-pressed={duration === "pomo"} onClick={() => setDuration("pomo")}>
          <div style={{ width: 70, height: 62, display: "grid", placeItems: "center" }}>
            <Icon name="tomato" size={36} stroke={1.6} />
          </div>
          <span className="t">Pomodoro</span>
          <span className="p">Bloques con descanso</span>
        </button>
      </div>
      {duration === "pomo" && (
        <div className="pomo-presets" role="radiogroup" aria-label="Formato del pomodoro">
          {POMO_PRESETS.map((p, i) => (
            <button key={p.label} role="radio" aria-checked={preset === i} onClick={() => setPreset(i)}>
              <IsoPiece piece={TIER_FACE[tierFor(p.work).t]} size={54} height={48} />
              <span className="grow">
                <b>{p.work} min de estudio · {p.rest} de descanso</b>
                <span>Cada bloque abre un cajón de categoría {tierFor(p.work).t} · {tierFor(p.work).name}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="reward-note">
        <Icon name="info" size={16} />
        <span>
          {duration === "pomo"
            ? <>Cada bloque de {POMO_PRESETS[preset].work} min que terminás abre un cajón{POMO_PRESETS[preset].work >= 50 ? <>: con 50 min salen piezas de una categoría más alta</> : null}. Descanso de {POMO_PRESETS[preset].rest} min y uno largo de {POMO_PRESETS[preset].longRest} cada 4 bloques. Si volvés a tiempo, el descanso suma como estudio: {POMO_PRESETS[preset].work === 25 ? "cada bloque seguido cuenta media hora" : "cada bloque seguido cuenta una hora"}; si te colgás, no. Si cortás un bloque, sale chatarra.</>
            : duration
            ? <>Si llegás al final abrís un cajón de <b>categoría {tierFor(duration).t}</b>: puede salir común, rara, épica o legendaria{subject && areaOf(subject.name) !== "general" ? <>, y salen más las de {AREA_LABEL[areaOf(subject.name)].toLowerCase()}</> : null}. Si cortás antes, sale chatarra.</>
            : <>Sin límite: el cajón sube de categoría mientras estudiás y lo abrís cuando terminás.</>}
        </span>
      </p>

      <div className="step-label"><span className="n">3</span><h2 className="h2">Sonido</h2><span className="eyebrow" style={{ marginLeft: "auto" }}>Opcional</span></div>
      <button className="sound-pick" onClick={() => setSoundOpen(true)}>
        <Icon name={prefs.ambient ? "sound" : "mute"} size={20} />
        <span className="grow"><b>{[prefs.ambient ? AMBIENTS.find((a) => a.k === prefs.ambient)?.n : null, musicService(prefs.musicLink) && prefs.musicOnStart ? `Tu playlist de ${musicService(prefs.musicLink)}` : null].filter(Boolean).join(" + ") || "Silencio"}</b>
          <span>{prefs.musicLink && musicService(prefs.musicLink) && prefs.musicOnStart ? "La playlist se abre al tocar Empezar" : prefs.ambient ? "Suena mientras estudiás, también con el celu bloqueado" : "Lluvia, olas, fábrica lejana, ruido o tu propia playlist"}</span></span>
        <Icon name="next" size={18} />
      </button>
      <AmbientSheet open={soundOpen} onClose={() => setSoundOpen(false)} />

      <div className="start-bar">
        <button className="btn primary big block" disabled={!ready}
          onClick={() => {
            if (!subject) return;
            const name = subject.name.trim();
            if (duration === "pomo") {
              const p = POMO_PRESETS[preset];
              start({ subjectId: subject.id, subjectName: name, targetMin: p.work, pomo: { work: p.work, rest: p.rest, longRest: p.longRest, every: 4, done: 0 } });
            } else start({ subjectId: subject.id, subjectName: name, targetMin: duration });
            onSessionStart();
          }}>
          {ready ? <><Icon name="play" size={20} />Empezar {duration === "pomo" ? `pomodoro ${POMO_PRESETS[preset].label}` : duration ? fmtMinutes(duration) : "en modo libre"}</> : "Elegí una materia"}
        </button>
      </div>

      {todays.length > 0 && (
        <section>
          <div className="section-title"><h2 className="h2">Hoy</h2><span className="eyebrow">{fmtMinutes(todays.reduce((a, s) => a + s.minutes, 0))} en total</span><Link to="/historial" className="link" style={{ marginLeft: "auto" }}>Historial</Link></div>
          <div className="card tight">
            <ul className="feed">
              {todays.map((s) => (
                <li key={s.id}>
                  <IsoPiece piece={s.outcome === "abandoned" ? "chatarra" : s.piece} size={46} />
                  <div className="grow">
                    <div className="what"><b>{s.subjectName}</b></div>
                    <div className="when">
                      {fmtTime(s.startedAt)} · {fmtMinutes(s.minutes)} · {pieceName(s.outcome === "abandoned" ? "chatarra" : s.piece)}
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
      {todays.length === 0 && data.sessions.some((s) => s.userId === userId) && (
        <Link to="/historial" className="hist-link"><Icon name="clock" size={18} /><span className="grow">Historial de tus sesiones</span><Icon name="next" size={18} /></Link>
      )}
      <ManualSheet open={manual} onClose={() => setManual(false)} />
    </>
  );
}
